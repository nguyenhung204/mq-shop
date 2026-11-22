import { centsToDecimalString, toCents } from "@/lib/money";

type OrderFx = {
  total: number | string;
  payableAmount?: number | null;
  payableCurrency?: string | null;
  fxRateLocked?: number | null;
};

const DEC_RE = /^\d+(?:\.\d+)?$/;

/** Plain decimal text of a rate (shortest round-trip text; exponent forms are expanded). Null when unusable. */
function rateText(rate: number): string | null {
  if (!Number.isFinite(rate) || rate <= 0) return null;
  let text = String(rate);
  if (/e/i.test(text)) text = rate.toFixed(15).replace(/0+$/, "").replace(/\.$/, "");
  return DEC_RE.test(text) ? text : null;
}

/**
 * Display-only text for a partial refund in the currency the buyer pays in ("7.75 SGD").
 * Same rule as the server (`displayCentsFor`): the full order total is the stored payable amount; any
 * other amount is `refundCents x rate` on integers, rounded half up to the cent. No floating point
 * multiplication. Null when the order has no display snapshot (TWD order or an older API).
 */
export function refundDisplayEquivalent(order: OrderFx, refundCents: number): string | null {
  const currency = order.payableCurrency;
  if (!currency || currency === "TWD" || !Number.isSafeInteger(refundCents) || refundCents <= 0) return null;
  const totalCents = toCents(order.total);
  if (totalCents !== null && refundCents === totalCents && order.payableAmount != null) {
    const exact = toCents(order.payableAmount);
    if (exact !== null) return `${centsToDecimalString(exact)} ${currency}`;
  }
  const text = order.fxRateLocked == null ? null : rateText(order.fxRateLocked);
  if (text === null) return null;
  const [w, f = ""] = text.split(".");
  const scale = BigInt("1" + "0".repeat(f.length));
  const fx = BigInt(w!) * scale + BigInt(f || "0");
  if (fx <= BigInt(0)) return null;
  const converted = (BigInt(refundCents) * fx + scale / BigInt(2)) / scale;
  if (converted > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return `${centsToDecimalString(Number(converted))} ${currency}`;
}
