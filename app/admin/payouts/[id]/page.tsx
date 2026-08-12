"use client";

import Link from "next/link";
import { use, useState } from "react";
import { ArrowLeft, Check, X } from "lucide-react";
import type { SellerPayout } from "@/lib/api/finance";
import { formatMoney } from "@/lib/api/utils";
import {
  useAdminPayout,
  useApproveSellerPayout,
  useRejectSellerPayout,
} from "@/lib/queries/finance";
import { useAdminShops } from "@/lib/queries/admin";
import { LedgerTwdNote } from "@/components/finance/LedgerTwdNote";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { AdminActions, AdminIconButton } from "@/components/admin/AdminIconButton";
import { AdminReasonModal } from "@/components/admin/AdminReasonModal";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { AdminCardListSkeleton } from "@/components/ui/Skeleton";
import { getErrorMessage } from "@/lib/queries/utils";

function statusBadgeClass(status: SellerPayout["status"]): string {
  switch (status) {
    case "PENDING":
      return "mq-badge mq-badge-cyan";
    case "COMPLETED":
      return "mq-badge mq-badge-teal";
    case "REJECTED":
      return "mq-badge mq-badge-pink";
    default:
      return "mq-badge mq-badge-muted";
  }
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function PayoutDetailInner({ payoutId }: { payoutId: string }) {
  const { t } = useLanguage();
  const { data: payout, isLoading, isError, error } = useAdminPayout(payoutId);
  const { data: shopsPage } = useAdminShops("APPROVED", 1, 100);
  const shops = shopsPage?.items ?? [];
  const shopName =
    shops.find((s) => s.id === payout?.shopId)?.name ?? payout?.shopId.slice(0, 8);

  const approvePayout = useApproveSellerPayout();
  const rejectPayout = useRejectSellerPayout();
  const [rejectOpen, setRejectOpen] = useState(false);

  return (
    <>
      <AdminPageHeader
        title={t("admin.payouts.detailTitle")}
        description={t("admin.payouts.detailDescription")}
        actions={
          <Link href="/admin/payouts" className="mq-admin-btn mq-admin-btn-secondary">
            <ArrowLeft size={16} aria-hidden />
            {t("admin.payouts.backToList")}
          </Link>
        }
      />

      <LedgerTwdNote className="mb-4" />

      <div className="space-y-5">
        {isLoading && <AdminCardListSkeleton count={3} />}
        {isError && (
          <div className="mq-alert mq-alert-error">
            {getErrorMessage(error, t("admin.common.failed"))}
          </div>
        )}

        {payout && (
          <>
            <div className="mq-card p-5 space-y-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-medium">{payout.id}</span>
                  <span className={statusBadgeClass(payout.status)}>
                    {t(`admin.payouts.status.${payout.status}`)}
                  </span>
                </div>
                {payout.status === "PENDING" ? (
                  <AdminActions>
                    <AdminIconButton
                      label={t("admin.common.approve")}
                      icon={Check}
                      tone="approve"
                      disabled={approvePayout.isPending}
                      onClick={() => void approvePayout.mutateAsync(payout.id)}
                    />
                    <AdminIconButton
                      label={t("admin.common.reject")}
                      icon={X}
                      tone="reject"
                      disabled={rejectPayout.isPending}
                      onClick={() => setRejectOpen(true)}
                    />
                  </AdminActions>
                ) : null}
              </div>

              <p>
                {t("admin.common.shop")}: <strong>{shopName}</strong>
              </p>
              <p className="text-mq-text-muted">
                {formatWhen(payout.periodStart)} → {formatWhen(payout.periodEnd)}
              </p>

              <div className="grid sm:grid-cols-2 gap-2 pt-2 border-t border-mq-border/60">
                <p>
                  {t("admin.payouts.gross")}:{" "}
                  <strong className="tabular-nums">{formatMoney(payout.grossRevenue)}</strong>
                </p>
                <p>
                  {t("admin.payouts.fee")}:{" "}
                  <strong className="tabular-nums">{formatMoney(payout.platformFee)}</strong>
                </p>
                <p>
                  {t("admin.payouts.shipping")}:{" "}
                  <strong className="tabular-nums">{formatMoney(payout.shippingFee)}</strong>
                </p>
                <p>
                  {t("admin.payouts.net")}:{" "}
                  <strong className="tabular-nums">{formatMoney(payout.netAmount)}</strong>
                </p>
              </div>

              {payout.completedAt ? (
                <p className="text-xs text-mq-text-muted">
                  {t("admin.payouts.completedAt", {
                    when: formatWhen(payout.completedAt),
                  })}
                </p>
              ) : null}
              {payout.status === "REJECTED" && payout.rejectionReason ? (
                <p className="text-xs text-mq-text-muted">
                  {t("admin.payouts.rejectionReason", {
                    reason: payout.rejectionReason,
                  })}
                </p>
              ) : null}
            </div>

            <section className="space-y-3">
              <h3 className="font-semibold text-sm">
                {t("admin.payouts.itemsTitle", {
                  count: String(payout.items?.length ?? 0),
                })}
              </h3>
              {(payout.items?.length ?? 0) === 0 ? (
                <p className="text-sm text-mq-text-muted">{t("admin.payouts.itemsEmpty")}</p>
              ) : (
                payout.items.map((item) => (
                  <div
                    key={item.id}
                    className="mq-card p-4 flex flex-wrap justify-between gap-2 text-sm"
                  >
                    <div>
                      <Link
                        href={`/orders/${item.orderId}`}
                        className="font-mono hover:underline"
                      >
                        {item.orderCode || item.orderId.slice(0, 8) + "…"}
                      </Link>
                      <p className="text-xs text-mq-text-muted mt-1">
                        {t("admin.payouts.settlementId")}: {item.settlementId.slice(0, 8)}…
                      </p>
                    </div>
                    <span className="tabular-nums font-medium">
                      {formatMoney(item.amount)}
                    </span>
                  </div>
                ))
              )}
            </section>
          </>
        )}
      </div>

      <AdminReasonModal
        open={rejectOpen}
        title={t("admin.payouts.rejectTitle")}
        description={
          payout
            ? t("admin.payouts.rejectDesc", { net: formatMoney(payout.netAmount) })
            : undefined
        }
        confirmLabel={t("admin.payouts.rejectBtn")}
        maxLength={500}
        busy={rejectPayout.isPending}
        onClose={() => setRejectOpen(false)}
        onConfirm={async (reason) => {
          await rejectPayout.mutateAsync({ id: payoutId, reason });
          setRejectOpen(false);
        }}
      />
    </>
  );
}

export default function AdminPayoutDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <AuthGuard
      roles={["ADMIN", "SUPER_ADMIN", "ACCOUNTANT"]}
      permissions={["PAYOUT_SELLER"]}
    >
      <PayoutDetailInner payoutId={id} />
    </AuthGuard>
  );
}
