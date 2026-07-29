"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Lock, Pencil, Plus, Trash2, Unlock, UserPlus, X } from "lucide-react";
import type { AuthUser, StaffPoolRole, StaffRole } from "@/lib/api/types";
import { hasPendingStaffChange } from "@/lib/api/staff";
import {
  useAdminShops,
  useAdminStaffList,
  useCreateStaff,
  useStaffAccountAction,
  useStaffDualControlAction,
  useUpdateStaffRoles,
} from "@/lib/queries/admin";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminConfirmModal } from "@/components/admin/AdminConfirmModal";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { AdminActions, AdminIconButton } from "@/components/admin/AdminIconButton";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { translateRoles, translateStatus } from "@/lib/i18n/status";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { getErrorMessage } from "@/lib/queries/utils";
import { FormAlerts, useFormAlerts } from "@/lib/ui/form-feedback";

const STAFF_ROLES: StaffRole[] = ["WAREHOUSE", "CS", "ACCOUNTANT"];
const POOL_FILTERS: StaffPoolRole[] = ["BUYER", "WAREHOUSE", "CS", "ACCOUNTANT"];
const STATUS_FILTERS = ["", "ACTIVE", "PENDING", "LOCKED", "DELETED"] as const;

type PendingStaffAction = {
  userId: string;
  email: string;
  kind: "lock" | "delete";
};

function isBuyerCandidate(u: AuthUser): boolean {
  const roles = u.roles ?? [];
  return roles.includes("BUYER") && !roles.includes("SELLER") && !STAFF_ROLES.some((r) => roles.includes(r));
}

function primaryStaffRole(u: AuthUser): StaffRole | "" {
  const hit = (u.roles ?? []).find((r): r is StaffRole =>
    STAFF_ROLES.includes(r as StaffRole),
  );
  return hit ?? "";
}

function statusBadgeClass(status: string | undefined): string {
  if (status === "PENDING") return "mq-badge mq-badge-cyan";
  if (status === "LOCKED" || status === "DELETED") return "mq-badge mq-badge-pink";
  if (status === "ACTIVE") return "mq-badge mq-badge-teal";
  return "mq-badge mq-badge-muted";
}

