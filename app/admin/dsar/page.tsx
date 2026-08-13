"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Check, Play, Plus, Search, X } from "lucide-react";
import {
  useAdminDsarAction,
  useAdminDsarList,
  useCreateAdminDsar,
} from "@/lib/queries/compliance";
import { useCsCustomers } from "@/lib/queries/cs";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { AdminActions, AdminIconButton } from "@/components/admin/AdminIconButton";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { translateStatus } from "@/lib/i18n/status";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
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
  const [targetEmail, setTargetEmail] = useState("");
  const [emailSearch, setEmailSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [note, setNote] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  /** Request id awaiting erasure confirmation — irreversible, so gate it. */
  const [executeId, setExecuteId] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useAdminDsarList({
    status: statusFilter || undefined,
    page,
    pageSize: 20,
  });
  const createDsar = useCreateAdminDsar();
  const action = useAdminDsarAction();

  // Search users for the email select (debounced via the query's enabled flag)
  const { data: usersData, isLoading: usersLoading } = useCsCustomers(
    emailSearch,
    undefined,
    1,
    20,
  );
  // Filter out ADMIN and SUPER_ADMIN roles
  const EXCLUDED_ROLES = ["ADMIN", "SUPER_ADMIN"];
  const filteredUsers = (usersData?.items ?? []).filter(
    (u) => !u.roles.some((r) => EXCLUDED_ROLES.includes(r)),
  );

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const items = data?.items ?? [];
  const meta = data?.meta;

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!targetUserId) return;
    try {
      await createDsar.mutateAsync({
        targetUserId: targetUserId.trim(),
        note: note.trim() || undefined,
      });
      setCreateOpen(false);
      setTargetUserId("");
      setTargetEmail("");
      setEmailSearch("");
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
                    <td className="p-3 text-xs">
                      <div>{r.targetEmail || r.targetName || "—"}</div>
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
                            onClick={() => setExecuteId(r.id)}
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
              <div ref={dropdownRef} className="relative">
                <label className="block text-xs font-medium text-mq-text-muted mb-1.5">
                  {t("admin.dsar.targetUserId")}
                </label>
                {targetEmail ? (
                  <div className="flex items-center gap-2 mq-input">
                    <span className="flex-1 truncate text-sm">{targetEmail}</span>
                    <button
                      type="button"
                      className="text-mq-text-muted hover:text-mq-text-primary"
                      onClick={() => {
                        setTargetUserId("");
                        setTargetEmail("");
                        setEmailSearch("");
                      }}
                      aria-label={t("admin.common.clear") ?? "Clear"}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-mq-text-muted pointer-events-none"
                    />
                    <input
                      className="mq-input !pl-8 w-full"
                      placeholder={t("admin.dsar.searchUserEmail") ?? "Tìm email người dùng..."}
                      value={emailSearch}
                      onChange={(e) => {
                        setEmailSearch(e.target.value);
                        setShowDropdown(true);
                      }}
                      onFocus={() => setShowDropdown(true)}
                      autoFocus
                    />
                  </div>
                )}
                {showDropdown && !targetEmail && emailSearch.length >= 1 && (
                  <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-md border border-mq-border bg-mq-surface shadow-lg">
                    {usersLoading ? (
                      <div className="p-3 text-xs text-mq-text-muted">{t("admin.common.working") ?? "Đang tìm..."}</div>
                    ) : filteredUsers.length === 0 ? (
                      <div className="p-3 text-xs text-mq-text-muted">{t("admin.dsar.noUserFound") ?? "Không tìm thấy người dùng"}</div>
                    ) : (
                      filteredUsers.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-mq-surface-subtle text-sm transition-colors"
                          onClick={() => {
                            setTargetUserId(u.id);
                            setTargetEmail(u.email);
                            setShowDropdown(false);
                            setEmailSearch("");
                          }}
                        >
                          <div className="font-medium">{u.email}</div>
                          {u.fullName && (
                            <div className="text-xs text-mq-text-muted">{u.fullName}</div>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
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
                  disabled={createDsar.isPending || !targetUserId}
                >
                  {createDsar.isPending ? t("admin.common.working") : t("admin.common.create")}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(executeId)}
        title={t("confirm.dsarExecuteTitle")}
        description={t("confirm.dsarExecuteDesc")}
        confirmLabel={t("confirm.dsarExecuteBtn")}
        tone="danger"
        busy={action.isPending}
        onClose={() => setExecuteId(null)}
        onConfirm={async () => {
          if (!executeId) return;
          try {
            await action.mutateAsync({ id: executeId, kind: "execute" });
          } finally {
            setExecuteId(null);
          }
        }}
      />
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
