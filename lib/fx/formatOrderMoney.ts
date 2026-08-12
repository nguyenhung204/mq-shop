import { formatMoney } from "@/lib/api/utils";
import { formatMoneyForCurrency } from "@/lib/fx/convert";

export type OrderMoneyFields = {
  total: number;
  subtotal?: number;
  shippingFee?: number;
  currency?: string;
  displayCurrency?: string | null;
  fxRate?: number | null;
  displayTotal?: number | null;
};

export type OrderMoneyField = "total" | "subtotal" | "shippingFee";

export type FormattedOrderMoney = {
  primary: string;
  /** TWD ledger hint for parentheses, e.g. NT$100 */
  ledgerHint: string | null;
  /** Show legacy `currency` suffix after primary (TWD-only legacy orders) */
  showCurrencySuffix: boolean;
};

function hasFxSnapshot(order: OrderMoneyFields): boolean {
  return Boolean(
    order.displayCurrency &&
      order.displayCurrency !== "TWD" &&
      order.fxRate != null &&
      Number.isFinite(order.fxRate),
  );
}

function twdForField(order: OrderMoneyFields, field: OrderMoneyField): number {
  if (field === "total") return order.total;
  if (field === "subtotal") return order.subtotal ?? 0;
  return order.shippingFee ?? 0;
}

/**
 * Format buyer order amounts: snapshot currency when present, otherwise TWD ledger only.
 */
export function formatOrderMoney(
  order: OrderMoneyFields,
  field: OrderMoneyField = "total",
  locale = "en-US",
): FormattedOrderMoney {
  const twd = twdForField(order, field);

  if (hasFxSnapshot(order)) {
    const displayCurrency = order.displayCurrency!;
    const fxRate = order.fxRate!;
    let displayAmount: number;
    if (field === "total" && order.displayTotal != null) {
      displayAmount = order.displayTotal;
    } else {
      displayAmount = twd * fxRate;
    }
    return {
      primary: formatMoneyForCurrency(displayAmount, displayCurrency, locale),
      ledgerHint: formatMoney(twd),
      showCurrencySuffix: false,
    };
  }

  return {
    primary: formatMoney(twd),
    ledgerHint: null,
    showCurrencySuffix: true,
  };
}
