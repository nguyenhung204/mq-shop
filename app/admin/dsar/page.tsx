"use client";

import { FormEvent, useState } from "react";
import { Check, Play, Plus, X } from "lucide-react";
import {
  useAdminDsarAction,
  useAdminDsarList,
  useCreateAdminDsar,
} from "@/lib/queries/compliance";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { AdminActions, AdminIconButton } from "@/components/admin/AdminIconButton";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { translateStatus } from "@/lib/i18n/status";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { getErrorMessage } from "@/lib/queries/utils";

const STATUS_FILTERS = ["", "SUBMITTED", "APPROVED", "REJECTED", "EXECUTED"] as const;

function statusBadgeClass(status: string | undefined): string {
  if (status === "SUBMITTED") return "mq-badge mq-badge-cyan";
  if (status === "APPROVED") return "mq-badge mq-badge-teal";
  if (status === "REJECTED") return "mq-badge mq-badge-pink";
  if (status === "EXECUTED" || status === "DELETED") return "mq-badge mq-badge-muted";
  return "mq-badge mq-badge-muted";
}

function DsarInner() {
  const { t } = useLanguage();
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole("SUPER_ADMIN");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [targetUserId, setTargetUserId] = useState("");
  const [note, setNote] = useState("");

  const { data, isLoading, isError, error } = useAdminDsarList({
    status: statusFilter || undefined,
    page,
    pageSize: 20,
  });
  const createDsar = useCreateAdminDsar();
  const action = useAdminDsarAction();

  const items = data?.items ?? [];
  const meta = data?.meta;

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await createDsar.mutateAsync({
        targetUserId: targetUserId.trim(),
        note: note.trim() || undefined,
      });
      setCreateOpen(false);
      setTargetUserId("");
      setNote("");
    } catch {
      /* toast */
    }
  };

  return (
    <>
      <AdminPageHeader
        title={t("admin.dsar.title")}
        description={t("admin.dsar.description")}
        actions={
          <button
            type="button"
            className="mq-admin-btn mq-admin-btn-approve"
            onClick={() => setCreateOpen(true)}
          >
            <Plus size={16} strokeWidth={2.25} />
            {t("admin.dsar.create")}
          </button>
        }
      />

      <div className="space-y-6">
        {isError && (
          <div className="mq-alert mq-alert-error">
            {getErrorMessage(error, t("admin.common.failed"))}
          </div>
        )}

        <div className="rounded-lg border border-mq-border bg-mq-surface-subtle p-3 text-sm text-mq-text-secondary">
          {t("admin.dsar.hint")}
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <select
            className="mq-input max-w-[12rem]"
            value={statusFilter}
            aria-label={t("admin.common.filterStatus")}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s || "all"} value={s}>
                {s === "" ? t("admin.common.allStatuses") : translateStatus(t, "dsar", s)}
              </option>
            ))}
          </select>
        </div>

        {isLoading ? (
          <TableSkeleton rows={6} cols={5} />
        ) : items.length === 0 ? (
          <p className="text-sm text-mq-text-muted">{t("admin.dsar.empty")}</p>
        ) : (
          <div className="mq-table-wrap">
            <table className="w-full text-sm">
              <thead className="bg-mq-surface-subtle text-left">
                <tr>
                  <th className="p-3">{t("admin.dsar.id")}</th>
                  <th className="p-3">{t("admin.dsar.target")}</th>
                  <th className="p-3">{t("admin.common.status")}</th>
                  <th className="p-3">{t("admin.dsar.note")}</th>
                  <th className="p-3">{t("admin.dsar.created")}</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id} className="border-t border-mq-border">
                    <td className="p-3 font-mono text-xs">{r.id.slice(0, 8)}…</td>
                    <td className="p-3 text-xs">
                      <div>{r.targetEmail || r.targetName || "—"}</div>
                      {r.targetUserId ? (
                        <div className="font-mono text-mq-text-muted mt-0.5">
                          {r.targetUserId.slice(0, 8)}…
                        </div>
                      ) : null}
                    </td>
                    <td className="p-3">
                      <span className={statusBadgeClass(r.status)}>{translateStatus(t, "dsar", r.status)}</span>
                    </td>
                    <td className="p-3 text-xs text-mq-text-secondary max-w-xs truncate">
                      {r.note || "—"}
                    </td>
                    <td className="p-3 text-xs text-mq-text-muted whitespace-nowrap">
                      {r.createdAt ? new Date(r.createdAt).toLocaleString() : "—"}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <AdminActions>
                        {r.status === "SUBMITTED" ? (
                          <>
                            <AdminIconButton
                              label={t("admin.common.approve")}
                              icon={Check}
                              tone="approve"
                              disabled={action.isPending}
                              onClick={() =>
                                void action.mutateAsync({ id: r.id, kind: "approve" })
                              }
                            />
                            <AdminIconButton
                              label={t("admin.common.reject")}
                              icon={X}
                              tone="reject"
                              disabled={action.isPending}
                              onClick={() =>
                                void action.mutateAsync({ id: r.id, kind: "reject" })
                              }
                            />
                          </>
                        ) : null}
                        {isSuperAdmin && r.status === "APPROVED" ? (
                          <AdminIconButton
                            label={t("admin.dsar.execute")}
                            icon={Play}
                            tone="warn"
                            disabled={action.isPending}
                            onClick={() => {
                              if (
                                typeof window !== "undefined" &&
                                !window.confirm(t("admin.dsar.executeConfirm"))
                              ) {
                                return;
                              }
                              void action.mutateAsync({ id: r.id, kind: "execute" });
                            }}
                          />
                        ) : null}
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

      {createOpen ? (
        <div className="mq-admin-modal-root" role="presentation">
          <button
            type="button"
            className="mq-admin-modal-backdrop"
            aria-label={t("admin.common.close")}
            onClick={() => setCreateOpen(false)}
          />
          <div
            className="mq-admin-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-dsar-title"
          >
            <div className="mq-admin-modal-head">
              <h2 id="create-dsar-title" className="mq-admin-modal-title">
                {t("admin.dsar.create")}
              </h2>
              <button
                type="button"
                className="mq-admin-icon-btn"
                aria-label={t("admin.common.close")}
                onClick={() => setCreateOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
            <form className="mq-admin-modal-body space-y-3" onSubmit={(e) => void onCreate(e)}>
              <div>
                <label className="block text-xs font-medium text-mq-text-muted mb-1.5">
                  {t("admin.dsar.targetUserId")}
                </label>
                <input
                  className="mq-input"
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-mq-text-muted mb-1.5">
                  {t("admin.dsar.note")} ({t("admin.common.optional")})
                </label>
                <textarea
                  className="mq-input min-h-[5rem]"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={500}
                />
              </div>
              <div className="mq-admin-modal-actions">
                <button
                  type="button"
                  className="mq-admin-btn mq-admin-btn-secondary"
                  onClick={() => setCreateOpen(false)}
                >
                  {t("admin.common.cancel")}
                </button>
                <button
                  type="submit"
                  className="mq-admin-btn mq-admin-btn-approve"
                  disabled={createDsar.isPending}
                >
                  {createDsar.isPending ? t("admin.common.working") : t("admin.common.create")}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default function AdminDsarPage() {
  return (
    <AuthGuard roles={["ADMIN", "SUPER_ADMIN"]}>
      <DsarInner />
    </AuthGuard>
  );
}
