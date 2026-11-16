import type { OrderView } from "@/lib/api/orders";

/**
 * R5: a bill nobody handled for 48 h is escalated (`paymentEscalatedAt`). While the order is still
 * PENDING (not confirmed, not cancelled) it is shown as "needs handling" to the seller and staff.
 */
export function needsHandling(order: Pick<OrderView, "status" | "paymentEscalatedAt">): boolean {
  return Boolean(order.paymentEscalatedAt) && order.status === "PENDING";
}
