"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lock, Trash2, Unlock } from "lucide-react";
import { adminApi } from "@/lib/api";
import type { AuthUser } from "@/lib/api/types";
import { parsePage } from "@/lib/api/utils";
import { getErrorMessage } from "@/lib/queries/utils";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { AdminActions, AdminIconButton } from "@/components/admin/AdminIconButton";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { translateRoles, translateStatus } from "@/lib/i18n/status";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { TableSkeleton } from "@/components/ui/Skeleton";

function UsersInner() {
  const { t } = useLanguage();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

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
      toast.success(t("admin.common.updated"));
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const items = data?.items ?? [];
  const meta = data?.meta;

  return (
    <>
      <AdminPageHeader
        title={t("admin.users.title")}
        description={t("admin.users.description")}
        actions={
          <Link href="/admin/staff" className="mq-admin-btn mq-admin-btn-secondary">
            Manage staff
          </Link>
        }
      />

      <div className="space-y-6">
        {isError && (
          <div className="mq-alert mq-alert-error">
            {error instanceof Error ? error.message : t("admin.common.failed")}
          </div>
        )}

        <div className="flex flex-wrap gap-3 items-center">
          <select
            className="mq-input max-w-xs"
            value={status}
            aria-label={t("admin.common.filterStatus")}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">{t("admin.common.allStatuses")}</option>
            <option value="ACTIVE">{translateStatus(t, "user", "ACTIVE")}</option>
            <option value="LOCKED">{translateStatus(t, "user", "LOCKED")}</option>
          </select>
        </div>

        {isLoading ? (
          <TableSkeleton rows={6} cols={4} />
        ) : items.length === 0 ? (
          <p className="text-sm text-mq-text-muted">{t("admin.usersPage.empty")}</p>
        ) : (
          <div className="mq-table-wrap">
            <table className="w-full text-sm">
              <thead className="bg-mq-surface-subtle text-left">
                <tr>
                  <th className="p-3">{t("admin.common.email")}</th>
                  <th className="p-3">{t("admin.common.name")}</th>
                  <th className="p-3">{t("admin.common.status")}</th>
                  <th className="p-3">{t("admin.common.roles")}</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {items.map((u) => (
                  <tr key={u.id} className="border-t border-mq-border">
                    <td className="p-3">{u.email}</td>
                    <td className="p-3">{u.fullName || "—"}</td>
                    <td className="p-3">{u.status ? translateStatus(t, "user", u.status) : "—"}</td>
                    <td className="p-3">{translateRoles(t, u.roles)}</td>
                    <td className="p-3 whitespace-nowrap">
                      <AdminActions>
                        <AdminIconButton
                          label={t("admin.common.lock")}
                          icon={Lock}
                          tone="warn"
                          disabled={action.isPending}
                          onClick={() => void action.mutateAsync({ userId: u.id, kind: "lock" })}
                        />
                        <AdminIconButton
                          label={t("admin.common.unlock")}
                          icon={Unlock}
                          tone="approve"
                          disabled={action.isPending}
                          onClick={() => void action.mutateAsync({ userId: u.id, kind: "unlock" })}
                        />
                        <AdminIconButton
                          label={t("admin.common.delete")}
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
    </>
  );
}

export default function AdminUsersPage() {
  return (
    <AuthGuard
      roles={["ADMIN", "SUPER_ADMIN"]}
      permissions={["VIEW_USERS", "DELETE_ACCOUNT", "LOCK_USER", "UNLOCK_USER"]}
    >
      <UsersInner />
    </AuthGuard>
  );
}
