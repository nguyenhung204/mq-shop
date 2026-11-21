"use client";

import { useState } from "react";
import { RmaApproveModal } from "@/components/admin/RmaApproveModal";
import { useAuth } from "@/components/providers/AuthProvider";
import { canSetSellerPartialRefund } from "@/lib/auth/admin-write";
import { toCents } from "@/lib/money";
import { refundDisplayEquivalent } from "@/lib/rma/display-equivalent";
import { remainingFromError } from "@/lib/rma/refund-amount";
import { useOrder, useShopRmaAction } from "@/lib/queries/orders";

/**
 * Seller approve dialog: a seller of the shop may choose a partial refund amount (same rules as the
 * admin dialog). CS / WAREHOUSE / ACCOUNTANT get no field and approve the full remaining amount.
 * Mounted only while `target` is set.
 */
export function SellerRmaApproveFlow({
  target,
  onClose,
}: {
  target: { rmaId: string; orderId: string } | null;
  onClose: () => void;
}) {
  if (!target) return null;
  return <Flow key={target.rmaId} target={target} onClose={onClose} />;
}

function Flow({ target, onClose }: { target: { rmaId: string; orderId: string }; onClose: () => void }) {
  const { user } = useAuth();
  const canPartial = canSetSellerPartialRefund(user);
  const { data: order } = useOrder(canPartial ? target.orderId : "");
  const action = useShopRmaAction();
  const [remaining, setRemaining] = useState<number | null>(null);

  return (
    <RmaApproveModal
      open
      canPartial={canPartial}
      orderTotalCents={order ? toCents(order.total) : null}
      remainingCents={remaining}
      busy={action.isPending}
      displayHint={order ? (cents) => refundDisplayEquivalent(order, cents) : undefined}
      onClose={onClose}
      onConfirm={async (refundAmount) => {
        try {
          await action.mutateAsync({ id: target.rmaId, action: "approve", orderId: target.orderId, refundAmount });
          onClose();
        } catch (e) {
          // RMA_REFUND_AMOUNT_INVALID carries what is really left: use it as the cap from now on.
          const left = remainingFromError(e);
          if (left) setRemaining(left.remainingCents);
        }
      }}
    />
  );
}
