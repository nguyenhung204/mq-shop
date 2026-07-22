"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Lock, Pencil, Plus, Trash2, Unlock, UserPlus, X } from "lucide-react";
import type { AuthUser, StaffPoolRole, StaffRole } from "@/lib/api/types";
import {
  useAdminShops,
  useAdminStaffList,
  useCreateStaff,
  useStaffAccountAction,
  useUpdateStaffRoles,
} from "@/lib/queries/admin";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { AdminActions, AdminIconButton } from "@/components/admin/AdminIconButton";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { TableSkeleton } from "@/components/ui/Skeleton";

const STAFF_ROLES: StaffRole[] = ["WAREHOUSE", "CS", "ACCOUNTANT"];
const POOL_FILTERS: StaffPoolRole[] = ["BUYER", "WAREHOUSE", "CS", "ACCOUNTANT"];

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

function StaffInner() {
  const [shopFilter, setShopFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState<StaffPoolRole | "">("BUYER");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState<AuthUser | null>(null);
  const [createdCred, setCreatedCred] = useState<{
    email: string;
    temporaryPassword: string;
  } | null>(null);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<StaffRole>("WAREHOUSE");
  const [shopId, setShopId] = useState("");
  const [assignRole, setAssignRole] = useState<StaffRole>("WAREHOUSE");
  const [assignShopId, setAssignShopId] = useState("");

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
    page,
    pageSize: 20,
  });
  const createStaff = useCreateStaff();
  const updateRoles = useUpdateStaffRoles();
  const accountAction = useStaffAccountAction();

  const items = data?.items ?? [];
  const meta = data?.meta;

  const closeCreate = () => {
    setCreateOpen(false);
    setEmail("");
    setFullName("");
    setRole("WAREHOUSE");
    setShopId("");
  };

  const closeAssign = () => {
    setAssignOpen(null);
    setAssignRole("WAREHOUSE");
    setAssignShopId("");
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
    try {
      const res = await createStaff.mutateAsync({
        email: email.trim(),
        fullName: fullName.trim() || undefined,
        role,
        shopId,
      });
      closeCreate();
      setCreatedCred({
        email: res.user.email,
        temporaryPassword: res.temporaryPassword,
      });
    } catch {
      /* toast in mutation */
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
    if (!assignShopId) {
      toast.error("Shop is required when assigning a staff role.");
      return;
    }
    try {
      await updateRoles.mutateAsync({
        userId: assignOpen.id,
        body: {
          roles: [assignRole],
          shopId: assignShopId,
        },
      });
      closeAssign();
      if (roleFilter === "BUYER") setRoleFilter(assignRole);
    } catch {
      /* toast */
    }
  };

  const copyPassword = async () => {
    if (!createdCred) return;
    try {
      await navigator.clipboard.writeText(createdCred.temporaryPassword);
      toast.success("Password copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Shop staff"
        description="Pool: BUYER candidates (no SELLER) and assigned WAREHOUSE / CS / ACCOUNTANT. Prefer Assign role on an existing BUYER; Create only for a brand-new email."
        actions={
          <button
            type="button"
            className="mq-admin-btn mq-admin-btn-approve"
            onClick={() => setCreateOpen(true)}
          >
            <Plus size={16} strokeWidth={2.25} />
            Create staff
          </button>
        }
      />

      <div className="space-y-6">
        {isError && (
          <div className="mq-alert mq-alert-error">
            {error instanceof Error ? error.message : "Failed"}
          </div>
        )}

        <div className="flex flex-wrap gap-3 items-center">
          <select
            className="mq-input max-w-[16rem]"
            value={shopFilter}
            aria-label="Filter by shop"
            onChange={(e) => {
              setShopFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All shops (+ unassigned BUYER)</option>
            {shops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            className="mq-input max-w-[11rem]"
            value={roleFilter}
            aria-label="Filter by role"
            onChange={(e) => {
              setRoleFilter(e.target.value as StaffPoolRole | "");
              setPage(1);
            }}
          >
            <option value="">All pool</option>
            {POOL_FILTERS.map((r) => (
              <option key={r} value={r}>
                {r === "BUYER" ? "BUYER (candidates)" : r}
              </option>
            ))}
          </select>
        </div>

        {isLoading ? (
          <TableSkeleton rows={6} cols={5} />
        ) : items.length === 0 ? (
          <p className="text-sm text-mq-text-muted">No users for this filter.</p>
        ) : (
          <div className="mq-table-wrap">
            <table className="w-full text-sm">
              <thead className="bg-mq-surface-subtle text-left">
                <tr>
                  <th className="p-3">Email</th>
                  <th className="p-3">Name</th>
                  <th className="p-3">Shop</th>
                  <th className="p-3">Roles</th>
                  <th className="p-3">Status</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {items.map((u) => {
                  const candidate = isBuyerCandidate(u);
                  return (
                    <tr key={u.id} className="border-t border-mq-border">
                      <td className="p-3">{u.email}</td>
                      <td className="p-3">{u.fullName || "—"}</td>
                      <td className="p-3 text-xs text-mq-text-secondary">
                        {u.shopId ? shopName(u.shopId) : (
                          <span className="text-mq-text-muted">Unassigned</span>
                        )}
                      </td>
                      <td className="p-3">
                        {(u.roles || []).join(", ")}
                        {candidate ? (
                          <span className="ml-2 mq-badge mq-badge-cyan text-[10px]">
                            Candidate
                          </span>
                        ) : null}
                      </td>
                      <td className="p-3">{u.status || "—"}</td>
                      <td className="p-3 whitespace-nowrap">
                        <AdminActions>
                          <AdminIconButton
                            label={candidate ? "Assign role" : "Edit roles"}
                            icon={candidate ? UserPlus : Pencil}
                            tone={candidate ? "approve" : "secondary"}
                            disabled={updateRoles.isPending}
                            onClick={() => openAssign(u)}
                          />
                          {!candidate ? (
                            <>
                              <AdminIconButton
                                label="Lock"
                                icon={Lock}
                                tone="warn"
                                disabled={accountAction.isPending}
                                onClick={() =>
                                  void accountAction.mutateAsync({
                                    userId: u.id,
                                    kind: "lock",
                                  })
                                }
                              />
                              <AdminIconButton
                                label="Unlock"
                                icon={Unlock}
                                tone="approve"
                                disabled={accountAction.isPending}
                                onClick={() =>
                                  void accountAction.mutateAsync({
                                    userId: u.id,
                                    kind: "unlock",
                                  })
                                }
                              />
                              <AdminIconButton
                                label="Delete"
                                icon={Trash2}
                                tone="danger"
                                disabled={accountAction.isPending}
                                onClick={() => {
                                  if (
                                    typeof window !== "undefined" &&
                                    !window.confirm(`Delete staff ${u.email}?`)
                                  ) {
                                    return;
                                  }
                                  void accountAction.mutateAsync({
                                    userId: u.id,
                                    kind: "delete",
                                  });
                                }}
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
            aria-label="Close dialog"
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
                Create shop staff
              </h2>
              <button
                type="button"
                className="mq-admin-icon-btn"
                aria-label="Close"
                onClick={closeCreate}
              >
                <X size={16} />
              </button>
            </div>
            <form className="mq-admin-modal-body space-y-3" onSubmit={(e) => void onCreate(e)}>
              <p className="text-xs text-mq-text-muted">
                Only when the email does not exist yet. Prefer Assign on a BUYER candidate.
              </p>
              <div>
                <label className="block text-xs font-medium text-mq-text-muted mb-1.5">Email</label>
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
                  Full name (optional)
                </label>
                <input
                  className="mq-input"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  maxLength={200}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-mq-text-muted mb-1.5">Role</label>
                <select
                  className="mq-input"
                  value={role}
                  onChange={(e) => setRole(e.target.value as StaffRole)}
                  required
                >
                  {STAFF_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-mq-text-muted mb-1.5">
                  Shop (APPROVED)
                </label>
                <select
                  className="mq-input"
                  value={shopId}
                  onChange={(e) => setShopId(e.target.value)}
                  required
                >
                  <option value="">Select shop</option>
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
                  Cancel
                </button>
                <button
                  type="submit"
                  className="mq-admin-btn mq-admin-btn-approve"
                  disabled={createStaff.isPending}
                >
                  {createStaff.isPending ? "Creating…" : "Create"}
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
            aria-label="Close dialog"
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
                {isBuyerCandidate(assignOpen) ? "Assign staff role" : "Edit staff roles"} —{" "}
                {assignOpen.email}
              </h2>
              <button
                type="button"
                className="mq-admin-icon-btn"
                aria-label="Close"
                onClick={closeAssign}
              >
                <X size={16} />
              </button>
            </div>
            <form className="mq-admin-modal-body space-y-3" onSubmit={(e) => void onAssign(e)}>
              <div>
                <label className="block text-xs font-medium text-mq-text-muted mb-1.5">Role</label>
                <select
                  className="mq-input"
                  value={assignRole}
                  onChange={(e) => setAssignRole(e.target.value as StaffRole)}
                  required
                >
                  {STAFF_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-mq-text-muted mb-1.5">
                  Shop {isBuyerCandidate(assignOpen) ? "(required)" : ""}
                </label>
                <select
                  className="mq-input"
                  value={assignShopId}
                  onChange={(e) => setAssignShopId(e.target.value)}
                  required
                >
                  <option value="">Select shop</option>
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
                  Cancel
                </button>
                <button
                  type="submit"
                  className="mq-admin-btn mq-admin-btn-approve"
                  disabled={updateRoles.isPending}
                >
                  {updateRoles.isPending ? "Saving…" : "Save"}
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
            aria-label="Close dialog"
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
                Temporary password
              </h2>
              <button
                type="button"
                className="mq-admin-icon-btn"
                aria-label="Close"
                onClick={() => setCreatedCred(null)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="mq-admin-modal-body space-y-3">
              <p className="text-sm text-mq-text-secondary">
                Copy now — it will not be shown again. Account:{" "}
                <strong>{createdCred.email}</strong>
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
                  Copy
                </button>
              </div>
              <div className="mq-admin-modal-actions">
                <button
                  type="button"
                  className="mq-admin-btn mq-admin-btn-approve"
                  onClick={() => setCreatedCred(null)}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
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
