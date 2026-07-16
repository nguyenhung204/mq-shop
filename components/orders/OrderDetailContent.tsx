"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { orderApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import type { ApiOrder } from "@/lib/api/types";
import { formatMoney } from "@/lib/api/utils";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { Container, PageHero } from "@/components/ui/shared";

function OrderDetailInner() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<ApiOrder | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setOrder(await orderApi.get(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const canCancel = order && ["PENDING", "CONFIRMED", "PROCESSING"].includes(order.status);
  const canRma = order?.status === "DELIVERED";

  const onCancel = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await orderApi.cancel(id, { reason });
      setMsg("Order cancelled. Refunds (if any) are recorded for finance — not auto-paid.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Cancel failed");
    }
  };

  return (
    <>
      <PageHero
        title="Order detail"
        breadcrumb={[{ label: "Orders", href: "/orders" }, { label: id.slice(0, 8) }]}
      />
      <Container className="py-10 md:py-14 max-w-3xl mx-auto space-y-6">
        {loading && <p className="text-sm text-mq-text-muted">Loading…</p>}
        {error && <div className="mq-alert mq-alert-error">{error}</div>}
        {msg && <div className="mq-alert mq-alert-success">{msg}</div>}
        {order && (
          <div className="mq-card p-6 space-y-4">
            <div className="flex flex-wrap gap-2">
              <span className="mq-badge mq-badge-cyan">{order.status}</span>
              <span className="mq-badge mq-badge-orange">{order.paymentStatus}</span>
              <span className="mq-badge mq-badge-teal">{order.paymentMethod}</span>
            </div>
            <p className="text-sm">Total: <strong>{formatMoney(order.totalAmountUsd)}</strong></p>
            <p className="text-sm text-mq-text-secondary">Ship to: {order.shippingAddress}</p>
            <ul className="divide-y divide-mq-border">
              {(order.items || []).map((item, i) => (
                <li key={i} className="py-3 flex justify-between text-sm">
                  <span>{item.name || item.sku} × {item.quantity}</span>
                  <span>{formatMoney(Number(item.unitPriceUsd) * item.quantity)}</span>
                </li>
              ))}
            </ul>
            {canCancel && (
              <form onSubmit={onCancel} className="space-y-3 pt-4 border-t border-mq-border">
                <h3 className="text-sm font-medium">Cancel order</h3>
                <input className="mq-input" placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} required />
                <button className="mq-btn mq-btn-outline">Cancel order</button>
              </form>
            )}
            {canRma && (
              <Link href={`/orders/${id}/rma`} className="mq-btn mq-btn-primary inline-flex">
                Request return (RMA)
              </Link>
            )}
          </div>
        )}
      </Container>
    </>
  );
}

export function OrderDetailContent() {
  return (
    <AuthGuard>
      <OrderDetailInner />
    </AuthGuard>
  );
}
