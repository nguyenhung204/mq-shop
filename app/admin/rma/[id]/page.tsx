"use client";

import Image from "next/image";
import Link from "next/link";
import { use, useState } from "react";
import { ArrowLeft, Banknote, Check, X } from "lucide-react";
import {
  useAdminRmaDecision,
  useAdminRmaDetail,
  useAdminRmaMarkRefunded,
} from "@/lib/queries/orders";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { AdminActions, AdminIconButton } from "@/components/admin/AdminIconButton";
import { AdminReasonModal } from "@/components/admin/AdminReasonModal";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { translateStatus } from "@/lib/i18n/status";
import { AdminCardListSkeleton } from "@/components/ui/Skeleton";
import { getErrorMessage } from "@/lib/queries/utils";

function RmaDetailInner({ id }: { id: string }) {
  const { t } = useLanguage();
  const { data: rma, isLoading, isError, error } = useAdminRmaDetail(id);
  const rmaDecision = useAdminRmaDecision();
  const markRefunded = useAdminRmaMarkRefunded();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const busy = rmaDecision.isPending || markRefunded.isPending;
  const canMarkRefunded =
    rma?.status === "APPROVED" && rma.orderStatus === "REFUND_APPROVED";

  return (
    <>
      <AdminPageHeader
        title={rma?.orderName ?? rma?.orderCode ? `RMA · ${rma.orderName ?? rma.orderCode}` : t("admin.rmaPage.detailTitle")}
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
                  <span className="mq-badge mq-badge-pink">{translateStatus(t, "rma", rma.status)}</span>
                  {rma.orderStatus ? (
                    <span className="mq-badge mq-badge-cyan">
                      {t("admin.rmaPage.order")} · {translateStatus(t, "order", rma.orderStatus)}
                    </span>
                  ) : null}
                </div>
              </div>
              {rma.status === "PENDING" ? (
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
              {canMarkRefunded ? (
                <AdminActions>
                  <AdminIconButton
                    label={t("admin.common.markRefunded")}
                    icon={Banknote}
                    tone="approve"
                    disabled={busy}
                    onClick={() => setRefundOpen(true)}
                  />
                </AdminActions>
              ) : null}
            </div>

            {canMarkRefunded ? (
              <div className="rounded-[var(--mq-radius-sm)] border border-mq-border bg-mq-surface-subtle p-3 text-sm text-mq-text-secondary">
                {t("admin.rmaPage.refundReadyHint")}
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
                  <dd>{rma.buyerName ?? <span className="font-mono text-xs">{rma.buyerId.slice(0, 8)}…</span>}</dd>
                </div>
              ) : null}
              {rma.shopId ? (
                <div>
                  <dt className="text-xs text-mq-text-muted">{t("admin.rmaPage.shop")}</dt>
                  <dd>{rma.shopName ?? <span className="font-mono text-xs">{rma.shopId.slice(0, 8)}…</span>}</dd>
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
                {t("admin.rmaPage.evidenceTitle", { count: String(rma.evidenceUrls?.length ?? 0) })}
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
          await rmaDecision.mutateAsync({
            id,
            decision: "REJECTED",
            note,
          });
          setRejectOpen(false);
        }}
      />

      <AdminReasonModal
        open={refundOpen}
        title={t("admin.rmaPage.markRefundedTitle")}
        description={t("admin.rmaPage.markRefundedDesc")}
        confirmLabel={t("admin.common.markRefunded")}
        required={false}
        maxLength={500}
        busy={busy}
        onClose={() => setRefundOpen(false)}
        onConfirm={async (note) => {
          await markRefunded.mutateAsync({
            id,
            note: note.trim() || undefined,
          });
          setRefundOpen(false);
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
      // Must match the /admin/rma list, which links here — otherwise CS and
      // WAREHOUSE staff get bounced to "/" when opening a row.
      roles={["ADMIN", "SUPER_ADMIN", "ACCOUNTANT", "CS", "WAREHOUSE"]}
      permissions={["PROCESS_RMA", "MANAGE_RMA"]}
    >
      <RmaDetailInner id={id} />
    </AuthGuard>
  );
}
