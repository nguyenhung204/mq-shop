"use client";

import { useState } from "react";
import { adminApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminNav } from "@/components/admin/AdminNav";
import { Container, PageHero } from "@/components/ui/shared";

function OrdersInner() {
  const [orderId, setOrderId] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  return (
    <>
      <PageHero title="Admin orders" breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Orders" }]} />
      <Container className="py-10 max-w-lg space-y-4">
        <AdminNav />
        {error && <div className="mq-alert mq-alert-error">{error}</div>}
        {msg && <div className="mq-alert mq-alert-success">{msg}</div>}
        <input className="mq-input" placeholder="Order ID" value={orderId} onChange={(e) => setOrderId(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="mq-btn mq-btn-primary"
            onClick={() =>
              void adminApi
                .confirmCod(orderId)
                .then(() => setMsg("COD confirmed"))
                .catch((e) => setError(e instanceof ApiError ? e.message : "Error"))
            }
          >
            Confirm COD
          </button>
          <button
            type="button"
            className="mq-btn mq-btn-outline"
            onClick={() =>
              void adminApi
                .forceCancelOrder(orderId, { reason: "Admin force cancel" })
                .then(() => setMsg("Force cancelled (audit logged on BE)"))
                .catch((e) => setError(e instanceof ApiError ? e.message : "Error"))
            }
          >
            Force cancel
          </button>
        </div>
        <p className="text-xs text-mq-text-muted">Refunds are recorded for finance — not auto-paid to the customer.</p>
      </Container>
    </>
  );
}

export default function AdminOrdersPage() {
  return (
    <AuthGuard roles={["ADMIN", "SUPER_ADMIN"]} permissions={["FORCE_CANCEL_ORDER", "CONFIRM_ORDER"]}>
      <OrdersInner />
    </AuthGuard>
  );
}
