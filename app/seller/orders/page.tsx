"use client";

import Link from "next/link";
import { useState } from "react";
import type { OrderStatus } from "@/lib/api/orders";
import { nextFulfillmentStatus } from "@/lib/api/orders";
import { formatMoney } from "@/lib/api/utils";
import { useSellerOrders } from "@/lib/queries/seller";
import { useUpdateOrderStatus } from "@/lib/queries/orders";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { OrderListSkeleton } from "@/components/ui/Skeleton";
import { PaginationBar } from "@/components/ui/PaginationBar";

function SellerOrdersInner() {
  const [status, setStatus] = useState<OrderStatus | "">("");
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error } = useSellerOrders({
    status: status || undefined,
    page,
    pageSize: 20,
  });
  const updateStatus = useUpdateOrderStatus();
  const orders = data?.items ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-4">
      <p className="text-sm text-mq-text-muted">
        Fulfillment pipeline: PAID → CONFIRMED → PACKED → SHIPPED → DELIVERED. After RMA approve,
        restock via{" "}
        <Link href="/seller/inventory" className="underline">
          Inventory slips
        </Link>
        .
      </p>
      <select
        className="mq-input max-w-[14rem]"
        value={status}
        aria-label="Filter status"
        onChange={(e) => {
          setStatus(e.target.value as OrderStatus | "");
          setPage(1);
        }}
      >
        <option value="">All</option>
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
            {s}
          </option>
        ))}
      </select>

      {isLoading && <OrderListSkeleton />}
      {isError && (
        <div className="mq-alert mq-alert-error">
          {error instanceof Error ? error.message : "Failed"}
        </div>
      )}
      {orders.map((o) => {
        const next = nextFulfillmentStatus(o.status);
        return (
          <div
            key={o.id}
            className="mq-card p-4 flex flex-wrap items-center justify-between gap-3 text-sm"
          >
            <Link href={`/orders/${o.id}`} className="hover:underline min-w-0">
              <span className="font-mono font-medium">{o.code}</span>
              <span className="mq-badge mq-badge-cyan ml-2">{o.status}</span>
              <span className="block text-xs text-mq-text-muted mt-1">
                {new Date(o.createdAt).toLocaleString()}
              </span>
            </Link>
            <div className="flex items-center gap-3">
              <span>{formatMoney(o.total)}</span>
              {next ? (
                <button
                  type="button"
                  className="mq-btn mq-btn-outline text-xs"
                  disabled={updateStatus.isPending}
                  onClick={() =>
                    void updateStatus.mutateAsync({
                      orderId: o.id,
                      body: { status: next },
                    })
                  }
                >
                  → {next}
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
      <PaginationBar page={page} meta={meta} onPageChange={setPage} />
    </div>
  );
}

export default function SellerOrdersPage() {
  return (
    <AuthGuard roles={["SELLER", "WAREHOUSE", "CS"]}>
      <SellerOrdersInner />
    </AuthGuard>
  );
}
