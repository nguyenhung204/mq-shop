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

export function convertToTwd(
  amountInCurrency: number,
  currency: string,
  rates: Record<string, number>,
): number {
  if (!Number.isFinite(amountInCurrency)) return 0;
  if (currency === "TWD") return amountInCurrency;
  const rate = rates[currency];
  if (rate == null || !Number.isFinite(rate) || rate <= 0) return amountInCurrency;
  return amountInCurrency / rate;
}

export function getFxDecimals(currency: string): number {
  // TWD keeps its cents (a seller may price 2350.50 and the ledger stores it): displayed with 2 decimals only when
  // the amount has cents (see formatMoneyForCurrency), and the money inputs accept 2 decimals.
  if (currency === "VND" || currency === "JPY" || currency === "KRW") {
    return 0;
  }
  return 2;
}

/**
 * TWD ledger amounts are numeric(12,2): show cents when there are any, none when the amount is whole.
 * Rounds half-up (away from zero) to 2 places on the decimal text of the number, so x.005 / x.995 do
 * not depend on the binary double. Returns the rounded decimal text, or null when not representable.
 */
function roundToCentsText(n: number): string | null {
  let s = String(Math.abs(n));
  if (/e/i.test(s)) s = Math.abs(n).toFixed(20);
  if (!/^\d+(?:\.\d+)?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  const cents = BigInt(whole + frac.padEnd(2, "0").slice(0, 2)) + BigInt(frac.charCodeAt(2) >= 53 ? 1 : 0);
  const sign = n < 0 && cents !== BigInt(0) ? "-" : "";
  const digits = cents.toString().padStart(3, "0");
  return `${sign}${digits.slice(0, -2)}.${digits.slice(-2)}`;
}

export function formatMoneyForCurrency(
  amount: number,
  currency: string,
  locale = "en-US",
): string {
  let n = Number.isFinite(amount) ? amount : 0;
  let decimals = getFxDecimals(currency);
  let minDecimals = decimals;
  if (currency === "TWD") {
    const text = roundToCentsText(n);
    if (text != null) {
      n = Number(text);
      decimals = 2;
      minDecimals = text.endsWith(".00") ? 0 : 2;
    }
  }
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: minDecimals,
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
