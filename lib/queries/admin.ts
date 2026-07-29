"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, adminPlatformStaffApi, adminStaffApi } from "@/lib/api";
import { adminDashboardApi } from "@/lib/api/admin-dashboard";
import { ApiError } from "@/lib/api/client";
import type { Banner } from "@/lib/api/promotions";
import type { ApiProduct, ApiShop, AuthUser, StaffPoolRole, StaffRole } from "@/lib/api/types";
import type { CreatePlatformStaffRequest } from "@/lib/api/staff";
import { parsePage } from "@/lib/api/utils";
import { tt } from "@/lib/i18n/tt";
import { getErrorMessage } from "@/lib/queries/utils";
import { actionToastError, actionToastSuccess } from "@/lib/queries/mutation-feedback";
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
  dashboard: (sections: string) => [...adminKeys.all, "dashboard", sections] as const,
  shops: (status: string, page: number) => [...adminKeys.all, "shops", status, page] as const,
  shop: (id: string) => [...adminKeys.all, "shop", id] as const,
  products: (status: string, page: number, pageSize = 20) =>
    [...adminKeys.all, "products", status, page, pageSize] as const,
  banners: () => [...adminKeys.all, "banners"] as const,
  bannersLang: (lang: string, page: number) =>
    [...adminKeys.all, "banners", lang, page] as const,
  staff: () => [...adminKeys.all, "staff"] as const,
  platformStaff: () => [...adminKeys.all, "platform-staff"] as const,
};

const ADMIN_DASHBOARD_SECTIONS = "queues,snapshot";

export function useAdminDashboard(sections = ADMIN_DASHBOARD_SECTIONS) {
  return useQuery({
    queryKey: adminKeys.dashboard(sections),
    queryFn: () => adminDashboardApi.get(sections),
    refetchInterval: 90_000,
    refetchOnWindowFocus: true,
  });
}

export function useAdminProducts(status: string, page = 1, pageSize = 20) {
  return useQuery({
    queryKey: adminKeys.products(status, page, pageSize),
    queryFn: async () => parsePage<ApiProduct>(await adminApi.products(status, page, pageSize)),
  });
}

function shopActionError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === "SHOP_NOT_PENDING") return tt("toast.shopNotPending");
    if (e.code === "SHOP_NOT_APPROVED") return tt("toast.shopNotApprovedLock");
    if (e.code === "SHOP_NOT_SUSPENDED") return tt("toast.shopNotSuspended");
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
      actionToastSuccess(tt("toast.shopApproved"));
    },
    onError: (e) => actionToastError(shopActionError(e)),
  });
}

export function useRejectShop() {
  const invalidate = useAdminInvalidate();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      adminApi.rejectShop(id, { reason }),
    onSuccess: () => {
      invalidate();
      actionToastSuccess(tt("toast.shopRejected"));
    },
    onError: (e) => actionToastError(shopActionError(e)),
  });
}

export function useSuspendShop() {
  const invalidate = useAdminInvalidate();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      adminApi.suspendShop(id, reason ? { reason } : undefined),
    onSuccess: () => {
      invalidate();
      actionToastSuccess(tt("toast.shopLocked"));
    },
    onError: (e) => actionToastError(shopActionError(e)),
  });
}

export function useUnlockShop() {
  const invalidate = useAdminInvalidate();
  return useMutation({
    mutationFn: (id: string) => adminApi.unlockShop(id),
    onSuccess: () => {
      invalidate();
      actionToastSuccess(tt("toast.shopUnlocked"));
    },
    onError: (e) => actionToastError(shopActionError(e)),
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
      actionToastSuccess(tt("toast.productApproved"));
    },
    onError: (e) => actionToastError(productActionError(e)),
  });
}

export function useRejectProduct() {
  const invalidate = useAdminInvalidate();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      adminApi.rejectProduct(id, { reason }),
    onSuccess: () => {
      invalidate();
      actionToastSuccess(tt("toast.productRejected"));
    },
    onError: (e) => actionToastError(productActionError(e)),
  });
}

export function useHideAdminProduct() {
  const invalidate = useAdminInvalidate();
  return useMutation({
    mutationFn: (id: string) => adminApi.hideProduct(id),
    onSuccess: () => {
      invalidate();
      actionToastSuccess(tt("toast.productHidden"));
    },
    onError: (e) => actionToastError(getErrorMessage(e)),
  });
}

export function useUnhideAdminProduct() {
  const invalidate = useAdminInvalidate();
  return useMutation({
    mutationFn: (id: string) => adminApi.unhideProduct(id),
    onSuccess: () => {
      invalidate();
      actionToastSuccess(tt("toast.productUnhidden"));
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === "PRODUCT_NOT_HIDDEN") {
        actionToastError(tt("toast.productNotHidden"));
        return;
      }
      actionToastError(getErrorMessage(e));
    },
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
      actionToastSuccess(tt("toast.bannerUpdated"));
    },
    onError: (e) => actionToastError(getErrorMessage(e)),
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
      actionToastSuccess(labels[action]);
    },
    onError: (e) => actionToastError(getErrorMessage(e)),
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
      actionToastSuccess(tt("toast.staffCreated"));
    },
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
      actionToastSuccess(tt("toast.staffRolesUpdated"));
    },
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
      actionToastSuccess(
        vars.kind === "approve"
          ? tt("toast.staffApproved")
          : tt("toast.staffRejected"),
      );
    },
    onError: (e) => actionToastError(getErrorMessage(e)),
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
      actionToastSuccess(
        vars.kind === "lock"
          ? tt("toast.staffLocked")
          : vars.kind === "unlock"
            ? tt("toast.staffUnlocked")
            : tt("toast.staffDeleted"),
      );
    },
    onError: (e) => actionToastError(getErrorMessage(e)),
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
      actionToastSuccess(tt("toast.platformStaffCreated"));
    },
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
      actionToastSuccess(tt("toast.platformStaffRolesUpdated"));
    },
    onError: (e) => actionToastError(getErrorMessage(e)),
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
      actionToastSuccess(
        vars.kind === "approve"
          ? tt("toast.platformStaffApproved")
          : tt("toast.platformStaffRejected"),
      );
    },
    onError: (e) => actionToastError(getErrorMessage(e)),
  });
}
