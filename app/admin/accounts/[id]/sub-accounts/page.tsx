"use client";

import Link from "next/link";
import { use, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { AdminReasonModal } from "@/components/admin/AdminReasonModal";
import { CreateSubAccountForm, SubAccountTable } from "@/components/sub-accounts/parts";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { AdminCardListSkeleton } from "@/components/ui/Skeleton";
import type { SubAccountItem } from "@/lib/api/sub-accounts";
import { canCreateSubAccountFor } from "@/lib/auth/admin-write";
import { useAccountRoot, useAdminCreateSubAccount, useDiscardPending, useSubAccountTree } from "@/lib/queries/sub-accounts";
import { getErrorMessage } from "@/lib/queries/utils";
import { TREE_DEFAULT_DEPTH, TREE_DEFAULT_LIMIT, treeRows } from "@/lib/sub-accounts/model";

function Inner({ id }: { id: string }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const canWrite = canCreateSubAccountFor(user);
  const tree = useSubAccountTree(id, TREE_DEFAULT_DEPTH, TREE_DEFAULT_LIMIT);
  const root = useAccountRoot(id);
  const create = useAdminCreateSubAccount(id);
  const discard = useDiscardPending();
  const [target, setTarget] = useState<SubAccountItem | null>(null);
  const rows = tree.data ? treeRows(tree.data) : [];

  return (
    <>
      <AdminPageHeader
        title={t("subAccounts.admin.title")}
        description={tree.data?.account?.email ? String(tree.data.account.email) : undefined}
        actions={
          <Link href="/admin/users" className="mq-admin-btn mq-admin-btn-secondary">
            <ArrowLeft size={16} aria-hidden />
            {t("subAccounts.admin.back")}
          </Link>
        }
      />
      <div className="space-y-6">
        {root.data ? (
          <div className="mq-card p-4 text-sm space-y-1">
            <p>
              <span className="text-mq-text-muted">{t("subAccounts.admin.root")}: </span>
              {root.data.root.email}
              {root.data.root.fullName ? ` (${root.data.root.fullName})` : ""}
            </p>
            <p className="text-xs text-mq-text-muted">
              {root.data.isSubAccount ? t("subAccounts.admin.isSub", { depth: String(root.data.depth) }) : t("subAccounts.admin.isRoot")}
            </p>
          </div>
        ) : null}
        {root.isError ? <div className="mq-alert mq-alert-error">{getErrorMessage(root.error, t("admin.common.failed"))}</div> : null}

        {canWrite ? (
          <CreateSubAccountForm
            admin
            busy={create.isPending}
            onSubmit={async (body) => {
              if (!body.reason) return false;
              try {
                await create.mutateAsync({ ...body, reason: body.reason });
                return true;
              } catch {
                return false;
              }
            }}
          />
        ) : (
          <p className="text-xs text-mq-text-muted">{t("subAccounts.admin.readOnly")}</p>
        )}

        {tree.isLoading ? <AdminCardListSkeleton count={2} /> : null}
        {tree.isError ? <div className="mq-alert mq-alert-error">{getErrorMessage(tree.error, t("admin.common.failed"))}</div> : null}
        {tree.data && rows.length === 0 ? <p className="text-sm text-mq-text-muted">{t("subAccounts.admin.empty")}</p> : null}
        {rows.length > 0 ? (
          <SubAccountTable items={rows} indent busy={discard.isPending} actionLabelKey={canWrite ? "subAccounts.admin.discard" : undefined} onAction={canWrite ? setTarget : undefined} />
        ) : null}
        {tree.data?.truncated ? <p className="text-xs text-mq-accent-orange">{t("subAccounts.admin.truncated", { limit: String(tree.data.limit) })}</p> : null}
      </div>
      <AdminReasonModal
        open={target !== null}
        title={t("subAccounts.admin.discardTitle")}
        description={t("subAccounts.admin.discardDesc", { email: target?.email ?? "" })}
        confirmLabel={t("subAccounts.admin.discard")}
        maxLength={500}
        busy={discard.isPending}
        onClose={() => setTarget(null)}
        onConfirm={async (reason) => {
          if (!target) return;
          try {
            await discard.mutateAsync({ id: target.id, reason });
            setTarget(null);
          } catch {
            /* toast shown by the hook */
          }
        }}
      />
    </>
  );
}

export default function AdminAccountSubAccountsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AuthGuard roles={["ACCOUNTANT", "ADMIN", "SUPER_ADMIN"]} permissions={["VIEW_USERS"]}>
      <Inner id={id} />
    </AuthGuard>
  );
}
