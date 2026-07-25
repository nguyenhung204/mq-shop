"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  adminWalletPayoutApi,
  walletApi,
  type ConfirmWalletPinBody,
  type ListAdminWalletPayoutsParams,
  type ListWalletTransactionsParams,
  type TransferBody,
  type TransferPreviewBody,
  type UserPayoutRequest,
  type WalletTransaction,
  type WithdrawBody,
} from "@/lib/api/wallet";
import {
  adminMlmApi,
  mlmApi,
  type CommissionRow,
  type ListCommissionsParams,
  type ListNetworkTreeParams,
  type SetMlmRankBody,
} from "@/lib/api/mlm";
import { ApiError } from "@/lib/api/client";
import { createIdempotencyKeyStore } from "@/lib/api/idempotency";
import { parsePage } from "@/lib/api/utils";
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
    onError: (e) => toast.error(walletErrorMessage(e, tt("toast.walletPinOtpFailed"))),
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
    onError: (e) => toast.error(walletErrorMessage(e, tt("toast.walletPinConfirmFailed"))),
  });
}

export function useTransferPreview() {
  return useMutation({
    mutationFn: (body: TransferPreviewBody) => walletApi.transferPreview(body),
    onError: (e) =>
      toast.error(walletErrorMessage(e, tt("toast.walletTransferPreviewFailed"))),
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
      toast.error(walletErrorMessage(e, tt("toast.walletTransferFailed")));
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
      toast.error(walletErrorMessage(e, tt("toast.walletWithdrawFailed")));
    },
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

export function useSetMlmRank() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, body }: { userId: string; body: SetMlmRankBody }) =>
      adminMlmApi.setUserRank(userId, body),
    onSuccess: () => {
      toast.success(tt("toast.mlmRankUpdated"));
      void qc.invalidateQueries({ queryKey: mlmKeys.ranks() });
    },
    onError: (e) => toast.error(walletErrorMessage(e, tt("toast.mlmRankUpdateFailed"))),
  });
}
