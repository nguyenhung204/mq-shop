"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminBackupApi, isBackupInProgress, type ApiBackup } from "@/lib/api/compliance";
import { ApiError } from "@/lib/api/client";
import { createIdempotencyKeyStore } from "@/lib/api/idempotency";
import { parsePage } from "@/lib/api/utils";
import { tt } from "@/lib/i18n/tt";
import { getErrorMessage } from "@/lib/queries/utils";

export const complianceKeys = {
  all: ["compliance"] as const,
  backups: () => [...complianceKeys.all, "backups"] as const,
  backupList: (page: number, pageSize: number) =>
    [...complianceKeys.backups(), "list", page, pageSize] as const,
  backup: (id: string) => [...complianceKeys.backups(), id] as const,
};

export function useAdminBackups(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: complianceKeys.backupList(page, pageSize),
    queryFn: async () =>
      parsePage<ApiBackup>(await adminBackupApi.list({ page, pageSize })),
    refetchInterval: (query) => {
      const items = query.state.data?.items ?? [];
      return items.some((b) => isBackupInProgress(b.status)) ? 2500 : false;
    },
  });
}

export function useAdminBackup(id: string | undefined) {
  return useQuery({
    queryKey: complianceKeys.backup(id ?? ""),
    queryFn: () => adminBackupApi.get(id!),
    enabled: Boolean(id),
    refetchInterval: (query) =>
      isBackupInProgress(query.state.data?.status) ? 2000 : false,
  });
}

export function useCreateBackup() {
  const queryClient = useQueryClient();
  const idempotency = useMemo(() => createIdempotencyKeyStore(), []);

  return useMutation({
    mutationFn: () => {
      const key = idempotency.keyFor({ backupType: "FULL" });
      return adminBackupApi.create(key);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: complianceKeys.backups() });
      toast.success(tt("toast.backupStarted"));
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 409) {
        toast.error(tt("toast.backupAlreadyRunning"));
        return;
      }
      if (e instanceof ApiError && e.code === "IDEMPOTENCY_KEY_REUSE_MISMATCH") {
        idempotency.invalidate();
      }
      toast.error(getErrorMessage(e, tt("toast.backupFailed")));
    },
  });
}

export function useDownloadBackup() {
  return useMutation({
    mutationFn: async (backup: ApiBackup) => {
      const blob = await adminBackupApi.download(backup.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = backup.fileName || `backup-${backup.id}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => toast.success(tt("toast.downloadStarted")),
    onError: (e) => toast.error(getErrorMessage(e, tt("toast.downloadFailed"))),
  });
}