function StaffInner() {
  const { t, locale } = useLanguage();
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole("SUPER_ADMIN");
  const [shopFilter, setShopFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState<StaffPoolRole | "">("BUYER");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState<AuthUser | null>(null);
  const [createdCred, setCreatedCred] = useState<{
    email: string;
    temporaryPassword: string;
  } | null>(null);
  const [pendingNotice, setPendingNotice] = useState(false);
  const [pending, setPending] = useState<PendingStaffAction | null>(null);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<StaffRole>("WAREHOUSE");
  const [shopId, setShopId] = useState("");
  const [assignRole, setAssignRole] = useState<StaffRole>("WAREHOUSE");
  const [assignShopId, setAssignShopId] = useState("");
  const createAlerts = useFormAlerts({ locale, t });
  const assignAlerts = useFormAlerts({ locale, t });

  const { data: shopsPage } = useAdminShops("APPROVED", 1, 100);
  const shops = shopsPage?.items ?? [];
  const shopName = useMemo(() => {
    const map = new Map(shops.map((s) => [s.id, s.name]));
    return (id: string | null | undefined) =>
      (id && map.get(id)) || (id ? `${id.slice(0, 8)}…` : "—");
  }, [shops]);

  const { data, isLoading, isError, error } = useAdminStaffList({
    shopId: shopFilter || undefined,
    role: roleFilter,
    status: statusFilter || undefined,
    page,
    pageSize: 20,
  });
  const createStaff = useCreateStaff();
  const updateRoles = useUpdateStaffRoles();
  const accountAction = useStaffAccountAction();
  const dualControl = useStaffDualControlAction();

  const items = data?.items ?? [];
  const meta = data?.meta;

  const confirmCopy = useMemo(() => {
    if (!pending) return null;
    if (pending.kind === "lock") {
      return {
        title: t("admin.staffPage.confirmLockTitle"),
        description: t("admin.staffPage.confirmLockDesc", { email: pending.email }),
        confirmLabel: t("admin.common.lock"),
        tone: "warn" as const,
      };
    }
    return {
      title: t("admin.staffPage.confirmDeleteTitle"),
      description: t("admin.staffPage.confirmDeleteDesc", { email: pending.email }),
      confirmLabel: t("admin.common.delete"),
      tone: "danger" as const,
    };
  }, [pending, t]);

  const closeCreate = () => {
    setCreateOpen(false);
    setEmail("");
    setFullName("");
    setRole("WAREHOUSE");
    setShopId("");
    createAlerts.clearAlerts();
  };

  const closeAssign = () => {
    setAssignOpen(null);
    setAssignRole("WAREHOUSE");
    setAssignShopId("");
    assignAlerts.clearAlerts();
  };

  useEffect(() => {
    if (!createOpen && !assignOpen && !createdCred) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (createdCred) setCreatedCred(null);
      else if (assignOpen) closeAssign();
      else closeCreate();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [createOpen, assignOpen, createdCred]);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    createAlerts.clearAlerts();
    try {
      const res = await createStaff.mutateAsync({
        email: email.trim(),
        fullName: fullName.trim() || undefined,
        role,
        shopId,
      });
      closeCreate();
      if (res.temporaryPassword) {
        setCreatedCred({
          email: res.user.email,
          temporaryPassword: res.temporaryPassword,
        });
      } else if (hasPendingStaffChange(res.user) || !isSuperAdmin) {
        setPendingNotice(true);
        toast.message(t("admin.staffPage.pendingNotice"));
      }
    } catch (err) {
      createAlerts.setErrorFromApi(err);
    }
  };

  const openAssign = (u: AuthUser) => {
    setAssignOpen(u);
    setAssignRole(primaryStaffRole(u) || "WAREHOUSE");
    setAssignShopId(u.shopId || shopFilter || "");
  };

  const onAssign = async (e: FormEvent) => {
    e.preventDefault();
    if (!assignOpen) return;
    assignAlerts.clearAlerts();
    if (!assignShopId) {
      assignAlerts.setLocalError("admin.staffPage.shopRequired");
      return;
    }
    try {
      const user = await updateRoles.mutateAsync({
        userId: assignOpen.id,
        body: {
          roles: [assignRole],
          shopId: assignShopId,
        },
      });
      closeAssign();
      if (roleFilter === "BUYER") setRoleFilter(assignRole);
      if (hasPendingStaffChange(user) || (!isSuperAdmin && user.status === "PENDING")) {
        setPendingNotice(true);
        toast.message(t("admin.staffPage.pendingNotice"));
      }
    } catch (err) {
      assignAlerts.setErrorFromApi(err);
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
        title={t("admin.staff.title")}
        description={t("admin.staff.description")}
        actions={
          <button
            type="button"
            className="mq-admin-btn mq-admin-btn-approve"
            onClick={() => setCreateOpen(true)}
          >
            <Plus size={16} strokeWidth={2.25} />
            {t("admin.common.create")}
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
            {t("admin.staffPage.pendingNotice")}
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
          <select
            className="mq-input max-w-[16rem]"
            value={shopFilter}
            aria-label={t("admin.common.shop")}
            onChange={(e) => {
              setShopFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">{t("admin.staffPage.allShopsUnassigned")}</option>
            {shops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            className="mq-input max-w-[11rem]"
            value={roleFilter}
            aria-label={t("admin.staffPage.role")}
            onChange={(e) => {
              setRoleFilter(e.target.value as StaffPoolRole | "");
              setPage(1);
            }}
          >
            <option value="">{t("admin.staffPage.allPool")}</option>
            {POOL_FILTERS.map((r) => (
              <option key={r} value={r}>
                {r === "BUYER"
                  ? t("admin.staffPage.buyerCandidates")
                  : translateStatus(t, "role", r)}
              </option>
            ))}
          </select>
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
        </div>

        {isLoading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : items.length === 0 ? (
          <p className="text-sm text-mq-text-muted">{t("admin.staffPage.empty")}</p>
        ) : (
          <div className="mq-table-wrap">
            <table className="w-full text-sm">
              <thead className="bg-mq-surface-subtle text-left">
                <tr>
                  <th className="p-3">{t("admin.common.email")}</th>
                  <th className="p-3">{t("admin.common.name")}</th>
                  <th className="p-3">{t("admin.common.shop")}</th>
                  <th className="p-3">{t("admin.common.roles")}</th>
                  <th className="p-3">{t("admin.staffPage.pendingRoles")}</th>
                  <th className="p-3">{t("admin.common.status")}</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {items.map((u) => {
                  const candidate = isBuyerCandidate(u);
                  const pending = hasPendingStaffChange(u);
                  const isLocked = u.status === "LOCKED";
                  return (
                    <tr key={u.id} className="border-t border-mq-border">
                      <td className="p-3">{u.email}</td>
                      <td className="p-3">{u.fullName || "—"}</td>
                      <td className="p-3 text-xs text-mq-text-secondary">
                        {u.shopId ? shopName(u.shopId) : (
                          <span className="text-mq-text-muted">{t("admin.staffPage.unassigned")}</span>
                        )}
                      </td>
                      <td className="p-3">
                        {translateRoles(t, u.roles)}
                        {candidate ? (
                          <span className="ml-2 mq-badge mq-badge-cyan text-[10px]">
                            {t("admin.staffPage.candidate")}
                          </span>
                        ) : null}
                      </td>
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
                            label={
                              candidate
                                ? t("admin.common.assignRole")
                                : t("admin.common.editRoles")
                            }
                            icon={candidate ? UserPlus : Pencil}
                            tone={candidate ? "approve" : "secondary"}
                            disabled={updateRoles.isPending}
                            onClick={() => openAssign(u)}
                          />
                          {!candidate ? (
                            <>
                              <AdminIconButton
                                label={t("admin.common.lock")}
                                icon={Lock}
                                tone="warn"
                                disabled={accountAction.isPending || isLocked}
                                onClick={() =>
                                  setPending({ userId: u.id, email: u.email, kind: "lock" })
                                }
                              />
                              <AdminIconButton
                                label={t("admin.common.unlock")}
                                icon={Unlock}
                                tone="approve"
                                disabled={accountAction.isPending || !isLocked}
                                onClick={() =>
                                  void accountAction.mutateAsync({
                                    userId: u.id,
                                    kind: "unlock",
                                  })
                                }
                              />
                              <AdminIconButton
                                label={t("admin.common.delete")}
                                icon={Trash2}
                                tone="danger"
                                disabled={accountAction.isPending}
                                onClick={() =>
                                  setPending({ userId: u.id, email: u.email, kind: "delete" })
                                }
                              />
                            </>
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
            aria-labelledby="create-staff-title"
          >
            <div className="mq-admin-modal-head">
              <h2 id="create-staff-title" className="mq-admin-modal-title">
                {t("admin.common.create")}
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
              <p className="text-xs text-mq-text-muted">
                {t("admin.staffPage.createHint")}
              </p>
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
                  {t("admin.staffPage.role")}
                </label>
                <select
                  className="mq-input"
                  value={role}
                  onChange={(e) => setRole(e.target.value as StaffRole)}
                  required
                >
                  {STAFF_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {translateStatus(t, "role", r)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-mq-text-muted mb-1.5">
                  {t("admin.common.shop")}
                </label>
                <select
                  className="mq-input"
                  value={shopId}
                  onChange={(e) => setShopId(e.target.value)}
                  required
                >
                  <option value="">{t("admin.staffPage.selectShop")}</option>
                  {shops.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
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

      {assignOpen ? (
        <div className="mq-admin-modal-root" role="presentation">
          <button
            type="button"
            className="mq-admin-modal-backdrop"
            aria-label={t("admin.common.close")}
            onClick={closeAssign}
          />
          <div
            className="mq-admin-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="assign-roles-title"
          >
            <div className="mq-admin-modal-head">
              <h2 id="assign-roles-title" className="mq-admin-modal-title">
                {isBuyerCandidate(assignOpen)
                  ? t("admin.staffPage.assignTitle")
                  : t("admin.staffPage.editTitle")}{" "}
                — {assignOpen.email}
              </h2>
              <button
                type="button"
                className="mq-admin-icon-btn"
                aria-label={t("admin.common.close")}
                onClick={closeAssign}
              >
                <X size={16} />
              </button>
            </div>
            <form className="mq-admin-modal-body space-y-3" onSubmit={(e) => void onAssign(e)}>
              <FormAlerts error={assignAlerts.error} />
              <div>
                <label className="block text-xs font-medium text-mq-text-muted mb-1.5">
                  {t("admin.staffPage.role")}
                </label>
                <select
                  className="mq-input"
                  value={assignRole}
                  onChange={(e) => setAssignRole(e.target.value as StaffRole)}
                  required
                >
                  {STAFF_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {translateStatus(t, "role", r)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-mq-text-muted mb-1.5">
                  {t("admin.common.shop")}
                  {isBuyerCandidate(assignOpen) ? ` (${t("admin.common.required")})` : ""}
                </label>
                <select
                  className="mq-input"
                  value={assignShopId}
                  onChange={(e) => setAssignShopId(e.target.value)}
                  required
                >
                  <option value="">{t("admin.staffPage.selectShop")}</option>
                  {shops.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mq-admin-modal-actions">
                <button
                  type="button"
                  className="mq-admin-btn mq-admin-btn-secondary"
                  onClick={closeAssign}
                >
                  {t("admin.common.cancel")}
                </button>
                <button
                  type="submit"
                  className="mq-admin-btn mq-admin-btn-approve"
                  disabled={updateRoles.isPending}
                >
                  {updateRoles.isPending ? t("admin.common.saving") : t("admin.common.save")}
                </button>
              </div>
            </form>
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

      {pending && confirmCopy ? (
        <AdminConfirmModal
          open
          title={confirmCopy.title}
          description={confirmCopy.description}
          confirmLabel={confirmCopy.confirmLabel}
          tone={confirmCopy.tone}
          busy={accountAction.isPending}
          onClose={() => setPending(null)}
          onConfirm={() =>
            accountAction.mutate(
              { userId: pending.userId, kind: pending.kind },
              { onSuccess: () => setPending(null) },
            )
          }
        />
      ) : null}
    </>
  );
}

export default function AdminStaffPage() {
  return (
    <AuthGuard
      roles={["ADMIN", "SUPER_ADMIN"]}
      permissions={["MANAGE_STAFF", "ASSIGN_ROLES"]}
    >
      <StaffInner />
    </AuthGuard>
  );
}
