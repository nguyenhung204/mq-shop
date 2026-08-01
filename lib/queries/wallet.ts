"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  adminWalletApi,
  adminWalletPayoutApi,
  walletApi,
  type AdjustWalletBody,
  type ConfirmWalletPinBody,
  type ListAdminWalletPayoutsParams,
  type ListTransferRecipientsParams,
  type ListWalletTransactionsParams,
  type ListWalletWithdrawalsParams,
  type TransferBody,
  type TransferPreviewBody,
  type TransferRecipient,
  type UserPayoutRequest,
  type WalletTransaction,
  type WithdrawBody,
} from "@/lib/api/wallet";
import {
  adminMlmApi,
  mlmApi,
  type CommissionReport,
  type CommissionRow,
  type ListCommissionsParams,
  type ListNetworkTreeParams,
  type SetMlmRankBody,
  type SetMlmReferralRateBody,
  type SetMlmReferrerBody,
  type UpdateRankConfigBody,
} from "@/lib/api/mlm";
import { ApiError } from "@/lib/api/client";
import { createIdempotencyKeyStore } from "@/lib/api/idempotency";
import { asArray, parsePage } from "@/lib/api/utils";
import { tt } from "@/lib/i18n/tt";
import { getErrorMessage } from "@/lib/queries/utils";

export const walletKeys = {
  all: ["wallet"] as const,
  balance: () => [...walletKeys.all, "balance"] as const,
  transactions: (params: ListWalletTransactionsParams) =>
    [
      ...walletKeys.all,
      "transactions",
      params.reason ?? "",
      params.page ?? 1,
      params.pageSize ?? 20,
    ] as const,
  withdrawals: (params: ListWalletWithdrawalsParams) =>
    [
      ...walletKeys.all,
      "withdrawals",
      params.status ?? "",
      params.page ?? 1,
      params.pageSize ?? 20,
    ] as const,
  withdrawal: (id: string) => [...walletKeys.all, "withdrawal", id] as const,
  transferRecipients: (params: ListTransferRecipientsParams) =>
    [
      ...walletKeys.all,
      "transfer-recipients",
      params.q ?? "",
      params.maxDepth ?? 20,
      params.limit ?? 50,
    ] as const,
  dashboard: () => [...walletKeys.all, "dashboard"] as const,
};

export const mlmKeys = {
  all: ["mlm"] as const,
  referralLink: () => [...mlmKeys.all, "referral-link"] as const,
  networkTree: (params: ListNetworkTreeParams = {}) =>
    [
      ...mlmKeys.all,
      "network-tree",
      params.userId ?? "",
      params.maxDepth ?? 20,
      params.limit ?? 500,
    ] as const,
  commissions: (params: ListCommissionsParams) =>
    [
      ...mlmKeys.all,
      "commissions",
      params.type ?? "",
      params.page ?? 1,
      params.pageSize ?? 20,
    ] as const,
  ranks: () => [...mlmKeys.all, "ranks"] as const,
  rankProgress: () => [...mlmKeys.all, "rank-progress"] as const,
  monthlyOverview: (monthsBack = 12) =>
    [...mlmKeys.all, "monthly-overview", monthsBack] as const,
  commissionReport: (yearMonth?: string) =>
    [...mlmKeys.all, "commission-report", yearMonth ?? ""] as const,
};

export const adminWalletKeys = {
  all: ["admin-wallet"] as const,
  payouts: (params: ListAdminWalletPayoutsParams) =>
    [
      ...adminWalletKeys.all,
      "payouts",
      params.status ?? "",
      params.userId ?? "",
      params.page ?? 1,
      params.pageSize ?? 20,
    ] as const,
  payout: (id: string) => [...adminWalletKeys.all, "payout", id] as const,
};

function walletErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof ApiError) {
    switch (e.code) {
      case "WALLET_NOT_FOUND":
        return tt("toast.walletNotFound");
      case "WALLET_PIN_REQUIRED":
        return tt("toast.walletPinRequired");
      case "WALLET_PIN_INVALID":
        return tt("toast.walletPinInvalid");
      case "WALLET_INSUFFICIENT_BALANCE":
        return tt("toast.walletInsufficientBalance");
      case "WALLET_TRANSFER_SELF":
        return tt("toast.walletTransferSelf");
      case "WALLET_RECIPIENT_NOT_FOUND":
        return tt("toast.walletRecipientNotFound");
      case "WALLET_RECIPIENT_USE_EMAIL":
        return tt("toast.walletRecipientUseEmail");
      case "MLM_TREE_TOO_LARGE":
        return tt("toast.mlmTreeTooLarge");
      case "MLM_USER_PAYOUT_NOT_FOUND":
        return tt("toast.mlmUserPayoutNotFound");
      case "MLM_USER_PAYOUT_INVALID_STATUS":
        return tt("toast.mlmUserPayoutInvalidStatus");
      case "MLM_RANK_INVALID":
        return tt("toast.mlmRankInvalid");
      case "INVALID_OTP":
        return tt("toast.invalidOtp");
      case "REFERRER_NOT_FOUND":
        return tt("toast.referrerNotFound");
      case "REFERRER_INVALID":
        return tt("toast.referrerInvalid");
      case "FORBIDDEN":
        return tt("toast.accessDenied");
      case "IDEMPOTENCY_KEY_REQUIRED":
        return tt("toast.idempotencyKeyRequired");
      case "IDEMPOTENCY_KEY_REUSE_MISMATCH":
        return tt("toast.idempotencyKeyReuseMismatch");
      case "IDEMPOTENCY_REQUEST_IN_PROGRESS":
        return tt("toast.idempotencyRequestInProgress");
      default:
        break;
    }
  }
  return getErrorMessage(e, fallback);
}

function onWalletIdempotencyError(
  e: unknown,
  idempotency: ReturnType<typeof createIdempotencyKeyStore>,
) {
  if (e instanceof ApiError && e.code === "IDEMPOTENCY_KEY_REUSE_MISMATCH") {
    idempotency.invalidate();
  }
}

export function useWallet() {
  return useQuery({
    queryKey: walletKeys.balance(),
    queryFn: () => walletApi.get(),
  });
}

export function useWalletTransactions(params: ListWalletTransactionsParams = {}) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  return useQuery({
    queryKey: walletKeys.transactions({ ...params, page, pageSize }),
    queryFn: async () =>
      parsePage<WalletTransaction>(
        await walletApi.transactions({ ...params, page, pageSize }),
      ),
  });
}

export function useReferralLink() {
  return useQuery({
    queryKey: mlmKeys.referralLink(),
    queryFn: () => mlmApi.referralLink(),
  });
}

export function useNetworkTree(
  params: ListNetworkTreeParams = {},
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: mlmKeys.networkTree(params),
    queryFn: () => mlmApi.networkTree(params),
    enabled: options?.enabled ?? true,
  });
}

export function useCommissions(params: ListCommissionsParams = {}) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  return useQuery({
    queryKey: mlmKeys.commissions({ ...params, page, pageSize }),
    queryFn: async () =>
      parsePage<CommissionRow>(
        await mlmApi.commissions({ ...params, page, pageSize }),
      ),
  });
}

export function useRankProgress(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: mlmKeys.rankProgress(),
    queryFn: () => mlmApi.rankProgress(),
    enabled: options?.enabled ?? true,
    // Event-driven refresh (SSE / DELIVERED / admin). Do not poll hourly.
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}

/** Dashboard aggregate — balance + referral + network (Phase 0 bridge). */
export function useWalletDashboard() {
  return useQuery({
    queryKey: walletKeys.dashboard(),
    queryFn: async () => {
      const [balance, referral, network] = await Promise.all([
        walletApi.get(),
        mlmApi.referralLink().catch(() => null),
        mlmApi.networkTree().catch(() => null),
      ]);
      return { balance, referral, network };
    },
  });
}

export function useRequestWalletPinOtp() {
  return useMutation({
    mutationFn: () => walletApi.requestPinOtp(),
    onSuccess: () => toast.success(tt("toast.walletPinOtpSent")),
  });
}

export function useConfirmWalletPin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ConfirmWalletPinBody) => walletApi.confirmPin(body),
    onSuccess: () => {
      toast.success(tt("toast.walletPinSet"));
      void qc.invalidateQueries({ queryKey: walletKeys.all });
    },
  });
}

export function useTransferPreview() {
  return useMutation({
    mutationFn: (body: TransferPreviewBody) => walletApi.transferPreview(body),
  });
}

export function useTransferRecipients(
  params: ListTransferRecipientsParams = {},
  options?: { enabled?: boolean },
) {
  const maxDepth = params.maxDepth ?? 20;
  const limit = params.limit ?? 50;
  const q = params.q?.trim() || undefined;
  return useQuery({
    queryKey: walletKeys.transferRecipients({ q, maxDepth, limit }),
    queryFn: async () =>
      asArray<TransferRecipient>(
        await walletApi.transferRecipients({ q, maxDepth, limit }),
      ),
    enabled: options?.enabled ?? true,
  });
}

