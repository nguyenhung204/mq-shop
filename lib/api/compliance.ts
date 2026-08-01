import { api } from "./client";
import type { PageMeta, Paginated } from "./types";

export type BackupStatus =
  | "QUEUED"
  | "RUNNING"
  | "SUCCESS"
  | "FAILED"
  | string;

export type ApiBackup = {
  id: string;
  backupType?: "FULL" | "PARTIAL" | string;
  status: BackupStatus;
  progress?: number | null;
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string | null;
  errorMessage?: string | null;
  fileName?: string | null;
  sizeBytes?: number | null;
};

export type ListBackupsParams = {
  page?: number;
  pageSize?: number;
};

export type DsarStatus =
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED"
  | "EXECUTED"
  | "DELETED"
  | string;

export type DsarSource =
  | "BUYER_SELF"
  | "SELLER_SELF"
  | "ADMIN"
  | string;

export type ApiDsarRequest = {
  id: string;
  targetUserId?: string;
  status: DsarStatus;
  /** Originating actor — SELLER_SELF when created via the seller closure endpoint. */
  source?: DsarSource | null;
  createdBy?: string | null;
  approvedBy?: string | null;
  executedBy?: string | null;
  note?: string | null;
  createdAt?: string;
  updatedAt?: string;
  approvedAt?: string | null;
  executedAt?: string | null;
  rejectedAt?: string | null;
  targetEmail?: string | null;
  targetName?: string | null;
};

/**
 * Returned in 409 SELLER_CLOSURE_BLOCKED error details.
 * Any field > 0 (or walletBalance > "0.00") is a blocking condition.
 */
export type SellerClosureBlockedDetails = {
  activeOrders: number;
  openRmas: number;
  pendingPayouts: number;
  walletBalance: string;
};

export type ListDsarParams = {
  status?: string;
  page?: number;
  pageSize?: number;
};

type PageEnvelope<T> =
  | T[]
  | { data: T[]; meta?: PageMeta }
  | Paginated<T>;

export const adminBackupApi = {
  list: (query?: ListBackupsParams) =>
    api.get<PageEnvelope<ApiBackup>>("/admin/backups", {
      query,
      withMeta: true,
    }),

  get: (id: string) => api.get<ApiBackup>(`/admin/backups/${id}`),

  /** FULL only — PARTIAL is rejected by BE (422). Requires Idempotency-Key. */
  create: (idempotencyKey: string) =>
    api.post<ApiBackup>(
      "/admin/backups",
      { backupType: "FULL" },
      { headers: { "Idempotency-Key": idempotencyKey } },
    ),

  download: (id: string) => api.getBlob(`/admin/backups/${id}/download`),
};

export const dsarApi = {
  myList: () => api.get<PageEnvelope<ApiDsarRequest>>("/users/me/dsar", { withMeta: true }),

  myCreate: (body?: { note?: string }) =>
    api.post<ApiDsarRequest>("/users/me/dsar", body ?? {}),

  /**
   * Seller account closure — POST /users/me/dsar/seller.
   * Requires SELLER role + ACTIVE account.
   * Throws ApiError 409 with code SELLER_CLOSURE_BLOCKED when there are
   * active orders / open RMAs / pending payouts / non-zero wallet balance.
   */
  sellerCreate: (body?: { note?: string }) =>
    api.post<ApiDsarRequest>("/users/me/dsar/seller", body ?? {}),
};

export const adminDsarApi = {
  list: (query?: ListDsarParams) =>
    api.get<PageEnvelope<ApiDsarRequest>>("/admin/dsar", {
      query,
      withMeta: true,
    }),

  create: (body: { targetUserId: string; note?: string }) =>
    api.post<ApiDsarRequest>("/admin/dsar", body),

  approve: (id: string) => api.post<ApiDsarRequest>(`/admin/dsar/${id}/approve`, {}),

  reject: (id: string) => api.post<ApiDsarRequest>(`/admin/dsar/${id}/reject`, {}),

  execute: (id: string) => api.post<ApiDsarRequest>(`/admin/dsar/${id}/execute`, {}),
};

export function isBackupInProgress(status: string | undefined): boolean {
  return status === "QUEUED" || status === "RUNNING";
}
