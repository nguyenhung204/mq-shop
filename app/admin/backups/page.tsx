"use client";

import { Download, HardDrive, RefreshCw } from "lucide-react";
import {
  useAdminBackups,
  useCreateBackup,
  useDownloadBackup,
} from "@/lib/queries/compliance";
import { isBackupInProgress } from "@/lib/api/compliance";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { AdminActions, AdminIconButton } from "@/components/admin/AdminIconButton";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { translateStatus } from "@/lib/i18n/status";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { getErrorMessage } from "@/lib/queries/utils";
import { useState } from "react";

function statusBadgeClass(status: string | undefined): string {
  if (status === "SUCCESS") return "mq-badge mq-badge-teal";
  if (status === "FAILED") return "mq-badge mq-badge-pink";
  if (isBackupInProgress(status)) return "mq-badge mq-badge-cyan";
  return "mq-badge mq-badge-muted";
}

function formatBytes(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function BackupsInner() {
  const { t } = useLanguage();
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error, refetch, isFetching } = useAdminBackups(page, 20);
  const createBackup = useCreateBackup();
  const download = useDownloadBackup();

  const items = data?.items ?? [];
  const meta = data?.meta;
  const running = items.some((b) => isBackupInProgress(b.status));

  return (
    <>
      <AdminPageHeader
        title={t("admin.backups.title")}
        description={t("admin.backups.description")}
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="mq-admin-btn mq-admin-btn-secondary"
              disabled={isFetching}
              onClick={() => void refetch()}
            >
              <RefreshCw size={16} strokeWidth={2.25} />
              {t("admin.backups.refresh")}
            </button>
            <button
              type="button"
              className="mq-admin-btn mq-admin-btn-approve"
              disabled={createBackup.isPending || running}
              onClick={() => void createBackup.mutateAsync()}
            >
              <HardDrive size={16} strokeWidth={2.25} />
              {createBackup.isPending
                ? t("admin.backups.starting")
                : t("admin.backups.startFull")}
            </button>
          </div>
        }
      />

      <div className="space-y-6">
        {isError && (
          <div className="mq-alert mq-alert-error">
            {getErrorMessage(error, t("admin.common.failed"))}
          </div>
        )}

        <div className="rounded-lg border border-mq-border bg-mq-surface-subtle p-3 text-sm text-mq-text-secondary">
          {t("admin.backups.maintenanceNote")}
        </div>

        {isLoading ? (
          <TableSkeleton rows={6} cols={5} />
        ) : items.length === 0 ? (
          <p className="text-sm text-mq-text-muted">{t("admin.backups.empty")}</p>
        ) : (
          <div className="mq-table-wrap">
            <table className="w-full text-sm">
              <thead className="bg-mq-surface-subtle text-left">
                <tr>
                  <th className="p-3">{t("admin.backups.id")}</th>
                  <th className="p-3">{t("admin.common.status")}</th>
                  <th className="p-3">{t("admin.backups.progress")}</th>
                  <th className="p-3">{t("admin.backups.size")}</th>
                  <th className="p-3">{t("admin.backups.created")}</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {items.map((b) => (
                  <tr key={b.id} className="border-t border-mq-border">
                    <td className="p-3 font-mono text-xs">{b.id.slice(0, 8)}…</td>
                    <td className="p-3">
                      <span className={statusBadgeClass(b.status)}>{translateStatus(t, "backup", b.status)}</span>
                      {b.errorMessage ? (
                        <p className="text-[11px] text-mq-text-muted mt-1 max-w-xs truncate">
                          {b.errorMessage}
                        </p>
                      ) : null}
                    </td>
                    <td className="p-3">
                      {isBackupInProgress(b.status) || b.status === "SUCCESS" ? (
                        <div className="min-w-[8rem]">
                          <div className="h-1.5 rounded-full bg-mq-surface-subtle overflow-hidden">
                            <div
                              className="h-full bg-mq-accent-teal transition-all"
                              style={{ width: `${Math.min(100, Math.max(0, b.progress ?? 0))}%` }}
                            />
                          </div>
                          <p className="text-[11px] text-mq-text-muted mt-1">
                            {b.progress ?? 0}%
                          </p>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-3 text-xs">{formatBytes(b.sizeBytes)}</td>
                    <td className="p-3 text-xs text-mq-text-muted whitespace-nowrap">
                      {b.createdAt ? new Date(b.createdAt).toLocaleString() : "—"}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <AdminActions>
                        <AdminIconButton
                          label={t("admin.backups.download")}
                          icon={Download}
                          tone="secondary"
                          disabled={
                            b.status !== "SUCCESS" ||
                            (download.isPending && download.variables?.id === b.id)
                          }
                          onClick={() => void download.mutateAsync(b)}
                        />
                      </AdminActions>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <PaginationBar page={page} meta={meta} onPageChange={setPage} />
      </div>
    </>
  );
}

export default function AdminBackupsPage() {
  return (
    <AuthGuard roles={["SUPER_ADMIN"]} permissions={["BACKUP_RESTORE"]}>
      <BackupsInner />
    </AuthGuard>
  );
}
