"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminApi, adminStaffApi, financeApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import type { Banner } from "@/lib/api/promotions";
import type { ApiProduct, ApiShop, AuthUser, StaffPoolRole, StaffRole } from "@/lib/api/types";
import { asArray, parsePage } from "@/lib/api/utils";
import { getErrorMessage } from "@/lib/queries/utils";
import {
  useCreateBannerMultipart,
  useDeleteBanner,
  useUpdateBannerMultipart,
} from "@/lib/queries/promotions";

export {
  useAdminRma,
  useAdminRmaDetail,
  useAdminRmaDecision,
  useAdminRmaMarkRefunded,
  useAdminOrders,
  useAdminCancelOrder,
  useAdminCheckout,
  useAdminShippingQuote,
} from "@/lib/queries/orders";

export const adminKeys = {
  all: ["admin"] as const,
  shops: (status: string, page: number) => [...adminKeys.all, "shops", status, page] as const,
  shop: (id: string) => [...adminKeys.all, "shop", id] as const,
  products: (status: string, page: number, pageSize = 20) =>
    [...adminKeys.all, "products", status, page, pageSize] as const,
  finance: () => [...adminKeys.all, "finance"] as const,
  banners: () => [...adminKeys.all, "banners"] as const,
  bannersLang: (lang: string, page: number) =>
    [...adminKeys.all, "banners", lang, page] as const,
};

export type FinanceBatch = { id: string; status?: string; netAmountUsd?: string | number };
export type FinanceWithdraw = { id: string; status?: string; amountPoints?: string | number };
export type FinanceGateway = { id: string; gatewayName?: string; status?: string; createdBy?: string };

function shopActionError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === "SHOP_NOT_PENDING") return "Shop is not PENDING — cannot approve/reject.";
    if (e.code === "SHOP_NOT_APPROVED") return "Shop is not APPROVED — cannot violation-lock.";
  }
  return getErrorMessage(e);
}

export function useAdminShops(status: string, page = 1, pageSize = 20) {
  return useQuery({
    queryKey: adminKeys.shops(status, page),
    queryFn: async () => parsePage<ApiShop>(await adminApi.shops(status, page, pageSize)),
  });
}

export function useAdminShop(id: string) {
  return useQuery({
    queryKey: adminKeys.shop(id),
    queryFn: async () => {
      const res = await adminApi.shop(id);
      return res as ApiShop;
    },
    enabled: Boolean(id),
  });
}

export function useAdminProducts(status: string, page = 1, pageSize = 20) {
  return useQuery({
    queryKey: adminKeys.products(status, page, pageSize),
    queryFn: async () => parsePage<ApiProduct>(await adminApi.products(status, page, pageSize)),
  });
}

export function useAdminFinance() {
  return useQuery({
    queryKey: adminKeys.finance(),
    queryFn: async () => {
      const [batches, withdraws, gateways] = await Promise.all([
        financeApi.payoutBatches(),
        financeApi.withdrawRequests(),
        financeApi.gateways(),
      ]);
      return {
        batches: asArray<FinanceBatch>(batches),
        withdraws: asArray<FinanceWithdraw>(withdraws),
        gateways: asArray<FinanceGateway>(gateways),
      };
    },
  });
}

export function useAdminBanners(lang?: string, page = 1, pageSize = 20) {
  return useQuery({
    queryKey: adminKeys.bannersLang(lang ?? "", page),
    queryFn: async () =>
      parsePage<Banner>(
        await adminApi.banners({
          lang,
          page,
          pageSize,
        }),
      ),
  });
}

function useAdminInvalidate() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: adminKeys.all });
}

export function useApproveShop() {
  const invalidate = useAdminInvalidate();
  return useMutation({
    mutationFn: (id: string) => adminApi.approveShop(id),
    onSuccess: () => {
      invalidate();
      toast.success("Shop approved");
    },
    onError: (e) => toast.error(shopActionError(e)),
  });
}

export function useRejectShop() {
  const invalidate = useAdminInvalidate();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      adminApi.rejectShop(id, { reason }),
    onSuccess: () => {
      invalidate();
      toast.success("Shop rejected");
    },
    onError: (e) => toast.error(shopActionError(e)),
  });
}

export function useSuspendShop() {
  const invalidate = useAdminInvalidate();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      adminApi.suspendShop(id, reason ? { reason } : undefined),
    onSuccess: () => {
      invalidate();
      toast.success("Shop locked (violation)");
    },
    onError: (e) => toast.error(shopActionError(e)),
  });
}

function productActionError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === "PRODUCT_NOT_PENDING") {
      return "Product is not PENDING — cannot approve/reject.";
    }
    if (e.code === "PRODUCT_NOT_HIDDEN") {
      return "Product is not hidden.";
    }
  }
  return getErrorMessage(e);
}

export function useApproveProduct() {
  const invalidate = useAdminInvalidate();
  return useMutation({
    mutationFn: (id: string) => adminApi.approveProduct(id),
    onSuccess: () => {
      invalidate();
      toast.success("Product approved");
    },
    onError: (e) => toast.error(productActionError(e)),
  });
}

export function useRejectProduct() {
  const invalidate = useAdminInvalidate();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      adminApi.rejectProduct(id, { reason }),
    onSuccess: () => {
      invalidate();
      toast.success("Product rejected");
    },
    onError: (e) => toast.error(productActionError(e)),
  });
}

