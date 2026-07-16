"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { orderApi } from "@/lib/api";
import type { ApiOrder } from "@/lib/api/types";
import { asArray, formatMoney } from "@/lib/api/utils";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { Container, PageHero } from "@/components/ui/shared";

function OrdersInner() {
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const data = await orderApi.myOrders();
        setOrders(asArray(data));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load orders");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <>
      <PageHero title="My orders" breadcrumb={[{ label: "Orders" }]} />
      <Container className="py-10 md:py-14">
        {loading && <p className="text-sm text-mq-text-muted">Loading…</p>}
        {error && <div className="mq-alert mq-alert-error">{error}</div>}
        {!loading && orders.length === 0 && !error && (
          <div className="text-center py-12">
            <p className="text-mq-text-secondary mb-4">No orders yet.</p>
            <Link href="/shop" className="mq-btn mq-btn-primary">Shop now</Link>
          </div>
        )}
        <div className="space-y-4">
          {orders.map((o) => (
            <Link key={o.id} href={`/orders/${o.id}`} className="mq-card p-5 block hover:shadow-[var(--mq-shadow)] transition-shadow">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">#{o.id.slice(0, 8)}</p>
                  <p className="text-xs text-mq-text-muted mt-1">{new Date(o.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="mq-badge mq-badge-cyan">{o.status}</span>
                  <span className="mq-badge mq-badge-orange">{o.paymentStatus}</span>
                  <span className="text-sm font-medium">{formatMoney(o.totalAmountUsd)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
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
