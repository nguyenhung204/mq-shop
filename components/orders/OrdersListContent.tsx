"use client";

import Link from "next/link";
import { useState } from "react";
import type { OrderStatus } from "@/lib/api/orders";
import { useMyOrders } from "@/lib/queries/orders";
import { formatMoney } from "@/lib/api/utils";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { Container, PageHero } from "@/components/ui/shared";
import { OrderListSkeleton } from "@/components/ui/Skeleton";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { translateStatus } from "@/lib/i18n/status";
import { getErrorMessage } from "@/lib/queries/utils";

function OrdersInner() {
  const { t } = useLanguage();
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
      <PageHero title="My orders" breadcrumb={[{ label: "Orders" }]} />
      <Container className="py-10 md:py-14 space-y-4">
        <select
          className="mq-input max-w-[14rem]"
          value={status}
          aria-label="Filter by status"
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
            <p className="text-mq-text-secondary mb-4">No orders yet.</p>
            <Link href="/shop" className="mq-btn mq-btn-primary">
              Shop now
            </Link>
          </div>
        )}
        <div className="space-y-4">
          {orders.map((o) => (
            <Link
              key={o.id}
              href={`/orders/${o.id}`}
              className="mq-card p-5 block hover:shadow-[var(--mq-shadow)] transition-shadow"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{o.displayName}</p>
                  <p className="text-xs text-mq-text-muted mt-1">
                    {new Date(o.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="mq-badge mq-badge-cyan">{translateStatus(t, "order", o.status)}</span>
                  <span className="text-sm font-medium">
                    {formatMoney(o.total)} {o.currency}
                  </span>
                </div>
              </div>
            </Link>
          ))}
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