export function useHideAdminProduct() {
  const invalidate = useAdminInvalidate();
  return useMutation({
    mutationFn: (id: string) => adminApi.hideProduct(id),
    onSuccess: () => {
      invalidate();
      toast.success("Product hidden");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}

export function useUnhideAdminProduct() {
  const invalidate = useAdminInvalidate();
  return useMutation({
    mutationFn: (id: string) => adminApi.unhideProduct(id),
    onSuccess: () => {
      invalidate();
      toast.success("Product unhidden — pending review");
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === "PRODUCT_NOT_HIDDEN") {
        toast.error("Product is not hidden.");
        return;
      }
      toast.error(getErrorMessage(e));
    },
  });
}

export function useCreatePayoutBatch() {
  const invalidate = useAdminInvalidate();
  return useMutation({
    mutationFn: () => financeApi.createPayoutBatch({}),
    onSuccess: () => {
      invalidate();
      toast.success("Payout batch created");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}

export function useApprovePayout() {
  const invalidate = useAdminInvalidate();
  return useMutation({
    mutationFn: (id: string) => financeApi.approvePayout(id),
    onSuccess: () => {
      invalidate();
      toast.success("Payout approved");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}

export function useRejectPayout() {
  const invalidate = useAdminInvalidate();
  return useMutation({
    mutationFn: (id: string) => financeApi.rejectPayout(id, { reason: "Invalid" }),
    onSuccess: () => {
      invalidate();
      toast.success("Payout rejected");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}

export function useCompletePayout() {
  const invalidate = useAdminInvalidate();
  return useMutation({
    mutationFn: (id: string) => financeApi.completePayout(id),
    onSuccess: () => {
      invalidate();
      toast.success("Payout marked completed");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}

export function useWithdrawDecision() {
  const invalidate = useAdminInvalidate();
  return useMutation({
    mutationFn: ({
      id,
      decision,
      reason,
    }: {
      id: string;
      decision: "APPROVED" | "REJECTED";
      reason?: string;
    }) => financeApi.withdrawDecision(id, { decision, reason }),
    onSuccess: (_, { decision }) => {
      invalidate();
      toast.success(decision === "APPROVED" ? "Withdraw approved" : "Withdraw rejected");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}

export function useCompleteWithdraw() {
  const invalidate = useAdminInvalidate();
  return useMutation({
    mutationFn: (id: string) => financeApi.completeWithdraw(id),
    onSuccess: () => {
      invalidate();
      toast.success("Withdraw marked paid");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}

export function useReviewGateway() {
  const invalidate = useAdminInvalidate();
  return useMutation({
    mutationFn: ({
      id,
      decision,
      reason,
    }: {
      id: string;
      decision: "APPROVED" | "REJECTED";
      reason?: string;
    }) => financeApi.reviewGateway(id, { decision, reason }),
    onSuccess: (_, { decision }) => {
      invalidate();
      toast.success(decision === "APPROVED" ? "Gateway approved" : "Gateway rejected");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}

export function useDailyRefundReport() {
  return useMutation({
    mutationFn: () => adminApi.dailyRefundReport(),
    onSuccess: () => toast.success("Refund report loaded"),
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}

/** @deprecated Prefer `useCreateBannerMultipart` from `@/lib/queries/promotions`. */
export function useCreateBanner() {
  return useCreateBannerMultipart();
}

/** Toggle active via multipart PATCH (no image). */
export function useToggleBanner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => {
      const fd = new FormData();
      fd.append("isActive", String(isActive));
      return adminApi.updateBanner(id, fd);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.all });
      void qc.invalidateQueries({ queryKey: ["banners"] });
      toast.success("Banner updated");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}

export { useDeleteBanner, useUpdateBannerMultipart };

export function useAdminUserAction() {
  return useMutation({
    mutationFn: async ({
      action,
      userId,
    }: {
      action: "lock" | "unlock" | "delete";
      userId: string;
    }) => {
      if (action === "lock") return adminApi.lockUser(userId);
      if (action === "unlock") return adminApi.unlockUser(userId);
      return adminApi.deleteUser(userId);
    },
    onSuccess: (_, { action }) => {
      const labels = { lock: "User locked", unlock: "User unlocked", delete: "User soft-deleted" };
      toast.success(labels[action]);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}

export function useCreateStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      email: string;
      fullName?: string;
      role: StaffRole;
      shopId: string;
    }) => adminStaffApi.create(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "staff"] });
      toast.success("Staff created");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}

export function useAdminStaffList(params: {
  shopId?: string;
  role?: StaffPoolRole | "";
  page?: number;
  pageSize?: number;
}) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  return useQuery({
    queryKey: [
      "admin",
      "staff",
      params.shopId ?? "",
      params.role ?? "",
      page,
      pageSize,
    ],
    queryFn: async () =>
      parsePage<AuthUser>(
        await adminStaffApi.list({
          shopId: params.shopId || undefined,
          role: params.role || undefined,
          page,
          pageSize,
        }),
      ),
  });
}

export function useUpdateStaffRoles() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      body,
    }: {
      userId: string;
      body: {
        roles: StaffRole[];
        shopId?: string;
      };
    }) => adminStaffApi.updateRoles(userId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "staff"] });
      toast.success("Staff roles updated");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}

export function useStaffAccountAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      kind,
    }: {
      userId: string;
      kind: "lock" | "unlock" | "delete";
    }) => {
      if (kind === "lock") return adminStaffApi.lock(userId);
      if (kind === "unlock") return adminStaffApi.unlock(userId);
      return adminStaffApi.remove(userId);
    },
    onSuccess: (_d, vars) => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "staff"] });
      toast.success(
        vars.kind === "lock"
          ? "Staff locked"
          : vars.kind === "unlock"
            ? "Staff unlocked"
            : "Staff deleted",
      );
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}
