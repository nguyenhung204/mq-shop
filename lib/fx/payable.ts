import { formatMoney } from "@/lib/api/utils";
import { formatMoneyForCurrency } from "@/lib/fx/convert";
import { formatOrderMoney, type OrderMoneyFields } from "@/lib/fx/formatOrderMoney";

export type PayableView = {
  /** Amount the buyer must pay, in the currency of the order's locked FX snapshot. */
  amount: string;
  currency: string;
  /** "1 TWD = 0.031 USD" when a rate was locked at order time, else null. */
  lockedRate: string | null;
  /** Internal TWD ledger amount, only when the buyer pays in another currency. */
  ledgerTwd: string | null;
};

/**
 * R4: what the buyer is told to pay. Uses `payableAmount` / `payableCurrency` / `fxRateLocked`
 * from the order DTO and never converts the TWD total with today's rate. An older API without
 * those fields falls back to the order snapshot (displayTotal) or the TWD total.
 * Display only: no arithmetic on amounts.
 */
export function payableView(order: OrderMoneyFields, locale = "en-US"): PayableView {
  const hasPayable =
    order.payableAmount != null && Number.isFinite(order.payableAmount) && Boolean(order.payableCurrency);
  const currency = hasPayable ? order.payableCurrency! : (order.displayCurrency || order.currency || "TWD");
  const money = formatOrderMoney(order, "total", locale);
  const amount =
    hasPayable && currency === "TWD"
      ? formatMoneyForCurrency(order.payableAmount!, "TWD", locale)
      : money.primary;
  const rate = order.fxRateLocked;
  const lockedRate =
    currency !== "TWD" && rate != null && Number.isFinite(rate)
      ? `1 TWD = ${new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }).format(rate)} ${currency}`
      : null;
  return {
    amount,
    currency: money.showCurrencySuffix ? "TWD" : currency,
    lockedRate,
    ledgerTwd: currency !== "TWD" ? formatMoney(order.total) : null,
  };
}