export function useWalletTransfer() {
  const qc = useQueryClient();
  const idempotency = useMemo(() => createIdempotencyKeyStore(), []);
  return useMutation({
    mutationFn: (body: TransferBody) =>
      walletApi.transfer(body, idempotency.keyFor(body)),
    onSuccess: () => {
      idempotency.invalidate();
      toast.success(tt("toast.walletTransferOk"));
      void qc.invalidateQueries({ queryKey: walletKeys.all });
    },
    onError: (e) => {
      onWalletIdempotencyError(e, idempotency);
    },
  });
}

export function useWalletWithdraw() {
  const qc = useQueryClient();
  const idempotency = useMemo(() => createIdempotencyKeyStore(), []);
  return useMutation({
    mutationFn: (body: WithdrawBody) =>
      walletApi.withdraw(body, idempotency.keyFor(body)),
    onSuccess: () => {
      idempotency.invalidate();
      toast.success(tt("toast.walletWithdrawSubmitted"));
      void qc.invalidateQueries({ queryKey: walletKeys.all });
    },
    onError: (e) => {
      onWalletIdempotencyError(e, idempotency);
    },
  });
}

export function useWalletWithdrawals(params: ListWalletWithdrawalsParams = {}) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  return useQuery({
    queryKey: walletKeys.withdrawals({ ...params, page, pageSize }),
    queryFn: async () =>
      parsePage<UserPayoutRequest>(
        await walletApi.listWithdrawals({ ...params, page, pageSize }),
      ),
  });
}

export function useWalletWithdrawal(payoutId: string) {
  return useQuery({
    queryKey: walletKeys.withdrawal(payoutId),
    queryFn: () => walletApi.getWithdrawal(payoutId),
    enabled: Boolean(payoutId),
  });
}

export function useAdminWalletPayouts(params: ListAdminWalletPayoutsParams = {}) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  return useQuery({
    queryKey: adminWalletKeys.payouts({ ...params, page, pageSize }),
    queryFn: async () =>
      parsePage<UserPayoutRequest>(
        await adminWalletPayoutApi.list({ ...params, page, pageSize }),
      ),
  });
}

export function useAdminWalletPayout(payoutId: string) {
  return useQuery({
    queryKey: adminWalletKeys.payout(payoutId),
    queryFn: () => adminWalletPayoutApi.get(payoutId),
    enabled: Boolean(payoutId),
  });
}

export function useApproveWalletPayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminWalletPayoutApi.approve(id),
    onSuccess: () => {
      toast.success(tt("toast.walletPayoutApproved"));
      void qc.invalidateQueries({ queryKey: adminWalletKeys.all });
    },
    onError: (e) =>
      toast.error(walletErrorMessage(e, tt("toast.walletPayoutApproveFailed"))),
  });
}

export function useAdjustWalletBalance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AdjustWalletBody) => adminWalletApi.adjust(body),
    onSuccess: () => {
      toast.success(tt("toast.walletAdjustOk"));
      void qc.invalidateQueries({ queryKey: walletKeys.all });
      void qc.invalidateQueries({ queryKey: adminWalletKeys.all });
    },
    onError: (e) =>
      toast.error(walletErrorMessage(e, tt("toast.walletAdjustFailed"))),
  });
}

export function useRejectWalletPayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      adminWalletPayoutApi.reject(id, { reason }),
    onSuccess: () => {
      toast.success(tt("toast.walletPayoutRejected"));
      void qc.invalidateQueries({ queryKey: adminWalletKeys.all });
    },
    onError: (e) =>
      toast.error(walletErrorMessage(e, tt("toast.walletPayoutRejectFailed"))),
  });
}

export function useProcessWalletPayout() {
  const qc = useQueryClient();
  const idempotency = useMemo(() => createIdempotencyKeyStore(), []);
  return useMutation({
    mutationFn: (id: string) =>
      adminWalletPayoutApi.process(
        id,
        idempotency.keyFor({ payoutId: id, action: "process" }),
      ),
    onSuccess: () => {
      idempotency.invalidate();
      toast.success(tt("toast.walletPayoutProcessed"));
      void qc.invalidateQueries({ queryKey: adminWalletKeys.all });
    },
    onError: (e) => {
      onWalletIdempotencyError(e, idempotency);
      toast.error(walletErrorMessage(e, tt("toast.walletPayoutProcessFailed")));
    },
  });
}

