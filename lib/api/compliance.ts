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

export type ApiDsarRequest = {
  id: string;
  targetUserId?: string;
  status: DsarStatus;
  note?: string | null;
  createdAt?: string;
  updatedAt?: string;
  approvedAt?: string | null;
  executedAt?: string | null;
  rejectedAt?: string | null;
  targetEmail?: string | null;
  targetName?: string | null;
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
