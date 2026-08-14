import { api } from "./client";
import type { PageMeta, Paginated } from "./types";

export type Wallet = {
  id: string;
  userId: string;
  availableBalance: string;
  frozenBalance: string;
  currency: "USD" | string;
  updatedAt: string;
};

export type WalletTxReason =
  | "P2P"
  | "WITHDRAW_FREEZE"
  | "WITHDRAW_RELEASE"
  | "WITHDRAW_COMPLETE"
  | "REFERRAL"
  | "TEAM"
  | "GLOBAL"
  | "LOYALTY"
  | "ADJUST"
  | "SELLER_PAYOUT";

export type WalletTxDirection = "IN" | "OUT";

export type WalletTransaction = {
  id: string;
  direction: WalletTxDirection;
  reason: WalletTxReason | string;
  amount: string;
  availableAfter: string;
  frozenAfter: string;
  counterpartyUserId?: string | null;
  refType?: string | null;
  refId?: string | null;
  meta?: Record<string, unknown> | null;
  createdAt: string;
};

export type ListWalletTransactionsParams = {
  page?: number;
  pageSize?: number;
  reason?: WalletTxReason | string;
};

export type ConfirmWalletPinBody = {
  otp: string;
  pin: string;
  confirmPin: string;
};

export type TransferPreviewBody =
  | { email: string }
  | { userId: string };

export type TransferPreviewResult = {
  userId: string;
  email: string;
  fullName: string | null;
};

/** ACTIVE downline for P2P picker — `GET /wallet/transfer/recipients`. */
export type TransferRecipient = {
  userId: string;
  email: string | null;
  fullName: string | null;
  depth?: number;
  mlmRank?: number | null;
};

export type ListTransferRecipientsParams = {
  q?: string;
  maxDepth?: number;
  limit?: number;
};

export type TransferBody = {
  email?: string;
  userId?: string;
  amount: number;
  pin: string;
};

export type BankInfo = {
  bankName: string;
  accountNumber: string;
  accountName: string;
};

export type WithdrawBody = {
  amount: number;
  pin: string;
  bankInfo: BankInfo;
};

export type PayoutRequestStatus =
  | "PENDING"
  | "APPROVED"
  | "COMPLETED"
  | "REJECTED"
  | "PAY_FAILED";

export type UserPayoutRequest = {
  id: string;
  userId: string;
  amount: string;
  /** Wallet currency — new rows use PTS. */
  currency?: string;
  /** Snapshot fiat TWD equivalent at withdraw time (PTS → TWD via FX). */
  fiatAmount?: string | null;
  status: PayoutRequestStatus;
  bankInfo?: BankInfo | null;
  rejectionReason?: string | null;
  gatewayRef?: string | null;
  createdAt: string;
  updatedAt?: string;
};

export type ListWalletWithdrawalsParams = {
  status?: PayoutRequestStatus;
  page?: number;
  pageSize?: number;
};

export type ListAdminWalletPayoutsParams = {
  status?: PayoutRequestStatus;
  userId?: string;
  q?: string;
  page?: number;
  pageSize?: number;
};

type TxListRes =
  | WalletTransaction[]
  | { data: WalletTransaction[]; meta?: PageMeta }
  | Paginated<WalletTransaction>;

type PayoutListRes =
  | UserPayoutRequest[]
  | { data: UserPayoutRequest[]; meta?: PageMeta }
  | Paginated<UserPayoutRequest>;

/** Personal wallet — `VIEW_WALLET` / `SET_WALLET_PIN` / `TRANSFER_P2P` / `CREATE_PAYOUT`. */
export const walletApi = {
  get: () => api.get<Wallet>("/wallet"),
  transactions: (query?: ListWalletTransactionsParams) =>
    api.get<TxListRes>("/wallet/transactions", { query, withMeta: true }),
  requestPinOtp: () => api.post<unknown>("/wallet/pin/request-otp", {}),
  confirmPin: (body: ConfirmWalletPinBody) =>
    api.post<unknown>("/wallet/pin/confirm", body),
  transferPreview: (body: TransferPreviewBody) =>
    api.post<TransferPreviewResult>("/wallet/transfer/preview", body),
  /**
   * ACTIVE downline picker for P2P (`TRANSFER_P2P`).
   * Not a marketplace-wide user search — use email for users outside the tree.
   */
  transferRecipients: (query?: ListTransferRecipientsParams) =>
    api.get<
      | TransferRecipient[]
      | { data: TransferRecipient[] }
      | Paginated<TransferRecipient>
    >("/wallet/transfer/recipients", { query }),
  transfer: (body: TransferBody, idempotencyKey: string) =>
    api.post<unknown>("/wallet/transfer", body, {
      headers: { "Idempotency-Key": idempotencyKey },
    }),
  withdraw: (body: WithdrawBody, idempotencyKey: string) =>
    api.post<UserPayoutRequest>("/wallet/withdraw", body, {
      headers: { "Idempotency-Key": idempotencyKey },
    }),
  /** Own withdrawal requests — `VIEW_WALLET`. */
  listWithdrawals: (query?: ListWalletWithdrawalsParams) =>
    api.get<PayoutListRes>("/wallet/withdrawals", { query, withMeta: true }),
  getWithdrawal: (payoutId: string) =>
    api.get<UserPayoutRequest>(`/wallet/withdrawals/${payoutId}`),
};

/** Admin personal wallet payouts — `APPROVE_PAYOUT` / `PROCESS_PAYOUT`. */
export const adminWalletPayoutApi = {
  list: (query?: ListAdminWalletPayoutsParams) =>
    api.get<PayoutListRes>("/admin/wallet/payouts", { query, withMeta: true }),
  get: (payoutId: string) =>
    api.get<UserPayoutRequest>(`/admin/wallet/payouts/${payoutId}`),
  approve: (id: string) =>
    api.post<UserPayoutRequest>(`/admin/wallet/payouts/${id}/approve`, {}),
  reject: (id: string, body: { reason: string }) =>
    api.post<UserPayoutRequest>(`/admin/wallet/payouts/${id}/reject`, body),
  process: (id: string, idempotencyKey: string) =>
    api.post<UserPayoutRequest>(`/admin/wallet/payouts/${id}/process`, {}, {
      headers: { "Idempotency-Key": idempotencyKey },
    }),
};

export type AdjustWalletBody = {
  userId: string;
  /** Positive credits available; negative debits (must leave balance ≥ 0). */
  amount: number;
  note?: string;
};

export type AdjustWalletResult = {
  wallet?: Wallet;
  availableBalance?: string;
  frozenBalance?: string;
  transaction?: WalletTransaction;
  userId?: string;
};

/** Admin wallet balance adjust — `ADJUST_POINTS`. */
export const adminWalletApi = {
  adjust: (body: AdjustWalletBody) =>
    api.post<AdjustWalletResult | Wallet>("/admin/wallet/adjust", body),
};
