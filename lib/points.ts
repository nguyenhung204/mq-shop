/**
 * Mirror of mq_backend `points-conversion.ts`.
 * 1 PTS ≈ POINT_USD_VALUE USD; ledger withdraw converts PTS → TWD via FX (TWD→USD).
 * Display can further convert that TWD amount into the shopper's region currency.
 */
export const POINT_USD_VALUE = 0.99999;

export const FX_BASE_CURRENCY = "TWD";

export function convertPointsToTwd(
  points: number,
  rateTwdToUsd: number,
  decimalPlaces = 2,
): number {
  if (!(points > 0) || !(rateTwdToUsd > 0)) return 0;
  const raw = (points * POINT_USD_VALUE) / rateTwdToUsd;
  const factor = 10 ** decimalPlaces;
  return Math.round(raw * factor) / factor;
}

/** Convert TWD ledger amount → display quote using FX map (TWD base). */
export function convertTwdToDisplay(
  amountTwd: number,
  displayCurrency: string,
  rates: Record<string, number> | null | undefined,
  decimalPlaces = 2,
): number {
  if (!(amountTwd > 0)) return 0;
  const currency = (displayCurrency || FX_BASE_CURRENCY).toUpperCase();
  if (currency === FX_BASE_CURRENCY) return roundMoney(amountTwd, decimalPlaces);
  const rate = rates?.[currency];
  if (!(typeof rate === "number" && rate > 0)) return roundMoney(amountTwd, decimalPlaces);
  return roundMoney(amountTwd * rate, decimalPlaces);
}

/** PTS → region display currency (via TWD bridge). */
export function convertPointsToDisplay(
  points: number,
  rateTwdToUsd: number,
  displayCurrency: string,
  rates: Record<string, number> | null | undefined,
  decimalPlaces = 2,
): number {
  const twd = convertPointsToTwd(points, rateTwdToUsd, 6);
  return convertTwdToDisplay(twd, displayCurrency, rates, decimalPlaces);
}

export function formatPointUsdValue(): string {
  return String(POINT_USD_VALUE);
}

export function formatDisplayMoney(
  value: string | number | undefined | null,
  currency = FX_BASE_CURRENCY,
): string {
  const n = typeof value === "string" ? Number(value) : value ?? 0;
  const code = (currency || FX_BASE_CURRENCY).toUpperCase();
  if (!Number.isFinite(n)) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      minimumFractionDigits: 0,
      maximumFractionDigits: code === "VND" ? 0 : 2,
    }).format(0);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: code,
    minimumFractionDigits: 0,
    maximumFractionDigits: code === "VND" ? 0 : 2,
  }).format(n);
}

function roundMoney(n: number, decimalPlaces: number): number {
  const factor = 10 ** decimalPlaces;
  return Math.round(n * factor) / factor;
}
