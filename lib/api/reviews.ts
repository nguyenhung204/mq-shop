import { api } from "./client";
import type { PageMeta, Paginated } from "./types";

export type ReviewStatus = "VISIBLE" | "HIDDEN" | "DELETED" | string;

export type ProductReviewReply = {
  body: string;
  sellerId?: string;
  updatedAt?: string;
};

export type ProductReview = {
  id: string;
  productId: string;
  rating: number;
  comment?: string | null;
  images: string[];
  status?: ReviewStatus;
  createdAt: string;
  updatedAt?: string;
  buyer: { id: string; fullName?: string | null };
  reply?: ProductReviewReply | null;
  orderId?: string | null;
  shopId?: string | null;
};

export type FeaturedReviewProduct = {
  id: string;
  title: string;
  thumbnailUrl?: string | null;
  ratingAvg?: number | string;
  reviewCount?: number;
};

/** Homepage block: review + product snapshot from GET /reviews/featured */
export type FeaturedReview = ProductReview & {
  product: FeaturedReviewProduct;
};

export type FeaturedReviewsParams = {
  minRating?: number;
  limit?: number;
};

export type ReviewSummary = {
  ratingAvg: number | string;
  reviewCount: number;
  /** Keys 1–5 → counts */
  breakdown?: Record<string, number> | Partial<Record<1 | 2 | 3 | 4 | 5, number>>;
};

export type CreateReviewBody = {
  rating: number;
  comment?: string;
  orderId?: string;
};

export type UpdateReviewBody = {
  rating?: number;
  comment?: string;
};

export type ListProductReviewsParams = {
  page?: number;
  pageSize?: number;
};

export type ListAdminReviewsParams = {
  status?: string;
  productId?: string;
  shopId?: string;
  page?: number;
  pageSize?: number;
};

type PageEnvelope<T> =
  | T[]
  | { data: T[]; meta?: PageMeta }
  | Paginated<T>
  | { items: T[]; total?: number; page?: number; pageSize?: number };

export const productReviewsApi = {
  list: (productId: string, query?: ListProductReviewsParams) =>
    api.get<PageEnvelope<ProductReview>>(`/products/${productId}/reviews`, {
      query,
      withMeta: true,
      auth: false,
    }),

  featured: (query?: FeaturedReviewsParams) =>
    api.get<FeaturedReview[]>("/reviews/featured", {
      query: {
        minRating: query?.minRating ?? 4,
        limit: query?.limit ?? 12,
      },
      auth: false,
    }),

  summary: (productId: string) =>
    api.get<ReviewSummary>(`/products/${productId}/reviews/summary`, {
      auth: false,
    }),

  create: (productId: string, body: CreateReviewBody) =>
    api.post<ProductReview>(`/products/${productId}/reviews`, body),

  update: (productId: string, reviewId: string, body: UpdateReviewBody) =>
    api.patch<ProductReview>(`/products/${productId}/reviews/${reviewId}`, body),

  remove: (productId: string, reviewId: string) =>
    api.delete<ProductReview>(`/products/${productId}/reviews/${reviewId}`),

  uploadImages: (productId: string, reviewId: string, files: File[]) => {
    const form = new FormData();
    for (const file of files.slice(0, 5)) {
      form.append("images", file);
    }
    return api.postForm<ProductReview>(
      `/products/${productId}/reviews/${reviewId}/images`,
      form,
    );
  },

  reply: (productId: string, reviewId: string, body: { body: string }) =>
    api.post<ProductReview>(`/products/${productId}/reviews/${reviewId}/reply`, body),

  deleteReply: (productId: string, reviewId: string) =>
    api.delete<ProductReview>(`/products/${productId}/reviews/${reviewId}/reply`),
};

export const adminReviewsApi = {
  list: (query?: ListAdminReviewsParams) =>
    api.get<PageEnvelope<ProductReview>>("/admin/reviews", {
      query,
      withMeta: true,
    }),

  hide: (reviewId: string, body?: { reason?: string }) =>
    api.post<ProductReview>(`/admin/reviews/${reviewId}/hide`, body ?? {}),

  unhide: (reviewId: string) =>
    api.post<ProductReview>(`/admin/reviews/${reviewId}/unhide`, {}),
};

export function toRatingNumber(value: number | string | null | undefined): number {
  const n = typeof value === "string" ? Number(value) : Number(value ?? 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(5, Math.round(n * 10) / 10);
}
