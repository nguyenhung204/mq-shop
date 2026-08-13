"use client";

import Image from "next/image";
import Link from "next/link";
import { use, useState } from "react";
import { ArrowLeft, Check, Gavel, X } from "lucide-react";
import type { RmaStatus } from "@/lib/api/orders";
import {
  useAdminRmaDecision,
  useAdminRmaDetail,
  useAdminRmaForceAction,
  useAdminReopenDispute,
  useAdminResolveDispute,
} from "@/lib/queries/orders";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { AdminActions, AdminIconButton } from "@/components/admin/AdminIconButton";
import { AdminReasonModal } from "@/components/admin/AdminReasonModal";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { translateStatus } from "@/lib/i18n/status";
import { AdminCardListSkeleton } from "@/components/ui/Skeleton";
import { getErrorMessage } from "@/lib/queries/utils";

function isRequested(status: RmaStatus) {
  return status === "REQUESTED" || status === "PENDING";
}

type ForceKind =
  | "forceReceive"
  | "forceAccept"
  | "forceRefundSent"
  | "forceComplete"
  | "forceCloseAbandoned"
  | null;

function RmaDetailInner({ id }: { id: string }) {
  const { t } = useLanguage();
  const { data: rma, isLoading, isError, error } = useAdminRmaDetail(id);
  const rmaDecision = useAdminRmaDecision();
  const resolveDispute = useAdminResolveDispute();
  const reopenDispute = useAdminReopenDispute();
  const forceAction = useAdminRmaForceAction();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [disputeCloseOpen, setDisputeCloseOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [forceKind, setForceKind] = useState<ForceKind>(null);
  const busy =
    rmaDecision.isPending ||
    resolveDispute.isPending ||
    reopenDispute.isPending ||
    forceAction.isPending;
  const escalated = Boolean(rma?.escalatedAt);
  const canReopenDispute =
    rma?.status === "RETURN_REJECTED" ||
    (rma?.status === "CLOSED" && Boolean(rma.inspectionNote));

  return (
    <>
      <AdminPageHeader
        title={
          rma?.orderName ?? rma?.orderCode
            ? `RMA · ${rma.orderName ?? rma.orderCode}`
            : t("admin.rmaPage.detailTitle")
        }
        description={t("admin.rmaPage.detailDesc")}
        actions={
          <Link href="/admin/rma" className="mq-admin-btn mq-admin-btn-secondary">
            <ArrowLeft size={16} />
            {t("admin.rmaPage.backToInbox")}
          </Link>
        }
      />
      <div className="space-y-6 max-w-3xl">
        {isError && (
          <div className="mq-alert mq-alert-error">
            {getErrorMessage(error, t("admin.common.failed"))}
          </div>
        )}
        {isLoading && <AdminCardListSkeleton count={3} />}

        {rma && (
          <div className="mq-card p-6 space-y-5 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="mq-badge mq-badge-pink">
                    {translateStatus(t, "rma", rma.status)}
                  </span>
                  {rma.orderStatus ? (
                    <span className="mq-badge mq-badge-cyan">
                      {t("admin.rmaPage.order")} ·{" "}
                      {translateStatus(t, "order", rma.orderStatus)}
                    </span>
                  ) : null}
                  {escalated ? (
                    <span className="mq-badge mq-badge-orange">
                      {t("admin.rmaPage.escalatedBadge")}
                    </span>
                  ) : null}
                </div>
              </div>
              {isRequested(rma.status) ? (
                <AdminActions>
                  <AdminIconButton
                    label={t("admin.common.approve")}
                    icon={Check}
                    tone="approve"
                    disabled={busy}
                    onClick={() =>
                      void rmaDecision.mutateAsync({ id: rma.id, decision: "APPROVED" })
                    }
                  />
                  <AdminIconButton
                    label={t("admin.common.reject")}
                    icon={X}
                    tone="reject"
                    disabled={busy}
                    onClick={() => setRejectOpen(true)}
                  />
                </AdminActions>
              ) : null}
              {rma.status === "DISPUTED" ? (
                <AdminActions>
                  <AdminIconButton
                    label={t("admin.rmaPage.sideBuyer")}
                    icon={Gavel}
                    tone="approve"
                    disabled={busy}
                    onClick={() =>
                      void resolveDispute.mutateAsync({
                        id: rma.id,
                        decision: "REFUND_PENDING",
                      })
                    }
                  />
                  <AdminIconButton
                    label={t("admin.rmaPage.upholdReject")}
                    icon={X}
                    tone="reject"
                    disabled={busy}
                    onClick={() => setDisputeCloseOpen(true)}
                  />
                </AdminActions>
              ) : null}
              {canReopenDispute ? (
                <AdminActions>
                  <AdminIconButton
                    label={t("admin.rmaPage.reopenDispute")}
                    icon={Gavel}
                    tone="approve"
                    disabled={busy}
                    onClick={() => setReopenOpen(true)}
                  />
                </AdminActions>
              ) : null}
            </div>

            {escalated ? (
              <div className="rounded-[var(--mq-radius-sm)] border border-mq-border bg-mq-surface-subtle p-3 space-y-3">
                <p className="text-sm text-mq-text-secondary">
                  {t("admin.rmaPage.escalatedHint")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {rma.status === "APPROVED" ? (
                    <button
                      type="button"
                      className="mq-btn mq-btn-outline text-xs"
                      disabled={busy}
                      onClick={() => setForceKind("forceCloseAbandoned")}
                    >
                      {t("admin.rmaPage.forceCloseAbandoned")}
                    </button>
                  ) : null}
                  {rma.status === "RETURN_SHIPPED" ? (
                    <button
                      type="button"
                      className="mq-btn mq-btn-outline text-xs"
                      disabled={busy}
                      onClick={() => setForceKind("forceReceive")}
                    >
                      {t("admin.rmaPage.forceReceive")}
                    </button>
                  ) : null}
                  {rma.status === "RETURN_RECEIVED" ? (
                    <button
                      type="button"
                      className="mq-btn mq-btn-outline text-xs"
                      disabled={busy}
                      onClick={() => setForceKind("forceAccept")}
                    >
                      {t("admin.rmaPage.forceAccept")}
                    </button>
                  ) : null}
                  {rma.status === "REFUND_PENDING" ? (
                    <>
                      <button
                        type="button"
                        className="mq-btn mq-btn-outline text-xs"
                        disabled={busy}
                        onClick={() => setForceKind("forceRefundSent")}
                      >
                        {t("admin.rmaPage.forceRefundSent")}
                      </button>
                      <button
                        type="button"
                        className="mq-btn mq-btn-primary text-xs"
                        disabled={busy}
                        onClick={() => setForceKind("forceComplete")}
                      >
                        {t("admin.rmaPage.forceComplete")}
                      </button>
                    </>
                  ) : null}
                  {rma.status === "REFUND_SENT" || rma.status === "DISPUTED" ? (
                    <button
                      type="button"
                      className="mq-btn mq-btn-primary text-xs"
                      disabled={busy}
                      onClick={() => setForceKind("forceComplete")}
                    >
                      {t("admin.rmaPage.forceComplete")}
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <dt className="text-xs text-mq-text-muted">{t("admin.rmaPage.order")}</dt>
                <dd>
                  {rma.orderId ? (
                    <Link
                      href={`/orders/${rma.orderId}`}
                      className="hover:text-mq-gold transition-colors"
                    >
                      {rma.orderName ?? rma.orderCode ?? rma.orderId.slice(0, 8)}
                    </Link>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-mq-text-muted">{t("admin.rmaPage.created")}</dt>
                <dd>{new Date(rma.createdAt).toLocaleString()}</dd>
              </div>
              {rma.buyerId ? (
                <div>
                  <dt className="text-xs text-mq-text-muted">{t("admin.rmaPage.buyer")}</dt>
                  <dd>
                    {rma.buyerName ?? (
                      <span className="font-mono text-xs">{rma.buyerId.slice(0, 8)}…</span>
                    )}
                  </dd>
                </div>
              ) : null}
              {rma.shopId ? (
                <div>
                  <dt className="text-xs text-mq-text-muted">{t("admin.rmaPage.shop")}</dt>
                  <dd>
                    {rma.shopName ?? (
                      <span className="font-mono text-xs">{rma.shopId.slice(0, 8)}…</span>
                    )}
                  </dd>
                </div>
              ) : null}
              {rma.returnTrackingCode ? (
                <div>
                  <dt className="text-xs text-mq-text-muted">{t("admin.rmaPage.tracking")}</dt>
                  <dd>
                    {rma.returnCarrier ? `${rma.returnCarrier} · ` : ""}
                    {rma.returnTrackingCode}
                  </dd>
                </div>
              ) : null}
              {rma.decidedAt ? (
                <div>
                  <dt className="text-xs text-mq-text-muted">{t("admin.rmaPage.decided")}</dt>
                  <dd>{new Date(rma.decidedAt).toLocaleString()}</dd>
                </div>
              ) : null}
            </dl>

            <div>
              <h3 className="text-xs uppercase tracking-wide text-mq-text-muted mb-1">
                {t("admin.common.reason")}
              </h3>
              <p className="text-mq-text-secondary whitespace-pre-wrap">{rma.reason}</p>
            </div>

            {rma.disputeReason ? (
              <div>
                <h3 className="text-xs uppercase tracking-wide text-mq-text-muted mb-1">
                  {t("admin.rmaPage.dispute")}
                </h3>
                <p className="text-mq-text-secondary whitespace-pre-wrap">{rma.disputeReason}</p>
              </div>
            ) : null}

            {rma.inspectionNote ? (
              <div>
                <h3 className="text-xs uppercase tracking-wide text-mq-text-muted mb-1">
                  {t("admin.rmaPage.inspectionNote")}
                </h3>
                <p className="text-mq-text-secondary whitespace-pre-wrap">{rma.inspectionNote}</p>
              </div>
            ) : null}

            {rma.refundProofUrl ? (
              <div>
                <h3 className="text-xs uppercase tracking-wide text-mq-text-muted mb-2">
                  {t("admin.rmaPage.refundProofTitle")}
                </h3>
                <a
                  href={rma.refundProofUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="relative block max-w-xs overflow-hidden rounded-[var(--mq-radius-sm)] border border-mq-border"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={rma.refundProofUrl}
                    alt={t("admin.rmaPage.refundProofAlt")}
                    className="max-h-56 w-auto object-contain bg-white"
                  />
                </a>
              </div>
            ) : null}

            {rma.reviewNote ? (
              <div>
                <h3 className="text-xs uppercase tracking-wide text-mq-text-muted mb-1">
                  {t("admin.rmaPage.reviewNote")}
                </h3>
                <p className="text-mq-text-secondary whitespace-pre-wrap">{rma.reviewNote}</p>
              </div>
            ) : null}

            {rma.bankInfo ? (
              <div>
                <h3 className="text-xs uppercase tracking-wide text-mq-text-muted mb-2">
                  {t("admin.rmaPage.bankInfoTitle")}
                </h3>
                <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-[var(--mq-radius-sm)] border border-mq-border bg-mq-surface-subtle p-3">
                  <div>
                    <dt className="text-xs text-mq-text-muted">{t("admin.rmaPage.bank")}</dt>
                    <dd>{rma.bankInfo.bankName}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-mq-text-muted">{t("admin.rmaPage.account")}</dt>
                    <dd className="font-mono text-xs">{rma.bankInfo.accountNumber}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-mq-text-muted">{t("admin.common.name")}</dt>
                    <dd>{rma.bankInfo.accountName}</dd>
                  </div>
                </dl>
              </div>
            ) : null}

            <div>
              <h3 className="text-xs uppercase tracking-wide text-mq-text-muted mb-2">
                {t("admin.rmaPage.evidenceTitle", {
                  count: String(rma.evidenceUrls?.length ?? 0),
                })}
              </h3>
              {(rma.evidenceUrls?.length ?? 0) === 0 ? (
                <p className="text-mq-text-muted text-xs">{t("admin.rmaPage.noEvidence")}</p>
              ) : (
                <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {rma.evidenceUrls.map((url) => (
                    <li key={url}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="relative block aspect-square overflow-hidden rounded-[var(--mq-radius-sm)] border border-mq-border mq-product-image-bg"
                      >
                        <Image
                          src={url}
                          alt={t("admin.rmaPage.evidenceAlt")}
                          fill
                          className="object-cover"
                          sizes="160px"
                        />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      <AdminReasonModal
        open={rejectOpen}
        title={t("admin.rmaPage.rejectTitle")}
        description={t("admin.rmaPage.rejectDesc")}
        confirmLabel={t("admin.common.reject")}
        maxLength={500}
        busy={busy}
        onClose={() => setRejectOpen(false)}
        onConfirm={async (note) => {
          await rmaDecision.mutateAsync({ id, decision: "REJECTED", note });
          setRejectOpen(false);
        }}
      />

      <AdminReasonModal
        open={disputeCloseOpen}
        title={t("admin.rmaPage.upholdRejectTitle")}
        description={t("admin.rmaPage.upholdRejectDesc")}
        confirmLabel={t("admin.rmaPage.upholdReject")}
        maxLength={500}
        busy={busy}
        onClose={() => setDisputeCloseOpen(false)}
        onConfirm={async (note) => {
          await resolveDispute.mutateAsync({ id, decision: "CLOSED", note });
          setDisputeCloseOpen(false);
        }}
      />

      <AdminReasonModal
        open={reopenOpen}
        title={t("admin.rmaPage.reopenDisputeTitle")}
        description={t("admin.rmaPage.reopenDisputeDesc")}
        confirmLabel={t("admin.rmaPage.reopenDispute")}
        maxLength={500}
        busy={busy}
        onClose={() => setReopenOpen(false)}
        onConfirm={async (reason) => {
          await reopenDispute.mutateAsync({ id, reason });
          setReopenOpen(false);
        }}
      />

      <AdminReasonModal
        open={Boolean(forceKind)}
        title={t("admin.rmaPage.forceNoteTitle")}
        description={t("admin.rmaPage.forceNoteDesc")}
        confirmLabel={t("admin.common.confirm")}
        required={forceKind === "forceRefundSent" || forceKind === "forceComplete"}
        maxLength={500}
        busy={busy}
        onClose={() => setForceKind(null)}
        onConfirm={async (note) => {
          if (!forceKind) return;
          await forceAction.mutateAsync({
            id,
            action: forceKind,
            note: note.trim() || undefined,
          });
          setForceKind(null);
        }}
      />
    </>
  );
}

export default function AdminRmaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <AuthGuard
      roles={["ADMIN", "SUPER_ADMIN", "ACCOUNTANT", "CS", "WAREHOUSE"]}
      permissions={["PROCESS_RMA", "MANAGE_RMA"]}
    >
      <RmaDetailInner id={id} />
    </AuthGuard>
  );
}
