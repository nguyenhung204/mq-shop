"use client";

import Link from "next/link";
import { useState } from "react";
import type { OrderStatus } from "@/lib/api/orders";
import { isPaymentProofRejected } from "@/lib/api/orders";
import { useMyOrders } from "@/lib/queries/orders";
import { formatOrderMoney } from "@/lib/fx/formatOrderMoney";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { Container, PageHero } from "@/components/ui/shared";
import { OrderListSkeleton } from "@/components/ui/Skeleton";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { translateStatus } from "@/lib/i18n/status";
import { getErrorMessage } from "@/lib/queries/utils";

function OrdersInner() {
  const { t, locale } = useLanguage();
  const intlLocale =
    locale === "zh-TW" ? "zh-TW" : locale === "vi" ? "vi-VN" : "en-US";
  const [status, setStatus] = useState<OrderStatus | "">("");
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error } = useMyOrders({
    status: status || undefined,
    page,
    pageSize: 20,
  });
  const orders = data?.items ?? [];
  const meta = data?.meta;

  return (
    <>
      <PageHero title={t("orders.title")} breadcrumb={[{ label: t("orders.breadcrumb") }]} />
      <Container className="py-10 md:py-14 space-y-4">
        <select
          className="mq-input max-w-[14rem]"
          value={status}
          aria-label={t("orders.filterStatus")}
          onChange={(e) => {
            setStatus(e.target.value as OrderStatus | "");
            setPage(1);
          }}
        >
          <option value="">{t("admin.common.allStatuses")}</option>
          {(
            [
              "PENDING",
              "PAID",
              "CONFIRMED",
              "PACKED",
              "SHIPPED",
              "DELIVERED",
              "CANCELLED",
              "REFUND_APPROVED",
            ] as OrderStatus[]
          ).map((s) => (
            <option key={s} value={s}>
              {translateStatus(t, "order", s)}
            </option>
          ))}
        </select>

        {isLoading && <OrderListSkeleton />}
        {isError && (
          <div className="mq-alert mq-alert-error">
            {getErrorMessage(error, t("orders.loadFailed"))}
          </div>
        )}
        {!isLoading && orders.length === 0 && !isError && (
          <div className="text-center py-12">
            <p className="text-mq-text-secondary mb-4">{t("orders.empty")}</p>
            <Link href="/shop" className="mq-btn mq-btn-primary">
              {t("orders.shopNow")}
            </Link>
          </div>
        )}
        <div className="space-y-4">
          {orders.map((o) => {
            const money = formatOrderMoney(o, "total", intlLocale);
            return (
              <Link
                key={o.id}
                href={`/orders/${o.id}`}
                className="mq-card p-5 block hover:shadow-[var(--mq-shadow)] transition-shadow"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{o.displayName}</p>
                    <p className="text-xs text-mq-text-muted mt-1">
                      {new Date(o.createdAt).toLocaleString(intlLocale)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="mq-badge mq-badge-cyan">
                      {translateStatus(t, "order", o.status)}
                    </span>
                    {isPaymentProofRejected(o) ? (
                      <span className="mq-badge mq-badge-orange">
                        {t("orders.payment.rejectedBadge")}
                      </span>
                    ) : null}
                    <span className="text-sm font-medium">
                      {money.primary}
                      {money.ledgerHint ? (
                        <span className="text-mq-text-muted text-xs ml-1">
                          ({money.ledgerHint})
                        </span>
                      ) : money.showCurrencySuffix ? (
                        <span> {o.currency}</span>
                      ) : null}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
        <PaginationBar page={page} meta={meta} onPageChange={setPage} />
      </Container>
    </>
  );
}

export function OrdersListContent() {
  return (
    <AuthGuard>
      <OrdersInner />
    </AuthGuard>
  );
}
