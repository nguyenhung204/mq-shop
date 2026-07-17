"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminApi, financeApi } from "@/lib/api";
import type { ApiBanner, ApiProduct, ApiRma, ApiShop, LocalizedText } from "@/lib/api/types";
import { asArray } from "@/lib/api/utils";
import { getErrorMessage } from "@/lib/queries/utils";

export const adminKeys = {
  all: ["admin"] as const,
  shops: (status: string) => [...adminKeys.all, "shops", status] as const,
  products: (status: string) => [...adminKeys.all, "products", status] as const,
  rma: () => [...adminKeys.all, "rma"] as const,
  finance: () => [...adminKeys.all, "finance"] as const,
  banners: () => [...adminKeys.all, "banners"] as const,
};

export type FinanceBatch = { id: string; status?: string; netAmountUsd?: string | number };
export type FinanceWithdraw = { id: string; status?: string; amountPoints?: string | number };
export type FinanceGateway = { id: string; gatewayName?: string; status?: string; createdBy?: string };

export function useAdminShops(status: string) {
  return useQuery({
    queryKey: adminKeys.shops(status),
    queryFn: async () => asArray<ApiShop>(await adminApi.shops(status)),
  });
}

export function useAdminProducts(status: string) {
  return useQuery({
    queryKey: adminKeys.products(status),
    queryFn: async () => asArray<ApiProduct>(await adminApi.products(status)),
  });
}

export function useAdminRma() {
  return useQuery({
    queryKey: adminKeys.rma(),
    queryFn: async () => asArray<ApiRma>(await adminApi.rma()),
  });
}
//trigger build
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

export function useAdminBanners() {
  return useQuery({
    queryKey: adminKeys.banners(),
    queryFn: async () => asArray<ApiBanner>(await adminApi.banners()),
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
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}

export function useRejectShop() {
  const invalidate = useAdminInvalidate();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: LocalizedText }) =>
      adminApi.rejectShop(id, { reason }),
    onSuccess: () => {
      invalidate();
      toast.success("Shop rejected");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}

export function useSuspendShop() {
  const invalidate = useAdminInvalidate();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: LocalizedText }) =>
      adminApi.suspendShop(id, { reason }),
    onSuccess: () => {
      invalidate();
      toast.success("Shop suspended");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}

export function useApproveProduct() {
  const invalidate = useAdminInvalidate();
  return useMutation({
    mutationFn: (id: string) => adminApi.approveProduct(id),
    onSuccess: () => {
      invalidate();
      toast.success("Product approved");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}

export function useRejectProduct() {
  const invalidate = useAdminInvalidate();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: LocalizedText }) =>
      adminApi.rejectProduct(id, { reason }),
    onSuccess: () => {
      invalidate();
      toast.success("Product rejected");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
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

export function useAdminRmaDecision() {
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
    }) => adminApi.rmaDecision(id, { decision, reason }),
    onSuccess: (_, { decision }) => {
      invalidate();
      toast.success(decision === "APPROVED" ? "RMA approved" : "RMA rejected");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
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

export function useCreateBanner() {
  const invalidate = useAdminInvalidate();
  return useMutation({
    mutationFn: (body: unknown) => adminApi.createBanner(body),
    onSuccess: () => {
      invalidate();
      toast.success("Banner created");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}

export function useToggleBanner() {
  const invalidate = useAdminInvalidate();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      adminApi.updateBanner(id, { isActive }),
    onSuccess: () => {
      invalidate();
      toast.success("Banner updated");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}

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
  return useMutation({
    mutationFn: (body: { email: string; password: string; permissions: string[] }) =>
      adminApi.createStaff(body),
    onSuccess: () => toast.success("Staff created (may need Super Admin approve)"),
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}

export function useAdminOrderAction() {
  return useMutation({
    mutationFn: async ({
      action,
      orderId,
    }: {
      action: "confirmCod" | "forceCancel";
      orderId: string;
    }) => {
      if (action === "confirmCod") return adminApi.confirmCod(orderId);
      return adminApi.forceCancelOrder(orderId, { reason: "Admin force cancel" });
    },
    onSuccess: (_, { action }) => {
      toast.success(
        action === "confirmCod" ? "COD confirmed" : "Force cancelled (audit logged on BE)",
      );
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}
