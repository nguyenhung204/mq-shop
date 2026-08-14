export type DisplayCurrency = "TWD" | "MYR" | "VND" | "SGD" | "USD";

export const DISPLAY_CURRENCIES: DisplayCurrency[] = [
  "TWD",
  "MYR",
  "VND",
  "SGD",
  "USD",
];

export function convertFromTwd(
  amountTwd: number,
  currency: string,
  rates: Record<string, number>,
): number {
  if (!Number.isFinite(amountTwd)) return 0;
  if (currency === "TWD") return amountTwd;
  const rate = rates[currency];
  if (rate == null || !Number.isFinite(rate)) return amountTwd;
  return amountTwd * rate;
}

export function getFxDecimals(currency: string): number {
  if (currency === "VND") return 0;
  return 2;
}

export function formatMoneyForCurrency(
  amount: number,
  currency: string,
  locale = "en-US",
): string {
  const n = Number.isFinite(amount) ? amount : 0;
  const decimals = getFxDecimals(currency);
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(decimals)}`;
  }
}

export function formatMoneyDisplay(
  amountTwd: number,
  currency: string,
  rates: Record<string, number>,
  locale = "en-US",
): string {
  const converted = convertFromTwd(amountTwd, currency, rates);
  return formatMoneyForCurrency(converted, currency, locale);
}