export function useMlmRanks(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: mlmKeys.ranks(),
    queryFn: () => adminMlmApi.ranks(),
    enabled: options?.enabled ?? true,
  });
}

export function useMonthlyCommissionOverview(
  monthsBack = 12,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: mlmKeys.monthlyOverview(monthsBack),
    queryFn: async () => {
      const res = await adminMlmApi.monthlyOverview({ monthsBack });
      const months = Array.isArray(res?.months) ? res.months : [];
      return { months };
    },
    enabled: options?.enabled ?? true,
  });
}

export function useSetMlmRank() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, body }: { userId: string; body: SetMlmRankBody }) =>
      adminMlmApi.setUserRank(userId, body),
    onSuccess: () => {
      toast.success(tt("toast.mlmRankUpdated"));
      void qc.invalidateQueries({ queryKey: mlmKeys.all });
      void qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e) => toast.error(walletErrorMessage(e, tt("toast.mlmRankUpdateFailed"))),
  });
}

export function useUpdateRankConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ rank, body }: { rank: number; body: UpdateRankConfigBody }) =>
      adminMlmApi.updateRankConfig(rank, body),
    onSuccess: () => {
      toast.success(tt("toast.mlmRankConfigUpdated"));
      void qc.invalidateQueries({ queryKey: mlmKeys.ranks() });
    },
    onError: (e) => toast.error(walletErrorMessage(e, tt("toast.mlmRankConfigUpdateFailed"))),
  });
}

export function useRunMonthlyCommissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body?: { yearMonth?: string }) => adminMlmApi.runMonthly(body),
    onSuccess: (data) => {
      toast.success(
        tt("toast.mlmMonthlyRan", {
          yearMonth: data?.yearMonth ?? "",
        }),
      );
      void qc.invalidateQueries({ queryKey: mlmKeys.all });
      void qc.invalidateQueries({ queryKey: walletKeys.all });
    },
    onError: (e) =>
      toast.error(walletErrorMessage(e, tt("toast.mlmMonthlyRunFailed"))),
  });
}

export function useReconcileMlmRanks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body?: { userId?: string; limit?: number }) =>
      adminMlmApi.reconcileRanks(body),
    onSuccess: (data) => {
      if (data && "checked" in data) {
        toast.success(
          tt("toast.mlmReconcileBatch", {
            checked: String(data.checked),
            promoted: String(data.promotedUsers?.length ?? 0),
          }),
        );
      } else if (data && "promoted" in data) {
        toast.success(
          data.promoted
            ? tt("toast.mlmReconcilePromoted", {
                from: String(data.fromRank),
                to: String(data.toRank),
              })
            : tt("toast.mlmReconcileNoChange"),
        );
      } else {
        toast.success(tt("toast.mlmReconcileDone"));
      }
      void qc.invalidateQueries({ queryKey: mlmKeys.all });
      void qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e) =>
      toast.error(walletErrorMessage(e, tt("toast.mlmReconcileFailed"))),
  });
}

export function useSetMlmReferrer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      body,
    }: {
      userId: string;
      body: SetMlmReferrerBody;
    }) => adminMlmApi.setUserReferrer(userId, body),
    onSuccess: () => {
      toast.success(tt("toast.mlmReferrerUpdated"));
      void qc.invalidateQueries({ queryKey: mlmKeys.all });
      void qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e) =>
      toast.error(walletErrorMessage(e, tt("toast.mlmReferrerUpdateFailed"))),
  });
}

export function useSetMlmReferralRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      body,
    }: {
      userId: string;
      body: SetMlmReferralRateBody;
    }) => adminMlmApi.setUserReferralRate(userId, body),
    onSuccess: () => {
      toast.success(tt("toast.mlmReferralRateUpdated"));
      void qc.invalidateQueries({ queryKey: mlmKeys.all });
      void qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e) =>
      toast.error(walletErrorMessage(e, tt("toast.mlmReferralRateUpdateFailed"))),
  });
}

export function useCommissionReport(yearMonth?: string) {
  return useQuery<CommissionReport>({
    queryKey: mlmKeys.commissionReport(yearMonth),
    queryFn: () => adminMlmApi.commissionReport(yearMonth ? { yearMonth } : {}),
  });
}
