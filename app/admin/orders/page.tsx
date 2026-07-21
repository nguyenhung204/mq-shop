"use client";

import { useState } from "react";
import { Ban, CheckCircle2 } from "lucide-react";
import { useAdminOrderAction } from "@/lib/queries/admin";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { AdminActions, AdminIconButton } from "@/components/admin/AdminIconButton";

function OrdersInner() {
  const [orderId, setOrderId] = useState("");
  const orderAction = useAdminOrderAction();

  return (
    <>
      <AdminPageHeader
        title="Orders"
        description="Confirm COD or force-cancel by order ID."
      />
      <div className="mq-admin-panel p-5 max-w-lg space-y-4">
        <input
          className="mq-input"
          placeholder="Order ID"
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
        />
        <AdminActions>
          <AdminIconButton
            label="Confirm COD"
            icon={CheckCircle2}
            tone="approve"
            disabled={orderAction.isPending}
            onClick={() => void orderAction.mutateAsync({ action: "confirmCod", orderId })}
          />
          <AdminIconButton
            label="Force cancel"
            icon={Ban}
            tone="danger"
            disabled={orderAction.isPending}
            onClick={() => void orderAction.mutateAsync({ action: "forceCancel", orderId })}
          />
        </AdminActions>
        <p className="text-xs text-mq-text-muted">
          Refunds are recorded for finance — not auto-paid to the customer.
        </p>
      </div>
    </>
  );
}

export default function AdminOrdersPage() {
  return (
    <AuthGuard
      roles={["ADMIN", "SUPER_ADMIN"]}
      permissions={["FORCE_CANCEL_ORDER", "CONFIRM_ORDER"]}
    >
      <OrdersInner />
    </AuthGuard>
  );
}
