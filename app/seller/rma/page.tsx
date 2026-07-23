"use client";

import Link from "next/link";
import { useSellerOrders } from "@/lib/queries/seller";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { OrderListSkeleton } from "@/components/ui/Skeleton";

function SellerRmaInner() {
  const { data, isLoading, isError, error } = useSellerOrders({
    status: "REFUND_APPROVED",
    page: 1,
    pageSize: 50,
  });
  const refunded = data?.items ?? [];

  return (
    <div className="space-y-4">
      <p className="text-sm text-mq-text-muted">
        After admin approves an RMA, restock manually with an inventory slip (
        <code>IN</code> / <code>ADJUST_IN</code>). BE does not auto-restock.
      </p>
      {isLoading && <OrderListSkeleton />}
      {isError && (
        <div className="mq-alert mq-alert-error">
          {error instanceof Error ? error.message : "Failed"}
        </div>
      )}
      {refunded.length === 0 && !isLoading ? (
        <p className="text-sm text-mq-text-muted">No REFUND_APPROVED orders right now.</p>
      ) : null}
      {refunded.map((o) => (
        <div key={o.id} className="mq-card p-4 flex flex-wrap justify-between gap-3 text-sm">
          <div>
            <Link href={`/orders/${o.id}`} className="font-mono font-medium hover:underline">
              {o.code}
            </Link>
            <span className="mq-badge mq-badge-pink ml-2">{o.status}</span>
            <p className="text-xs text-mq-text-muted mt-1">
              Restock SKUs from this order via inventory.
            </p>
          </div>
          <Link href="/seller/inventory" className="mq-btn mq-btn-outline text-xs">
            Open inventory
          </Link>
        </div>
      ))}
    </div>
  );
}

export default function SellerRmaPage() {
  return (
    <AuthGuard roles={["SELLER", "WAREHOUSE"]}>
      <SellerRmaInner />
    </AuthGuard>
  );
}
