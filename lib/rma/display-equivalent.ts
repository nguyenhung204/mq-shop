import { centsToDecimalString, toCents } from "@/lib/money";

type OrderFx = {
  total: number | string;
  payableAmount?: number | null;
  payableCurrency?: string | null;
  fxRateLocked?: number | null;
};

/**
 * Display-only text for a partial refund in the currency the buyer pays in ("7.75 SGD").
 * The ledger refund stays in TWD. The full order total is the stored payable amount (exact);
 * anything else is the amount at the locked rate rounded to the cent. Null when the order has no
 * display snapshot (TWD order or an older API).
 */
export function refundDisplayEquivalent(order: OrderFx, refundCents: number): string | null {
  const currency = order.payableCurrency;
  if (!currency || currency === "TWD" || !Number.isSafeInteger(refundCents) || refundCents <= 0) return null;
  const totalCents = toCents(order.total);
  if (totalCents !== null && refundCents === totalCents && order.payableAmount != null) {
    const exact = toCents(order.payableAmount);
    if (exact !== null) return `${centsToDecimalString(exact)} ${currency}`;
  }
  const rate = order.fxRateLocked;
  if (rate == null || !Number.isFinite(rate) || rate <= 0) return null;
  const converted = Math.round(refundCents * rate);
  if (!Number.isSafeInteger(converted)) return null;
  return `${centsToDecimalString(converted)} ${currency}`;
}
