"use client";

import Link from "next/link";
import { formatMoney } from "@/lib/api/utils";
import { useSellerOrders } from "@/lib/queries/seller";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { OrderListSkeleton } from "@/components/ui/Skeleton";

function SellerOrdersInner() {
  const { data: orders = [], isLoading, isError, error } = useSellerOrders();

  return (
    <div className="space-y-4">
      {isLoading && <OrderListSkeleton />}
      {isError && (
        <div className="mq-alert mq-alert-error">
          {error instanceof Error ? error.message : "Failed"}
        </div>
      )}
      {orders.map((o) => (
        <Link
          key={o.id}
          href={`/orders/${o.id}`}
          className="mq-card p-4 flex justify-between text-sm hover:shadow-[var(--mq-shadow)] transition-shadow"
        >
          <span>
            #{o.id.slice(0, 8)} · {o.status}
          </span>
          <span>{formatMoney(o.totalAmountUsd)}</span>
        </Link>
      ))}
    </div>
  );
}

export default function SellerOrdersPage() {
  return (
    <AuthGuard roles={["SELLER"]}>
      <SellerOrdersInner />
    </AuthGuard>
  );
}
