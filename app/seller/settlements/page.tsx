"use client";

import Link from "next/link";
import { useState } from "react";
import { formatMoney } from "@/lib/api/utils";
import { useSellerSettlements } from "@/lib/queries/settlements";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { OrderListSkeleton } from "@/components/ui/Skeleton";
import { PaginationBar } from "@/components/ui/PaginationBar";

function SellerSettlementsInner() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error } = useSellerSettlements({
    status: "PENDING_RECONCILE",
    page,
    pageSize: 20,
  });
  const items = data?.items ?? [];
  const meta = data?.meta;
  const pendingTotal = data?.summary.pendingTotal ?? 0;

  return (
    <div className="space-y-4">
      <p className="text-sm text-mq-text-muted">
        Revenue from delivered orders awaiting reconcile / payout. Read-only MVP — no mark-paid
        action yet.
      </p>

      <div className="mq-card p-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-mq-text-muted">
            Pending reconcile total
          </p>
          <p className="text-xl font-medium tabular-nums mt-1">
            {formatMoney(pendingTotal)}
          </p>
        </div>
        {typeof meta?.total === "number" ? (
          <p className="text-sm text-mq-text-muted">{meta.total} entries</p>
        ) : null}
      </div>

      {isLoading && <OrderListSkeleton />}
      {isError && (
        <div className="mq-alert mq-alert-error">
          {error instanceof Error ? error.message : "Failed"}
        </div>
      )}
      {!isLoading && items.length === 0 && !isError && (
        <p className="text-sm text-mq-text-muted py-6 text-center">
          No pending settlements.
        </p>
      )}
      {items.map((s) => (
        <div
          key={s.id}
          className="mq-card p-4 flex flex-wrap items-center justify-between gap-3 text-sm"
        >
          <div className="min-w-0">
            <Link href={`/orders/${s.orderId}`} className="hover:underline">
              <span className="font-mono font-medium">
                {s.orderCode ?? s.orderId.slice(0, 8)}
              </span>
            </Link>
            <span className="mq-badge mq-badge-cyan ml-2">{s.status}</span>
            <p className="text-xs text-mq-text-muted mt-1">
              {new Date(s.createdAt).toLocaleString()}
            </p>
          </div>
          <span className="tabular-nums font-medium">{formatMoney(s.amount)}</span>
        </div>
      ))}
      <PaginationBar page={page} meta={meta} onPageChange={setPage} />
    </div>
  );
}

export default function SellerSettlementsPage() {
  return (
    <AuthGuard roles={["SELLER"]} permissions={["VIEW_TRANSACT"]}>
      <SellerSettlementsInner />
    </AuthGuard>
  );
}
