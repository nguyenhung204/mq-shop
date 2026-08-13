"use client";

import Link from "next/link";
import { useState } from "react";
import type { RmaStatus } from "@/lib/api/orders";
import { useMyRma } from "@/lib/queries/orders";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { Container, PageHero } from "@/components/ui/shared";
import { translateStatus } from "@/lib/i18n/status";
import { OrderListSkeleton } from "@/components/ui/Skeleton";
import { getErrorMessage } from "@/lib/queries/utils";

function RmaInner() {
  const { t } = useLanguage();
  const [status, setStatus] = useState<RmaStatus | "">("");
  const { data, isLoading, isError, error } = useMyRma(status || undefined);
  const items = data?.items ?? [];

  return (
    <>
      <PageHero
        title={t("orders.rma.listTitle")}
        breadcrumb={[{ label: t("orders.rma.breadcrumbRma") }]}
      />
      <Container className="py-10 md:py-14 space-y-4 max-w-2xl mx-auto">
        <p className="text-sm text-mq-text-secondary">{t("orders.rma.listIntro")}</p>
        <div className="flex flex-wrap gap-2 items-center">
          <select
            className="mq-input max-w-[14rem]"
            value={status}
            aria-label={t("admin.common.filterStatus")}
            onChange={(e) => setStatus(e.target.value as RmaStatus | "")}
          >
            <option value="">{t("admin.common.all")}</option>
            <option value="REQUESTED">{translateStatus(t, "rma", "REQUESTED")}</option>
            <option value="APPROVED">{translateStatus(t, "rma", "APPROVED")}</option>
            <option value="RETURN_SHIPPED">{translateStatus(t, "rma", "RETURN_SHIPPED")}</option>
            <option value="RETURN_RECEIVED">{translateStatus(t, "rma", "RETURN_RECEIVED")}</option>
            <option value="RETURN_REJECTED">{translateStatus(t, "rma", "RETURN_REJECTED")}</option>
            <option value="DISPUTED">{translateStatus(t, "rma", "DISPUTED")}</option>
            <option value="REFUND_PENDING">{translateStatus(t, "rma", "REFUND_PENDING")}</option>
            <option value="REFUND_SENT">{translateStatus(t, "rma", "REFUND_SENT")}</option>
            <option value="COMPLETED">{translateStatus(t, "rma", "COMPLETED")}</option>
            <option value="REJECTED">{translateStatus(t, "rma", "REJECTED")}</option>
            <option value="CLOSED">{translateStatus(t, "rma", "CLOSED")}</option>
          </select>
          <Link href="/orders?status=DELIVERED" className="mq-btn mq-btn-outline text-xs">
            {t("orders.rma.viewDelivered")}
          </Link>
        </div>

        {isLoading && <OrderListSkeleton />}
        {isError && (
          <div className="mq-alert mq-alert-error">
            {getErrorMessage(error, t("admin.common.failed"))}
          </div>
        )}
        {!isLoading && items.length === 0 ? (
          <p className="text-sm text-mq-text-muted">{t("orders.rma.listEmpty")}</p>
        ) : null}

        {items.map((r) => (
          <div
            key={r.id}
            className="mq-card p-4 flex flex-wrap justify-between gap-3 text-sm"
          >
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/orders/${r.orderId}`}
                  className="font-medium hover:underline"
                >
                  {r.orderName ?? r.orderId.slice(0, 8)}
                </Link>
                <span className="mq-badge mq-badge-pink">
                  {translateStatus(t, "rma", r.status)}
                </span>
                {r.escalatedAt ? (
                  <span className="mq-badge mq-badge-orange">
                    {t("orders.rma.escalatedBanner")}
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-mq-text-muted line-clamp-2">{r.reason}</p>
              {r.shopName ? (
                <p className="text-xs text-mq-text-muted">{r.shopName}</p>
              ) : null}
            </div>
            <Link href={`/orders/${r.orderId}`} className="mq-btn mq-btn-primary text-xs">
              {t("orders.rma.openOrder")}
            </Link>
          </div>
        ))}
      </Container>
    </>
  );
}

export function RmaListContent() {
  return (
    <AuthGuard>
      <RmaInner />
    </AuthGuard>
  );
}
