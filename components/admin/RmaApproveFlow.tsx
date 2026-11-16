"use client";

import { useState } from "react";
import { RmaApproveModal } from "@/components/admin/RmaApproveModal";
import { useAuth } from "@/components/providers/AuthProvider";
import { canSetPartialRefund } from "@/lib/auth/admin-write";
import { toCents } from "@/lib/money";
import { approveVars } from "@/lib/rma/approve-flow";
import { remainingFromError } from "@/lib/rma/refund-amount";
import { useAdminRmaDecision, useOrder } from "@/lib/queries/orders";

/** Approve dialog for ADMIN / SUPER_ADMIN: optional partial refund amount. Mounted only when `target` is set. */
export function RmaApproveFlow({
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
  const canPartial = canSetPartialRefund(user);
  const { data: order } = useOrder(canPartial ? target.orderId : "");
  const decision = useAdminRmaDecision();
  const [remaining, setRemaining] = useState<number | null>(null);

  return (
    <RmaApproveModal
      open
      canPartial={canPartial}
      orderTotalCents={order ? toCents(order.total) : null}
      remainingCents={remaining}
      busy={decision.isPending}
      onClose={onClose}
      onConfirm={async (refundAmount) => {
        try {
          await decision.mutateAsync(approveVars(target.rmaId, refundAmount));
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
