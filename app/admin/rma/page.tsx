"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Eye, Gavel, X } from "lucide-react";
import type { RmaStatus } from "@/lib/api/orders";
import {
  useAdminRma,
  useAdminRmaDecision,
  useAdminResolveDispute,
} from "@/lib/queries/orders";
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
import { AdminCardListSkeleton } from "@/components/ui/Skeleton";
import { getErrorMessage } from "@/lib/queries/utils";

function isRequested(status: RmaStatus) {
  return status === "REQUESTED" || status === "PENDING";
}

type FilterValue = RmaStatus | "ESCALATED" | "";

function RmaInner() {
  const { t } = useLanguage();
  const [filter, setFilter] = useState<FilterValue>("REQUESTED");
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [disputeCloseId, setDisputeCloseId] = useState<string | null>(null);
  const escalatedOnly = filter === "ESCALATED";
  const status = escalatedOnly || !filter ? undefined : filter;
  const { data, isLoading, isError, error } = useAdminRma(status, escalatedOnly);
  const items = data?.items ?? [];
  const rmaDecision = useAdminRmaDecision();
  const resolveDispute = useAdminResolveDispute();
  const busy = rmaDecision.isPending || resolveDispute.isPending;

  return (
    <>
      <AdminPageHeader
        title={t("admin.rma.title")}
        description={t("admin.rma.description")}
      />
      <div className="space-y-4">
        <select
          className="mq-input max-w-[16rem]"
          value={filter}
          aria-label={t("admin.common.filterStatus")}
          onChange={(e) => setFilter(e.target.value as FilterValue)}
        >
          <option value="">{t("admin.common.all")}</option>
          <option value="ESCALATED">{t("admin.rmaPage.escalated")}</option>
          <option value="REQUESTED">{translateStatus(t, "rma", "REQUESTED")}</option>
          <option value="DISPUTED">{translateStatus(t, "rma", "DISPUTED")}</option>
          <option value="APPROVED">{translateStatus(t, "rma", "APPROVED")}</option>
          <option value="RETURN_SHIPPED">{translateStatus(t, "rma", "RETURN_SHIPPED")}</option>
          <option value="RETURN_RECEIVED">{translateStatus(t, "rma", "RETURN_RECEIVED")}</option>
          <option value="RETURN_REJECTED">{translateStatus(t, "rma", "RETURN_REJECTED")}</option>
          <option value="REFUND_PENDING">{translateStatus(t, "rma", "REFUND_PENDING")}</option>
          <option value="REFUND_SENT">{translateStatus(t, "rma", "REFUND_SENT")}</option>
          <option value="GOODS_RETURN_PENDING">{translateStatus(t, "rma", "GOODS_RETURN_PENDING")}</option>
          <option value="GOODS_RETURN_SHIPPED">{translateStatus(t, "rma", "GOODS_RETURN_SHIPPED")}</option>
          <option value="COMPLETED">{translateStatus(t, "rma", "COMPLETED")}</option>
          <option value="REJECTED">{t("admin.common.rejected")}</option>
          <option value="CLOSED">{t("admin.rmaPage.closed")}</option>
        </select>
        {isError && (
          <div className="mq-alert mq-alert-error">
            {getErrorMessage(error, t("admin.common.failed"))}
          </div>
        )}
        {isLoading && <AdminCardListSkeleton />}
        {items.map((r) => (
          <div
            key={r.id}
            className="mq-card p-4 flex flex-wrap justify-between gap-3 text-sm"
          >
            <div className="min-w-0">
              <Link
                href={`/admin/rma/${r.id}`}
                className="font-medium hover:text-mq-gold transition-colors"
              >
                {t("admin.rmaPage.order")} {r.orderName ?? r.orderId.slice(0, 8)}
              </Link>
              <span className="mq-badge mq-badge-pink ml-2">
                {translateStatus(t, "rma", r.status)}
              </span>
              {r.escalatedAt ? (
                <span className="mq-badge mq-badge-orange ml-2">
                  {t("admin.rmaPage.escalatedBadge")}
                </span>
              ) : null}
              <p className="text-xs text-mq-text-muted line-clamp-2 mt-1">{r.reason}</p>
              {r.disputeReason ? (
                <p className="text-xs text-mq-text-muted mt-1">
                  {t("admin.rmaPage.dispute")}: {r.disputeReason}
                </p>
              ) : null}
            </div>
            <AdminActions>
              <AdminIconLink
                label={t("admin.common.view")}
                icon={Eye}
                href={`/admin/rma/${r.id}`}
              />
              {isRequested(r.status) ? (
                <>
                  <AdminIconButton
                    label={t("admin.common.approve")}
                    icon={Check}
                    tone="approve"
                    disabled={busy}
                    onClick={() =>
                      void rmaDecision.mutateAsync({ id: r.id, decision: "APPROVED" })
                    }
                  />
                  <AdminIconButton
                    label={t("admin.common.reject")}
                    icon={X}
                    tone="reject"
                    disabled={busy}
                    onClick={() => setRejectId(r.id)}
                  />
                </>
              ) : null}
              {r.status === "DISPUTED" ? (
                <>
                  <AdminIconButton
                    label={t("admin.rmaPage.sideBuyer")}
                    icon={Gavel}
                    tone="approve"
                    disabled={busy}
                    onClick={() =>
                      void resolveDispute.mutateAsync({
                        id: r.id,
                        decision: "REFUND_PENDING",
                      })
                    }
                  />
                  <AdminIconButton
                    label={t("admin.rmaPage.upholdReject")}
                    icon={X}
                    tone="reject"
                    disabled={busy}
                    onClick={() => setDisputeCloseId(r.id)}
                  />
                </>
              ) : null}
            </AdminActions>
          </div>
        ))}
        {!isLoading && items.length === 0 ? (
          <p className="text-sm text-mq-text-muted">{t("admin.rmaPage.empty")}</p>
        ) : null}
      </div>

      <AdminReasonModal
        open={Boolean(rejectId)}
        title={t("admin.rmaPage.rejectTitle")}
        description={t("admin.rmaPage.rejectDesc")}
        confirmLabel={t("admin.common.reject")}
        maxLength={500}
        busy={busy}
        onClose={() => setRejectId(null)}
        onConfirm={async (note) => {
          if (!rejectId) return;
          await rmaDecision.mutateAsync({
            id: rejectId,
            decision: "REJECTED",
            note,
          });
          setRejectId(null);
        }}
      />

      <AdminReasonModal
        open={Boolean(disputeCloseId)}
        title={t("admin.rmaPage.upholdRejectTitle")}
        description={t("admin.rmaPage.upholdRejectDesc")}
        confirmLabel={t("admin.rmaPage.upholdReject")}
        maxLength={500}
        busy={busy}
        onClose={() => setDisputeCloseId(null)}
        onConfirm={async (note) => {
          if (!disputeCloseId) return;
          await resolveDispute.mutateAsync({
            id: disputeCloseId,
            decision: "CLOSED",
            note,
          });
          setDisputeCloseId(null);
        }}
      />
    </>
  );
}

export default function AdminRmaPage() {
  return (
    <AuthGuard
      roles={["ADMIN", "SUPER_ADMIN", "ACCOUNTANT", "CS", "WAREHOUSE"]}
      permissions={["PROCESS_RMA", "MANAGE_RMA"]}
    >
      <RmaInner />
    </AuthGuard>
  );
}
