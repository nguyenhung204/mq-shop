"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  adminPayoutApi,
  financeConfigApi,
  financeReportApi,
  landingCostApi,
  type CreateFinanceConfigBody,
  type CreateSellerPayoutBody,
  type ExportFinanceReportBody,
  type FinanceConfig,
  type FinanceTransaction,
  type LandingCostRequest,
  type ListFinanceConfigsParams,
  type ListFinanceTransactionsParams,
  type ListSellerPayoutsParams,
  type SellerPayout,
} from "@/lib/api/finance";
import { ApiError } from "@/lib/api/client";
import { parsePage } from "@/lib/api/utils";
import { tt } from "@/lib/i18n/tt";
import { getErrorMessage } from "@/lib/queries/utils";

export const financeKeys = {
  all: ["finance"] as const,
  configs: (params: ListFinanceConfigsParams) =>
    [
      ...financeKeys.all,
      "configs",
      params.status ?? "",
      params.page ?? 1,
      params.pageSize ?? 20,
    ] as const,
  activeConfig: () => [...financeKeys.all, "active-config"] as const,
  payouts: (params: ListSellerPayoutsParams) =>
    [
      ...financeKeys.all,
      "payouts",
      params.shopId ?? "",
      params.status ?? "",
      params.page ?? 1,
      params.pageSize ?? 20,
    ] as const,
  payout: (id: string) => [...financeKeys.all, "payout", id] as const,
  transactions: (params: ListFinanceTransactionsParams) =>
    [
      ...financeKeys.all,
      "transactions",
      params.startDate ?? "",
      params.endDate ?? "",
      params.type ?? "ALL",
      params.shopId ?? "",
      params.page ?? 1,
      params.pageSize ?? 20,
    ] as const,
};

function financeErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof ApiError) {
    switch (e.code) {
      case "FINANCE_CONFIG_NOT_FOUND":
        return tt("toast.financeConfigNotFound");
      case "FINANCE_CONFIG_NOT_PENDING":
        return tt("toast.financeConfigNotPending");
      case "PAYOUT_NOT_FOUND":
        return tt("toast.payoutNotFound");
      case "PAYOUT_NOT_PENDING":
        return tt("toast.payoutNotPending");
      case "PAYOUT_NO_SETTLEMENTS":
        return tt("toast.payoutNoSettlements");
      case "SHOP_NOT_FOUND":
        return tt("toast.shopNotFound");
      case "FORBIDDEN":
        return tt("toast.accessDenied");
      default:
        break;
    }
  }
  return getErrorMessage(e, fallback);
}

/* ─── Finance config ────────────────────────────────────────────────── */

export function useFinanceConfigs(params: ListFinanceConfigsParams = {}) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  return useQuery({
    queryKey: financeKeys.configs({ ...params, page, pageSize }),
    queryFn: async () =>
      parsePage<FinanceConfig>(
        await financeConfigApi.list({ ...params, page, pageSize }),
      ),
  });
}

export function useActiveFinanceConfig(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: financeKeys.activeConfig(),
    queryFn: () => financeConfigApi.active(),
    staleTime: 60_000,
    enabled: options?.enabled ?? true,
    retry: false,
  });
}

export function useCreateFinanceConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateFinanceConfigBody) => financeConfigApi.create(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: financeKeys.all });
      toast.success(tt("toast.financeConfigSubmitted"));
    },
  });
}

export function useApproveFinanceConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => financeConfigApi.approve(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: financeKeys.all });
      toast.success(tt("toast.financeConfigApproved"));
    },
    onError: (e) =>
      toast.error(financeErrorMessage(e, tt("toast.financeConfigApproveFailed"))),
  });
}

export function useRejectFinanceConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      financeConfigApi.reject(id, { reason }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: financeKeys.all });
      toast.success(tt("toast.financeConfigRejected"));
    },
    onError: (e) =>
      toast.error(financeErrorMessage(e, tt("toast.financeConfigRejectFailed"))),
  });
}

/* ─── Seller payouts ────────────────────────────────────────────────── */

export function useAdminPayouts(params: ListSellerPayoutsParams = {}) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  return useQuery({
    queryKey: financeKeys.payouts({ ...params, page, pageSize }),
    queryFn: async () =>
      parsePage<SellerPayout>(
        await adminPayoutApi.list({ ...params, page, pageSize }),
      ),
  });
}

export function useAdminPayout(payoutId: string) {
  return useQuery({
    queryKey: financeKeys.payout(payoutId),
    queryFn: () => adminPayoutApi.get(payoutId),
    enabled: Boolean(payoutId),
  });
}

export function useCreateSellerPayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateSellerPayoutBody) => adminPayoutApi.create(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: financeKeys.all });
      void qc.invalidateQueries({ queryKey: ["settlements"] });
      toast.success(tt("toast.payoutCreated"));
    },
    onError: (e) => toast.error(financeErrorMessage(e, tt("toast.payoutCreateFailed"))),
  });
}

export function useApproveSellerPayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminPayoutApi.approve(id),
    onSuccess: (payout) => {
      void qc.invalidateQueries({ queryKey: financeKeys.all });
      void qc.invalidateQueries({ queryKey: ["settlements"] });
      toast.success(
        payout.gatewayRef
          ? tt("toast.payoutApprovedWithRef", { ref: payout.gatewayRef })
          : tt("toast.payoutApproved"),
      );
    },
    onError: (e) => toast.error(financeErrorMessage(e, tt("toast.payoutApproveFailed"))),
  });
}

export function useRejectSellerPayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      adminPayoutApi.reject(id, { reason }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: financeKeys.all });
      void qc.invalidateQueries({ queryKey: ["settlements"] });
      toast.success(tt("toast.payoutRejected"));
    },
    onError: (e) => toast.error(financeErrorMessage(e, tt("toast.payoutRejectFailed"))),
  });
}

/* ─── Landing cost ──────────────────────────────────────────────────── */

export function useCalculateLandingCost() {
  return useMutation({
    mutationFn: (body: LandingCostRequest) => landingCostApi.calculate(body),
  });
}

/* ─── Transactions & export ─────────────────────────────────────────── */

export function useFinanceTransactions(params: ListFinanceTransactionsParams = {}) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  return useQuery({
    queryKey: financeKeys.transactions({ ...params, page, pageSize }),
    queryFn: async () =>
      parsePage<FinanceTransaction>(
        await financeReportApi.transactions({ ...params, page, pageSize }),
      ),
  });
}

export function useExportFinanceReport() {
  return useMutation({
    mutationFn: (body: ExportFinanceReportBody) => financeReportApi.exportReport(body),
    onSuccess: (res) => {
      if (res.fileUrl && typeof window !== "undefined") {
        window.open(res.fileUrl, "_blank", "noopener,noreferrer");
      }
      toast.success(tt("toast.financeExportReady", { count: String(res.rowCount) }));
    },
    onError: (e) => toast.error(financeErrorMessage(e, tt("toast.financeExportFailed"))),
  });
}
