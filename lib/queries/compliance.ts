"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  adminBackupApi,
  adminDsarApi,
  dsarApi,
  isBackupInProgress,
  type ApiBackup,
  type ApiDsarRequest,
  type SellerClosureBlockedDetails,
} from "@/lib/api/compliance";
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
  dsar: () => [...complianceKeys.all, "dsar"] as const,
  dsarList: (status: string, page: number, pageSize: number) =>
    [...complianceKeys.dsar(), "list", status, page, pageSize] as const,
  myDsar: () => [...complianceKeys.dsar(), "me"] as const,
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

export function useMyDsarRequests() {
  return useQuery({
    queryKey: complianceKeys.myDsar(),
    queryFn: async () => parsePage<ApiDsarRequest>(await dsarApi.myList()),
  });
}

export function useCreateMyDsar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (note?: string) =>
      dsarApi.myCreate(note?.trim() ? { note: note.trim() } : {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: complianceKeys.myDsar() });
      toast.success(tt("toast.dsarSubmitted"));
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 409) {
        toast.error(tt("toast.dsarOpenExists"));
        return;
      }
      toast.error(getErrorMessage(e, tt("toast.dsarFailed")));
    },
  });
}

/**
 * Seller account closure — POST /users/me/dsar/seller.
 *
 * On success the DSAR request is returned normally.
 * On 409 SELLER_CLOSURE_BLOCKED the hook exposes the blocking details via
 * the `blockedDetails` ref that callers can read to render the checklist.
 * On 409 DSAR_ALREADY_OPEN a toast is shown (same as the buyer flow).
 */
export function useCreateMySellerDsar() {
  const queryClient = useQueryClient();
  const [blockedDetails, setBlockedDetails] =
    useState<SellerClosureBlockedDetails | null>(null);

  const mutation = useMutation({
    mutationFn: (note?: string) =>
      dsarApi.sellerCreate(note?.trim() ? { note: note.trim() } : {}),
    onSuccess: () => {
      setBlockedDetails(null);
      void queryClient.invalidateQueries({ queryKey: complianceKeys.myDsar() });
      toast.success(tt("toast.dsarSubmitted"));
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 409) {
        // SELLER_CLOSURE_BLOCKED — extract blocking details for the UI checklist
        if (e.code === "SELLER_CLOSURE_BLOCKED") {
          const raw = (e.body as { error?: { details?: SellerClosureBlockedDetails } } | null)
            ?.error?.details;
          setBlockedDetails(raw ?? null);
          return;
        }
        // DSAR_ALREADY_OPEN or generic 409
        toast.error(tt("toast.dsarOpenExists"));
        return;
      }
      toast.error(getErrorMessage(e, tt("toast.dsarFailed")));
    },
  });

  return { ...mutation, blockedDetails, clearBlockedDetails: () => setBlockedDetails(null) };
}

export function useAdminDsarList(params: {
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  return useQuery({
    queryKey: complianceKeys.dsarList(params.status ?? "", page, pageSize),
    queryFn: async () =>
      parsePage<ApiDsarRequest>(
        await adminDsarApi.list({
          status: params.status || undefined,
          page,
          pageSize,
        }),
      ),
  });
}

export function useCreateAdminDsar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { targetUserId: string; note?: string }) =>
      adminDsarApi.create(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: complianceKeys.dsar() });
      toast.success(tt("toast.dsarCreated"));
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 409) {
        toast.error(tt("toast.dsarOpenExists"));
        return;
      }
      toast.error(getErrorMessage(e, tt("toast.dsarFailed")));
    },
  });
}

export function useAdminDsarAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      kind,
    }: {
      id: string;
      kind: "approve" | "reject" | "execute";
    }) => {
      if (kind === "approve") return adminDsarApi.approve(id);
      if (kind === "reject") return adminDsarApi.reject(id);
      return adminDsarApi.execute(id);
    },
    onSuccess: (_d, vars) => {
      void queryClient.invalidateQueries({ queryKey: complianceKeys.dsar() });
      toast.success(
        vars.kind === "approve"
          ? tt("toast.dsarApproved")
          : vars.kind === "reject"
            ? tt("toast.dsarRejected")
            : tt("toast.dsarExecuted"),
      );
    },
    onError: (e) => toast.error(getErrorMessage(e, tt("toast.dsarFailed"))),
  });
}
