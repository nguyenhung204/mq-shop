"use client";

import { useState } from "react";
import { useAdminOrderAction } from "@/lib/queries/admin";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminNav } from "@/components/admin/AdminNav";
import { Container, PageHero } from "@/components/ui/shared";

function OrdersInner() {
  const [orderId, setOrderId] = useState("");
  const orderAction = useAdminOrderAction();

  return (
    <>
      <PageHero title="Admin orders" breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Orders" }]} />
      <Container className="py-10 max-w-lg space-y-4">
        <AdminNav />
        <input className="mq-input" placeholder="Order ID" value={orderId} onChange={(e) => setOrderId(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="mq-btn mq-btn-primary"
            disabled={orderAction.isPending}
            onClick={() => void orderAction.mutateAsync({ action: "confirmCod", orderId })}
          >
            Confirm COD
          </button>
          <button
            type="button"
            className="mq-btn mq-btn-outline"
            disabled={orderAction.isPending}
            onClick={() => void orderAction.mutateAsync({ action: "forceCancel", orderId })}
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
