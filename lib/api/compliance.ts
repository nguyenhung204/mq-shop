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

export function isBackupInProgress(status: string | undefined): boolean {
  return status === "QUEUED" || status === "RUNNING";
}
