"use client";

import { useState } from "react";
import { Check, Eye, ShieldAlert, X } from "lucide-react";
import {
  useAdminShops,
  useApproveShop,
  useRejectShop,
  useSuspendShop,
} from "@/lib/queries/admin";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import {
  AdminActions,
  AdminIconButton,
  AdminIconLink,
} from "@/components/admin/AdminIconButton";
import { AdminReasonModal } from "@/components/admin/AdminReasonModal";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { translateStatus } from "@/lib/i18n/status";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { AdminCardListSkeleton } from "@/components/ui/Skeleton";

type ReasonAction = {
  kind: "reject" | "violation";
  shopId: string;
  shopName: string;
};

function ShopsInner() {
  const { t } = useLanguage();
  const [status, setStatus] = useState("PENDING");
  const [page, setPage] = useState(1);
  const [reasonAction, setReasonAction] = useState<ReasonAction | null>(null);
  const { data, isLoading, isError, error } = useAdminShops(status, page);
  const shops = data?.items ?? [];
  const meta = data?.meta;
  const approveShop = useApproveShop();
  const rejectShop = useRejectShop();
  const suspendShop = useSuspendShop();

  const modalBusy =
    reasonAction?.kind === "reject" ? rejectShop.isPending : suspendShop.isPending;

  return (
    <>
      <AdminPageHeader
        title={t("admin.shops.title")}
        description={t("admin.shops.description")}
        actions={
          <select
            className="mq-input max-w-[11rem]"
            value={status}
            aria-label={t("admin.common.filterStatus")}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="PENDING">{t("admin.common.pending")}</option>
            <option value="APPROVED">{t("admin.common.approved")}</option>
            <option value="REJECTED">{t("admin.common.rejected")}</option>
          </select>
        }
      />

      <div className="space-y-4">
        {isError && (
          <div className="mq-alert mq-alert-error">
            {error instanceof Error ? error.message : t("admin.common.failed")}
          </div>
        )}
        {isLoading && <AdminCardListSkeleton />}
        {!isLoading && shops.length === 0 && (
          <p className="text-sm text-mq-text-muted py-6 text-center">
            {t("admin.shops.empty")}
          </p>
        )}
        {shops.map((s) => (
          <div key={s.id} className="mq-card p-4 flex flex-wrap justify-between gap-3 text-sm">
            <div>
              <p className="font-medium">{s.name}</p>
              <p className="text-mq-text-muted text-xs">
                {s.taxId || s.taxCode} · {s.countryCode} · {translateStatus(t, "shop", s.status)}
              </p>
            </div>
            <AdminActions>
              <AdminIconLink
                href={`/admin/shops/${s.id}`}
                label={t("admin.common.viewDetails")}
                icon={Eye}
              />
              <AdminIconButton
                label={t("admin.common.approve")}
                icon={Check}
                tone="approve"
                disabled={approveShop.isPending || s.status !== "PENDING"}
                onClick={() => void approveShop.mutateAsync(s.id)}
              />
              <AdminIconButton
                label={t("admin.common.reject")}
                icon={X}
                tone="reject"
                disabled={rejectShop.isPending || s.status !== "PENDING"}
                onClick={() =>
                  setReasonAction({ kind: "reject", shopId: s.id, shopName: s.name })
                }
              />
              <AdminIconButton
                label={t("admin.shops.violationLock")}
                icon={ShieldAlert}
                tone="warn"
                disabled={suspendShop.isPending || s.status !== "APPROVED"}
                onClick={() =>
                  setReasonAction({ kind: "violation", shopId: s.id, shopName: s.name })
                }
              />
            </AdminActions>
          </div>
        ))}
        <PaginationBar page={page} meta={meta} onPageChange={setPage} />
      </div>

      <AdminReasonModal
        open={!!reasonAction}
        title={
          reasonAction?.kind === "reject"
            ? t("admin.shops.rejectTitle")
            : t("admin.shops.violationLock")
        }
        description={
          reasonAction
            ? reasonAction.kind === "reject"
              ? `Tell the seller why “${reasonAction.shopName}” was rejected.`
              : `Optional note for locking “${reasonAction.shopName}”.`
            : undefined
        }
        confirmLabel={
          reasonAction?.kind === "reject"
            ? t("admin.common.reject")
            : t("admin.shops.lockTitle")
        }
        required={reasonAction?.kind === "reject"}
        busy={modalBusy}
        onClose={() => {
          if (!modalBusy) setReasonAction(null);
        }}
        onConfirm={async (reason) => {
          if (!reasonAction) return;
          if (reasonAction.kind === "reject") {
            await rejectShop.mutateAsync({ id: reasonAction.shopId, reason });
          } else {
            await suspendShop.mutateAsync({
              id: reasonAction.shopId,
              reason: reason || undefined,
            });
          }
          setReasonAction(null);
        }}
      />
    </>
  );
}

export default function AdminShopsPage() {
  return (
    <AuthGuard
      roles={["ADMIN", "SUPER_ADMIN"]}
      permissions={["APPROVE_SELLER", "APPROVE_SHOP"]}
    >
      <ShopsInner />
    </AuthGuard>
  );
}
