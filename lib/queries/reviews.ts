"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  adminReviewsApi,
  productReviewsApi,
  type CreateReviewBody,
  type ListAdminReviewsParams,
  type ProductReview,
  type ReviewSummary,
  type UpdateReviewBody,
} from "@/lib/api/reviews";
import { ApiError } from "@/lib/api/client";
import { parsePage } from "@/lib/api/utils";
import { tt } from "@/lib/i18n/tt";
import { getErrorMessage } from "@/lib/queries/utils";

export const reviewKeys = {
  all: ["reviews"] as const,
  product: (productId: string) => [...reviewKeys.all, "product", productId] as const,
  list: (productId: string, page: number, pageSize: number) =>
    [...reviewKeys.product(productId), "list", page, pageSize] as const,
  summary: (productId: string) => [...reviewKeys.product(productId), "summary"] as const,
  featured: (minRating: number, limit: number) =>
    [...reviewKeys.all, "featured", minRating, limit] as const,
  admin: () => [...reviewKeys.all, "admin"] as const,
  adminList: (params: ListAdminReviewsParams) =>
    [
      ...reviewKeys.admin(),
      params.status ?? "",
      params.productId ?? "",
      params.shopId ?? "",
      params.page ?? 1,
      params.pageSize ?? 20,
    ] as const,
};

export function useFeaturedReviews(minRating = 4, limit = 12) {
  return useQuery({
    queryKey: reviewKeys.featured(minRating, limit),
    queryFn: async () => {
      const data = await productReviewsApi.featured({ minRating, limit });
      return Array.isArray(data) ? data : [];
    },
    staleTime: 60_000,
  });
}

export function useProductReviews(
  productId: string | undefined,
  page = 1,
  pageSize = 10,
) {
  return useQuery({
    queryKey: reviewKeys.list(productId ?? "", page, pageSize),
    queryFn: async () =>
      parsePage<ProductReview>(
        await productReviewsApi.list(productId!, { page, pageSize }),
      ),
    enabled: Boolean(productId),
  });
}

export function useProductReviewSummary(productId: string | undefined) {
  return useQuery({
    queryKey: reviewKeys.summary(productId ?? ""),
    queryFn: () => productReviewsApi.summary(productId!),
    enabled: Boolean(productId),
  });
}

export function useCreateReview(productId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      body,
      images,
    }: {
      body: CreateReviewBody;
      images?: File[];
    }) => {
      const review = await productReviewsApi.create(productId, body);
      if (images?.length) {
        return productReviewsApi.uploadImages(productId, review.id, images);
      }
      return review;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: reviewKeys.product(productId) });
      toast.success(tt("toast.reviewCreated"));
    },
  });
}

export function useUpdateReview(productId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      reviewId,
      body,
      images,
    }: {
      reviewId: string;
      body: UpdateReviewBody;
      images?: File[];
    }) => {
      const review = await productReviewsApi.update(productId, reviewId, body);
      if (images?.length) {
        return productReviewsApi.uploadImages(productId, reviewId, images);
      }
      return review;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: reviewKeys.product(productId) });
      toast.success(tt("toast.reviewUpdated"));
    },
  });
}

export function useDeleteReview(productId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reviewId: string) => productReviewsApi.remove(productId, reviewId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: reviewKeys.product(productId) });
      toast.success(tt("toast.reviewDeleted"));
    },
    onError: (e) => toast.error(reviewError(e, tt("toast.reviewDeleteFailed"))),
  });
}

export function useReviewReply(productId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reviewId, body }: { reviewId: string; body: string }) =>
      productReviewsApi.reply(productId, reviewId, { body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: reviewKeys.product(productId) });
      toast.success(tt("toast.reviewReplySaved"));
    },
    onError: (e) => toast.error(getErrorMessage(e, tt("toast.reviewReplyFailed"))),
  });
}

export function useDeleteReviewReply(productId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reviewId: string) => productReviewsApi.deleteReply(productId, reviewId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: reviewKeys.product(productId) });
      toast.success(tt("toast.reviewReplyDeleted"));
    },
    onError: (e) => toast.error(getErrorMessage(e, tt("toast.reviewReplyFailed"))),
  });
}

export function useAdminReviews(params: ListAdminReviewsParams) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  return useQuery({
    queryKey: reviewKeys.adminList({ ...params, page, pageSize }),
    queryFn: async () =>
      parsePage<ProductReview>(
        await adminReviewsApi.list({
          status: params.status || undefined,
          productId: params.productId || undefined,
          shopId: params.shopId || undefined,
          page,
          pageSize,
        }),
      ),
  });
}

export function useAdminHideReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reviewId, reason }: { reviewId: string; reason?: string }) =>
      adminReviewsApi.hide(reviewId, reason ? { reason } : undefined),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: reviewKeys.admin() });
      toast.success(tt("toast.reviewHidden"));
    },
    onError: (e) => toast.error(getErrorMessage(e, tt("toast.reviewModerationFailed"))),
  });
}

export function useAdminUnhideReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reviewId: string) => adminReviewsApi.unhide(reviewId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: reviewKeys.admin() });
      toast.success(tt("toast.reviewUnhidden"));
    },
    onError: (e) => toast.error(getErrorMessage(e, tt("toast.reviewModerationFailed"))),
  });
}

function reviewError(e: unknown, fallback: string): string {
  if (e instanceof ApiError) {
    if (e.status === 409 || e.code === "REVIEW_EXISTS") {
      return tt("toast.reviewAlreadyExists");
    }
    if (e.code === "REVIEW_NOT_ELIGIBLE" || e.code === "ORDER_NOT_DELIVERED") {
      return tt("toast.reviewNotEligible");
    }
  }
  return getErrorMessage(e, fallback);
}

export type { ProductReview, ReviewSummary };
