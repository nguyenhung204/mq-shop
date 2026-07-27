"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminApi, adminPlatformStaffApi, adminStaffApi, financeApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import type { Banner } from "@/lib/api/promotions";
import type { ApiProduct, ApiShop, AuthUser, StaffPoolRole, StaffRole } from "@/lib/api/types";
import type { CreatePlatformStaffRequest } from "@/lib/api/staff";
import { asArray, parsePage } from "@/lib/api/utils";
import { tt } from "@/lib/i18n/tt";
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
  staff: () => [...adminKeys.all, "staff"] as const,
  platformStaff: () => [...adminKeys.all, "platform-staff"] as const,
};

export type FinanceBatch = { id: string; status?: string; netAmountUsd?: string | number };
export type FinanceWithdraw = { id: string; status?: string; amountPoints?: string | number };
export type FinanceGateway = { id: string; gatewayName?: string; status?: string; createdBy?: string };

function shopActionError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === "SHOP_NOT_PENDING") return tt("toast.shopNotPending");
    if (e.code === "SHOP_NOT_APPROVED") return tt("toast.shopNotApprovedLock");
  }
  return getErrorMessage(e);
}

export function useAdminShops(
  status: string,
  page = 1,
  pageSize = 20,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: adminKeys.shops(status, page),
    queryFn: async () => parsePage<ApiShop>(await adminApi.shops(status, page, pageSize)),
    enabled: options?.enabled ?? true,
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
  const queryClient = useQueryClient();
  const invalidate = useAdminInvalidate();
  return useMutation({
    mutationFn: (id: string) => adminApi.approveShop(id),
    onSuccess: () => {
      invalidate();
      // Shop APPROVED → seller_granted may auto-promote owner (realtime on BE).
      void queryClient.invalidateQueries({ queryKey: ["mlm"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success(tt("toast.shopApproved"));
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
      toast.success(tt("toast.shopRejected"));
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
      toast.success(tt("toast.shopLocked"));
    },
    onError: (e) => toast.error(shopActionError(e)),
  });
}

function productActionError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === "PRODUCT_NOT_PENDING") {
      return tt("toast.productNotPending");
    }
    if (e.code === "PRODUCT_NOT_HIDDEN") {
      return tt("toast.productNotHidden");
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
      toast.success(tt("toast.productApproved"));
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
      toast.success(tt("toast.productRejected"));
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
      toast.success(tt("toast.productHidden"));
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
      toast.success(tt("toast.productUnhidden"));
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === "PRODUCT_NOT_HIDDEN") {
        toast.error(tt("toast.productNotHidden"));
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
      toast.success(tt("toast.payoutBatchCreated"));
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
      toast.success(tt("toast.payoutApproved"));
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
      toast.success(tt("toast.payoutRejected"));
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
      toast.success(tt("toast.payoutCompleted"));
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
      toast.success(
        decision === "APPROVED" ? tt("toast.withdrawApproved") : tt("toast.withdrawRejected"),
      );
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
      toast.success(tt("toast.withdrawPaid"));
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
      toast.success(
        decision === "APPROVED" ? tt("toast.gatewayApproved") : tt("toast.gatewayRejected"),
      );
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}

export function useDailyRefundReport() {
  return useMutation({
    mutationFn: () => adminApi.dailyRefundReport(),
    onSuccess: () => toast.success(tt("toast.refundReportLoaded")),
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
      toast.success(tt("toast.bannerUpdated"));
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
      const labels = {
        lock: tt("toast.userLocked"),
        unlock: tt("toast.userUnlocked"),
        delete: tt("toast.userDeleted"),
      };
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
      void queryClient.invalidateQueries({ queryKey: adminKeys.staff() });
      toast.success(tt("toast.staffCreated"));
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}

export function useAdminStaffList(params: {
  shopId?: string;
  role?: StaffPoolRole | "";
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  return useQuery({
    queryKey: [
      ...adminKeys.staff(),
      params.shopId ?? "",
      params.role ?? "",
      params.status ?? "",
      page,
      pageSize,
    ],
    queryFn: async () =>
      parsePage<AuthUser>(
        await adminStaffApi.list({
          shopId: params.shopId || undefined,
          role: params.role || undefined,
          status: params.status || undefined,
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
      void queryClient.invalidateQueries({ queryKey: adminKeys.staff() });
      toast.success(tt("toast.staffRolesUpdated"));
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}

export function useStaffDualControlAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      kind,
    }: {
      userId: string;
      kind: "approve" | "reject";
    }) => {
      if (kind === "approve") return adminStaffApi.approve(userId);
      return adminStaffApi.reject(userId);
    },
    onSuccess: (_d, vars) => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.staff() });
      toast.success(
        vars.kind === "approve"
          ? tt("toast.staffApproved")
          : tt("toast.staffRejected"),
      );
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
      void queryClient.invalidateQueries({ queryKey: adminKeys.staff() });
      toast.success(
        vars.kind === "lock"
          ? tt("toast.staffLocked")
          : vars.kind === "unlock"
            ? tt("toast.staffUnlocked")
            : tt("toast.staffDeleted"),
      );
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}

export function useAdminPlatformStaffList(params: {
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  return useQuery({
    queryKey: [...adminKeys.platformStaff(), params.status ?? "", page, pageSize],
    queryFn: async () =>
      parsePage<AuthUser>(
        await adminPlatformStaffApi.list({
          status: params.status || undefined,
          page,
          pageSize,
        }),
      ),
  });
}

export function useCreatePlatformStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreatePlatformStaffRequest) =>
      adminPlatformStaffApi.create(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.platformStaff() });
      toast.success(tt("toast.platformStaffCreated"));
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}

export function useUpdatePlatformStaffRoles() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      roles,
    }: {
      userId: string;
      roles: Array<"ADMIN">;
    }) => adminPlatformStaffApi.updateRoles(userId, { roles }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.platformStaff() });
      toast.success(tt("toast.platformStaffRolesUpdated"));
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}

export function usePlatformStaffDualControlAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      kind,
    }: {
      userId: string;
      kind: "approve" | "reject";
    }) => {
      if (kind === "approve") return adminPlatformStaffApi.approve(userId);
      return adminPlatformStaffApi.reject(userId);
    },
    onSuccess: (_d, vars) => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.platformStaff() });
      toast.success(
        vars.kind === "approve"
          ? tt("toast.platformStaffApproved")
          : tt("toast.platformStaffRejected"),
      );
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}
