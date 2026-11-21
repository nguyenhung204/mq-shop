"use client";

import { PaidAtPanelView } from "@/components/orders/PaidAtPanelView";
import { useAuth } from "@/components/providers/AuthProvider";
import type { OrderView } from "@/lib/api/orders";
import { canEditPaidAt, canReadPaidAtHistory } from "@/lib/auth/admin-write";
import { useEditPaidAt, usePaidAtHistory } from "@/lib/queries/orders";

/** Order detail: SUPER_ADMIN may correct the payment date; ADMIN and SUPER_ADMIN read the edit history. */
export function PaidAtPanel({ order }: { order: Pick<OrderView, "id" | "paidAt" | "createdAt"> }) {
  const { user } = useAuth();
  const canEdit = canEditPaidAt(user);
  const canRead = canReadPaidAtHistory(user);
  const history = usePaidAtHistory(order.id, canRead && Boolean(order.paidAt));
  const edit = useEditPaidAt(order.id);
  if (!order.paidAt || !canRead) return null;
  return (
    <PaidAtPanelView
      key={order.paidAt}
      paidAt={order.paidAt}
      createdAt={order.createdAt}
      canEdit={canEdit}
      history={history.data ?? []}
      historyState={history.isLoading ? "loading" : history.isError ? "error" : "ready"}
      busy={edit.isPending}
      onSubmit={async (body) => {
        try {
          await edit.mutateAsync(body);
          return true;
        } catch {
          return false;
        }
      }}
    />
  );
}
