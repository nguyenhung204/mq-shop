"use client";

import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Lock, Pencil, Plus, Trash2, Unlock, X } from "lucide-react";
import type { AuthUser } from "@/lib/api/types";
import { hasPendingStaffChange } from "@/lib/api/staff";
import {
  useAdminPlatformStaffList,
  useAdminUserAction,
  useCreatePlatformStaff,
  usePlatformStaffDualControlAction,
  useUpdatePlatformStaffRoles,
} from "@/lib/queries/admin";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { AdminActions, AdminIconButton } from "@/components/admin/AdminIconButton";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { translateRoles, translateStatus } from "@/lib/i18n/status";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { getErrorMessage } from "@/lib/queries/utils";
import { FormAlerts, useFormAlerts } from "@/lib/ui/form-feedback";

const STATUS_FILTERS = ["", "ACTIVE", "PENDING", "LOCKED", "DELETED"] as const;

function statusBadgeClass(status: string | undefined): string {
  if (status === "PENDING") return "mq-badge mq-badge-cyan";
  if (status === "LOCKED" || status === "DELETED") return "mq-badge mq-badge-pink";
  if (status === "ACTIVE") return "mq-badge mq-badge-teal";
  return "mq-badge mq-badge-muted";
}

function PlatformStaffInner() {
  const { t, locale } = useLanguage();
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole("SUPER_ADMIN");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState<AuthUser | null>(null);
  const [createdCred, setCreatedCred] = useState<{
    email: string;
    temporaryPassword: string;
  } | null>(null);
  const [pendingNotice, setPendingNotice] = useState(false);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const createAlerts = useFormAlerts({ locale, t });
  const editAlerts = useFormAlerts({ locale, t });

  const { data, isLoading, isError, error } = useAdminPlatformStaffList({
    status: statusFilter || undefined,
    q: search.trim() || undefined,
    page,
    pageSize: 20,
  });
  const createStaff = useCreatePlatformStaff();
  const updateRoles = useUpdatePlatformStaffRoles();
  const dualControl = usePlatformStaffDualControlAction();
  const userAction = useAdminUserAction();
  const [confirmAction, setConfirmAction] = useState<{
    userId: string;
    email: string;
    action: "lock" | "unlock" | "delete";
  } | null>(null);

  const items = data?.items ?? [];
  const meta = data?.meta;

  const closeCreate = () => {
    setCreateOpen(false);
    setEmail("");
    setFullName("");
    createAlerts.clearAlerts();
  };

  useEffect(() => {
    if (!createOpen && !editOpen && !createdCred) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (createdCred) setCreatedCred(null);
      else if (editOpen) setEditOpen(null);
      else closeCreate();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [createOpen, editOpen, createdCred]);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    createAlerts.clearAlerts();
    try {
      const res = await createStaff.mutateAsync({
        email: email.trim(),
        fullName: fullName.trim() || undefined,
        roles: ["ADMIN"],
      });
      closeCreate();
      if (res.temporaryPassword) {
        setCreatedCred({
          email: res.user.email,
          temporaryPassword: res.temporaryPassword,
        });
        toast.success(t("toast.platformStaffCreated"));
      } else if (hasPendingStaffChange(res.user) || !isSuperAdmin) {
        setPendingNotice(true);
        toast.message(t("admin.platformStaff.pendingNotice"));
      } else {
        toast.success(t("toast.platformStaffCreated"));
      }
    } catch (err) {
      createAlerts.setErrorFromApi(err);
    }
  };

  const onReaffirmRoles = async (u: AuthUser) => {
    editAlerts.clearAlerts();
    try {
      const user = await updateRoles.mutateAsync({
        userId: u.id,
        roles: ["ADMIN"],
      });
      setEditOpen(null);
      if (hasPendingStaffChange(user) || !isSuperAdmin) {
        setPendingNotice(true);
        // Hook already toasts roles updated; banner covers pending dual-control.
      }
    } catch (err) {
      editAlerts.setErrorFromApi(err);
    }
  };

  const copyPassword = async () => {
    if (!createdCred) return;
    try {
      await navigator.clipboard.writeText(createdCred.temporaryPassword);
      toast.success(t("admin.staffPage.passwordCopied"));
    } catch {
      toast.error(t("admin.staffPage.copyFailed"));
    }
  };

  return (
    <>
      <AdminPageHeader
        title={t("admin.platformStaff.title")}
        description={t("admin.platformStaff.description")}
        actions={
          <button
            type="button"
            className="mq-admin-btn mq-admin-btn-approve"
            onClick={() => setCreateOpen(true)}
          >
            <Plus size={16} strokeWidth={2.25} />
            {t("admin.platformStaff.invite")}
          </button>
        }
      />

      <div className="space-y-6">
        {isError && (
          <div className="mq-alert mq-alert-error">
            {getErrorMessage(error, t("admin.common.failed"))}
          </div>
        )}
        {pendingNotice ? (
          <div className="rounded-lg border border-mq-border bg-mq-surface-subtle p-3 text-sm text-mq-text-secondary">
            {t("admin.platformStaff.pendingNotice")}
            <button
              type="button"
              className="ml-3 text-xs underline"
              onClick={() => setPendingNotice(false)}
            >
              {t("admin.common.close")}
            </button>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3 items-center">
          <input
            className="mq-input max-w-[16rem]"
            placeholder={t("admin.common.searchPlaceholder")}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <select
            className="mq-input max-w-[11rem]"
            value={statusFilter}
            aria-label={t("admin.common.filterStatus")}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s || "all"} value={s}>
                {s === "" ? t("admin.common.allStatuses") : translateStatus(t, "user", s)}
              </option>
            ))}
          </select>
          <p className="text-xs text-mq-text-muted">{t("admin.platformStaff.roleHint")}</p>
        </div>

        {isLoading ? (
          <TableSkeleton rows={6} cols={5} />
        ) : items.length === 0 ? (
          <p className="text-sm text-mq-text-muted">{t("admin.platformStaff.empty")}</p>
        ) : (
          <div className="mq-table-wrap">
            <table className="w-full text-sm">
              <thead className="bg-mq-surface-subtle text-left">
                <tr>
                  <th className="p-3">{t("admin.common.email")}</th>
                  <th className="p-3">{t("admin.common.name")}</th>
                  <th className="p-3">{t("admin.common.roles")}</th>
                  <th className="p-3">{t("admin.staffPage.pendingRoles")}</th>
                  <th className="p-3">{t("admin.common.status")}</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {items.map((u) => {
                  const pending = hasPendingStaffChange(u);
                  return (
                    <tr key={u.id} className="border-t border-mq-border">
                      <td className="p-3">{u.email}</td>
                      <td className="p-3">{u.fullName || "—"}</td>
                      <td className="p-3">{translateRoles(t, u.roles)}</td>
                      <td className="p-3 text-xs text-mq-text-secondary">
                        {u.pendingRoles?.length
                          ? translateRoles(t, u.pendingRoles)
                          : "—"}
                      </td>
                      <td className="p-3">
                        <span className={statusBadgeClass(u.status)}>
                          {u.status ? translateStatus(t, "user", u.status) : "—"}
                        </span>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <AdminActions>
                          {isSuperAdmin && pending ? (
                            <>
                              <AdminIconButton
                                label={t("admin.common.approve")}
                                icon={Check}
                                tone="approve"
                                disabled={dualControl.isPending}
                                onClick={() =>
                                  void dualControl.mutateAsync({
                                    userId: u.id,
                                    kind: "approve",
                                  })
                                }
                              />
                              <AdminIconButton
                                label={t("admin.common.reject")}
                                icon={X}
                                tone="reject"
                                disabled={dualControl.isPending}
                                onClick={() =>
                                  void dualControl.mutateAsync({
                                    userId: u.id,
                                    kind: "reject",
                                  })
                                }
                              />
                            </>
                          ) : null}
                          <AdminIconButton
                            label={t("admin.common.editRoles")}
                            icon={Pencil}
                            tone="secondary"
                            disabled={updateRoles.isPending}
                            onClick={() => setEditOpen(u)}
                          />
                          {isSuperAdmin && u.status === "ACTIVE" && !u.roles?.includes("SUPER_ADMIN") ? (
                            <AdminIconButton
                              label={t("admin.common.lock")}
                              icon={Lock}
                              tone="warn"
                              disabled={userAction.isPending}
                              onClick={() => setConfirmAction({ userId: u.id, email: u.email, action: "lock" })}
                            />
                          ) : null}
                          {isSuperAdmin && u.status === "LOCKED" ? (
                            <AdminIconButton
                              label={t("admin.common.unlock")}
                              icon={Unlock}
                              tone="approve"
                              disabled={userAction.isPending}
                              onClick={() => setConfirmAction({ userId: u.id, email: u.email, action: "unlock" })}
                            />
                          ) : null}
                          {isSuperAdmin && !u.roles?.includes("SUPER_ADMIN") ? (
                            <AdminIconButton
                              label={t("admin.common.delete")}
                              icon={Trash2}
                              tone="reject"
                              disabled={userAction.isPending}
                              onClick={() => setConfirmAction({ userId: u.id, email: u.email, action: "delete" })}
                            />
                          ) : null}
                        </AdminActions>
                      </td>
                    </tr>
                  );
                })}
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
            onClick={closeCreate}
          />
          <div
            className="mq-admin-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-platform-staff-title"
          >
            <div className="mq-admin-modal-head">
              <h2 id="create-platform-staff-title" className="mq-admin-modal-title">
                {t("admin.platformStaff.invite")}
              </h2>
              <button
                type="button"
                className="mq-admin-icon-btn"
                aria-label={t("admin.common.close")}
                onClick={closeCreate}
              >
                <X size={16} />
              </button>
            </div>
            <form className="mq-admin-modal-body space-y-3" onSubmit={(e) => void onCreate(e)}>
              <FormAlerts error={createAlerts.error} />
              <p className="text-xs text-mq-text-muted">{t("admin.platformStaff.createHint")}</p>
              <div>
                <label className="block text-xs font-medium text-mq-text-muted mb-1.5">
                  {t("admin.common.email")}
                </label>
                <input
                  type="email"
                  className="mq-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-mq-text-muted mb-1.5">
                  {t("admin.common.name")} ({t("admin.common.optional")})
                </label>
                <input
                  className="mq-input"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  maxLength={200}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-mq-text-muted mb-1.5">
                  {t("admin.common.roles")}
                </label>
                <input
                  className="mq-input"
                  value={translateStatus(t, "role", "ADMIN")}
                  disabled
                  readOnly
                />
              </div>
              <div className="mq-admin-modal-actions">
                <button
                  type="button"
                  className="mq-admin-btn mq-admin-btn-secondary"
                  onClick={closeCreate}
                >
                  {t("admin.common.cancel")}
                </button>
                <button
                  type="submit"
                  className="mq-admin-btn mq-admin-btn-approve"
                  disabled={createStaff.isPending}
                >
                  {createStaff.isPending
                    ? t("admin.staffPage.creating")
                    : t("admin.common.create")}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {editOpen ? (
        <div className="mq-admin-modal-root" role="presentation">
          <button
            type="button"
            className="mq-admin-modal-backdrop"
            aria-label={t("admin.common.close")}
            onClick={() => setEditOpen(null)}
          />
          <div
            className="mq-admin-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-platform-roles-title"
          >
            <div className="mq-admin-modal-head">
              <h2 id="edit-platform-roles-title" className="mq-admin-modal-title">
                {t("admin.staffPage.editTitle")} — {editOpen.email}
              </h2>
              <button
                type="button"
                className="mq-admin-icon-btn"
                aria-label={t("admin.common.close")}
                onClick={() => setEditOpen(null)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="mq-admin-modal-body space-y-3">
              <FormAlerts error={editAlerts.error} />
              <p className="text-sm text-mq-text-secondary">
                {t("admin.platformStaff.reaffirmHint")}
              </p>
              <input
                className="mq-input"
                value={translateStatus(t, "role", "ADMIN")}
                disabled
                readOnly
              />
              <div className="mq-admin-modal-actions">
                <button
                  type="button"
                  className="mq-admin-btn mq-admin-btn-secondary"
                  onClick={() => setEditOpen(null)}
                >
                  {t("admin.common.cancel")}
                </button>
                <button
                  type="button"
                  className="mq-admin-btn mq-admin-btn-approve"
                  disabled={updateRoles.isPending}
                  onClick={() => void onReaffirmRoles(editOpen)}
                >
                  {updateRoles.isPending ? t("admin.common.saving") : t("admin.common.save")}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {createdCred ? (
        <div className="mq-admin-modal-root" role="presentation">
          <button
            type="button"
            className="mq-admin-modal-backdrop"
            aria-label={t("admin.common.close")}
            onClick={() => setCreatedCred(null)}
          />
          <div
            className="mq-admin-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="temp-pass-title"
          >
            <div className="mq-admin-modal-head">
              <h2 id="temp-pass-title" className="mq-admin-modal-title">
                {t("admin.staffPage.tempPasswordTitle")}
              </h2>
              <button
                type="button"
                className="mq-admin-icon-btn"
                aria-label={t("admin.common.close")}
                onClick={() => setCreatedCred(null)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="mq-admin-modal-body space-y-3">
              <p className="text-sm text-mq-text-secondary">
                {t("admin.staffPage.tempPasswordHint", { email: createdCred.email })}
              </p>
              <div className="flex gap-2 items-center">
                <code className="mq-input flex-1 font-mono text-sm select-all">
                  {createdCred.temporaryPassword}
                </code>
                <button
                  type="button"
                  className="mq-admin-btn mq-admin-btn-secondary"
                  onClick={() => void copyPassword()}
                >
                  <Copy size={14} />
                  {t("admin.staffPage.copy")}
                </button>
              </div>
              <div className="mq-admin-modal-actions">
                <button
                  type="button"
                  className="mq-admin-btn mq-admin-btn-approve"
                  onClick={() => setCreatedCred(null)}
                >
                  {t("admin.common.confirm")}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={
          confirmAction?.action === "delete"
            ? t("admin.platformStaff.confirmDeleteTitle")
            : confirmAction?.action === "lock"
              ? t("admin.platformStaff.confirmLockTitle")
              : t("admin.platformStaff.confirmUnlockTitle")
        }
        description={
          confirmAction
            ? t("admin.platformStaff.confirmActionDesc", { email: confirmAction.email })
            : ""
        }
        confirmLabel={
          confirmAction?.action === "delete"
            ? t("admin.common.delete")
            : confirmAction?.action === "lock"
              ? t("admin.common.lock")
              : t("admin.common.unlock")
        }
        tone={confirmAction?.action === "delete" ? "danger" : undefined}
        busy={userAction.isPending}
        onClose={() => setConfirmAction(null)}
        onConfirm={async () => {
          if (!confirmAction) return;
          await userAction.mutateAsync({
            action: confirmAction.action,
            userId: confirmAction.userId,
          });
          setConfirmAction(null);
        }}
      />
    </>
  );
}

export default function AdminPlatformStaffPage() {
  return (
    <AuthGuard
      roles={["ADMIN", "SUPER_ADMIN"]}
      permissions={["MANAGE_STAFF", "ASSIGN_ROLES"]}
    >
      <PlatformStaffInner />
    </AuthGuard>
  );
}
