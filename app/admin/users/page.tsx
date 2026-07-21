"use client";

import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lock, Plus, Trash2, Unlock, X } from "lucide-react";
import { adminApi } from "@/lib/api";
import type { AuthUser } from "@/lib/api/types";
import { parsePage } from "@/lib/api/utils";
import { getErrorMessage } from "@/lib/queries/utils";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { AdminActions, AdminIconButton } from "@/components/admin/AdminIconButton";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { useCreateStaff } from "@/lib/queries/admin";

function UsersInner() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPassword, setStaffPassword] = useState("Password1");
  const queryClient = useQueryClient();
  const createStaff = useCreateStaff();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin", "users", status, page],
    queryFn: async () =>
      parsePage<AuthUser>(
        await adminApi.users({
          page,
          pageSize: 10,
          status: status || undefined,
        }),
      ),
  });

  const action = useMutation({
    mutationFn: async ({
      userId,
      kind,
    }: {
      userId: string;
      kind: "lock" | "unlock" | "delete";
    }) => {
      if (kind === "lock") return adminApi.lockUser(userId);
      if (kind === "unlock") return adminApi.unlockUser(userId);
      return adminApi.deleteUser(userId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success("Updated");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const items = data?.items ?? [];
  const meta = data?.meta;

  const closeCreate = () => {
    setCreateOpen(false);
    setStaffEmail("");
    setStaffPassword("Password1");
  };

  useEffect(() => {
    if (!createOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeCreate();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [createOpen]);

  const onCreateStaff = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await createStaff.mutateAsync({
        email: staffEmail,
        password: staffPassword,
        permissions: [],
      });
      void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      closeCreate();
    } catch {
      /* toast handled in mutation */
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Users"
        description="Manage accounts, locks, and staff creation."
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
            className="mq-input max-w-xs"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="LOCKED">LOCKED</option>
          </select>
        </div>

        {isLoading ? (
          <TableSkeleton rows={6} cols={4} />
        ) : (
          <div className="mq-table-wrap">
            <table className="w-full text-sm">
              <thead className="bg-mq-surface-subtle text-left">
                <tr>
                  <th className="p-3">Email</th>
                  <th className="p-3">Name</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Roles</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {items.map((u) => (
                  <tr key={u.id} className="border-t border-mq-border">
                    <td className="p-3">{u.email}</td>
                    <td className="p-3">{u.fullName || "—"}</td>
                    <td className="p-3">{u.status || "—"}</td>
                    <td className="p-3">{(u.roles || []).join(", ")}</td>
                    <td className="p-3 whitespace-nowrap">
                      <AdminActions>
                        <AdminIconButton
                          label="Lock"
                          icon={Lock}
                          tone="warn"
                          disabled={action.isPending}
                          onClick={() => void action.mutateAsync({ userId: u.id, kind: "lock" })}
                        />
                        <AdminIconButton
                          label="Unlock"
                          icon={Unlock}
                          tone="approve"
                          disabled={action.isPending}
                          onClick={() => void action.mutateAsync({ userId: u.id, kind: "unlock" })}
                        />
                        <AdminIconButton
                          label="Delete"
                          icon={Trash2}
                          tone="danger"
                          disabled={action.isPending}
                          onClick={() => void action.mutateAsync({ userId: u.id, kind: "delete" })}
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

      {createOpen && (
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
                Create staff
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
            <form className="mq-admin-modal-body space-y-3" onSubmit={(e) => void onCreateStaff(e)}>
              <div>
                <label className="block text-xs font-medium text-mq-text-muted mb-1.5">Email</label>
                <input
                  type="email"
                  className="mq-input"
                  value={staffEmail}
                  onChange={(e) => setStaffEmail(e.target.value)}
                  required
                  autoFocus
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-mq-text-muted mb-1.5">
                  Temporary password
                </label>
                <input
                  type="password"
                  className="mq-input"
                  value={staffPassword}
                  onChange={(e) => setStaffPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              <div className="mq-admin-modal-actions">
                <button type="button" className="mq-admin-btn mq-admin-btn-secondary" onClick={closeCreate}>
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
      )}
    </>
  );
}

export default function AdminUsersPage() {
  return (
    <AuthGuard
      roles={["ADMIN", "SUPER_ADMIN"]}
      permissions={["VIEW_USERS", "DELETE_ACCOUNT", "LOCK_USER", "UNLOCK_USER", "CREATE_STAFF"]}
    >
      <UsersInner />
    </AuthGuard>
  );
}
