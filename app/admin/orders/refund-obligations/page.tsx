"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { formatMoneyForCurrency } from "@/lib/fx/convert";
import { useAdminRefundObligations } from "@/lib/queries/orders";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { AdminCardListSkeleton } from "@/components/ui/Skeleton";
import { getErrorMessage } from "@/lib/queries/utils";

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function RefundObligationsInner() {
  const { t } = useLanguage();
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error } = useAdminRefundObligations({
    status: "OPEN",
    page,
    pageSize: 20,
  });
  const items = data?.items ?? [];
  const meta = data?.meta;

  return (
    <>
      <AdminPageHeader
        title={t("admin.refundObligations.title")}
        description={t("admin.refundObligations.description")}
        actions={
          <Link href="/admin/orders" className="mq-admin-btn mq-admin-btn-secondary">
            <ArrowLeft size={16} aria-hidden />
            {t("admin.refundObligations.backToOrders")}
          </Link>
        }
      />

      <div className="space-y-4">
        <p className="text-sm text-mq-text-muted">{t("admin.refundObligations.hint")}</p>

        {isError ? (
          <div className="mq-alert mq-alert-error">
            {getErrorMessage(error, t("admin.common.failed"))}
          </div>
        ) : null}

        {isLoading && items.length === 0 ? <AdminCardListSkeleton count={4} /> : null}

        {!isLoading && items.length === 0 && !isError ? (
          <p className="text-sm text-mq-text-muted py-6 text-center">
            {t("admin.refundObligations.empty")}
          </p>
        ) : null}

        {items.map((row) => (
          <div
            key={row.id}
            className="mq-card p-4 flex flex-wrap justify-between gap-3 text-sm"
          >
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/orders/${row.orderId}`}
                  className="font-medium text-mq-accent hover:underline"
                >
                  {row.orderCode}
                </Link>
                <span className="mq-badge mq-badge-pink">
                  {row.status === "OPEN" ? t("admin.refundObligations.status.OPEN") : row.status}
                </span>
              </div>
              <p className="text-xs text-mq-text-muted">
                {t("admin.refundObligations.buyer")}: {row.buyerName || row.buyerId}
              </p>
              <p className="text-xs text-mq-text-muted">
                {t("admin.refundObligations.reason")}: {row.reason}
              </p>
              <p className="text-xs text-mq-text-muted">{formatWhen(row.createdAt)}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[11px] uppercase tracking-wide text-mq-text-muted">
                {t("admin.refundObligations.amount")}
              </p>
              <p className="tabular-nums font-medium">
                {formatMoneyForCurrency(Number(row.amount), row.currency)}
              </p>
            </div>
          </div>
        ))}

        {meta ? <PaginationBar page={page} meta={meta} onPageChange={setPage} /> : null}
      </div>
    </>
  );
}

export default function AdminRefundObligationsPage() {
  return (
    <AuthGuard roles={["ACCOUNTANT", "ADMIN", "SUPER_ADMIN"]} permissions={["APPROVE_PAYOUT"]}>
      <RefundObligationsInner />
    </AuthGuard>
  );
}
