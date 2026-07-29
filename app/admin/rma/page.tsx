"use client";

import Link from "next/link";
import { useState } from "react";
import { Banknote, Check, Eye, X } from "lucide-react";
import type { RmaStatus } from "@/lib/api/orders";
import {
  useAdminRma,
  useAdminRmaDecision,
  useAdminRmaMarkRefunded,
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

function RmaInner() {
  const { t } = useLanguage();
  const [status, setStatus] = useState<RmaStatus | "">("");
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [refundId, setRefundId] = useState<string | null>(null);
  const { data, isLoading, isError, error } = useAdminRma(status || undefined);
  const items = data?.items ?? [];
  const rmaDecision = useAdminRmaDecision();
  const markRefunded = useAdminRmaMarkRefunded();
  const busy = rmaDecision.isPending || markRefunded.isPending;

  return (
    <>
      <AdminPageHeader
        title={t("admin.rma.title")}
        description={t("admin.rma.description")}
      />
      <div className="space-y-4">
        <select
          className="mq-input max-w-[12rem]"
          value={status}
          aria-label={t("admin.common.filterStatus")}
          onChange={(e) => setStatus(e.target.value as RmaStatus | "")}
        >
          <option value="">{t("admin.common.all")}</option>
          <option value="PENDING">{t("admin.rmaPage.pending")}</option>
          <option value="APPROVED">{t("admin.rmaPage.approvedPayout")}</option>
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
                {t("admin.rmaPage.order")} {r.orderId.slice(0, 8)}…
              </Link>
              <span className="mq-badge mq-badge-pink ml-2">{translateStatus(t, "rma", r.status)}</span>
              <p className="text-xs text-mq-text-muted line-clamp-2 mt-1">{r.reason}</p>
              {r.bankInfo ? (
                <p className="text-xs text-mq-text-muted mt-1">
                  {r.bankInfo.bankName} · {r.bankInfo.accountNumber}
                </p>
              ) : null}
              {(r.evidenceUrls?.length ?? 0) > 0 ? (
                <p className="text-xs text-mq-text-muted mt-1">
                  {r.evidenceUrls.length} evidence image(s)
                </p>
              ) : null}
            </div>
            <AdminActions>
              <AdminIconLink
                label={t("admin.common.view")}
                icon={Eye}
                href={`/admin/rma/${r.id}`}
              />
              {r.status === "PENDING" ? (
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
              {r.status === "APPROVED" ? (
                <AdminIconButton
                  label={t("admin.common.markRefunded")}
                  icon={Banknote}
                  tone="approve"
                  disabled={busy}
                  onClick={() => setRefundId(r.id)}
                />
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
        open={Boolean(refundId)}
        title={t("admin.rmaPage.markRefundedTitle")}
        description={t("admin.rmaPage.markRefundedDesc")}
        confirmLabel={t("admin.common.markRefunded")}
        required={false}
        maxLength={500}
        busy={busy}
        onClose={() => setRefundId(null)}
        onConfirm={async (note) => {
          if (!refundId) return;
          await markRefunded.mutateAsync({
            id: refundId,
            note: note.trim() || undefined,
          });
          setRefundId(null);
        }}
      />
    </>
  );
}

export default function AdminRmaPage() {
  return (
    <AuthGuard
      roles={["ADMIN", "SUPER_ADMIN", "ACCOUNTANT"]}
      permissions={["PROCESS_RMA", "MANAGE_RMA"]}
    >
      <RmaInner />
    </AuthGuard>
  );
}
