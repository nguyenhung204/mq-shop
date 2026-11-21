import { ApiError } from "@/lib/api/client";
import type { ItemStatus, Money, SettlementStatus } from "@/lib/api/dividend-settlements";

export const SETTING_FROM_QUARTER = "dividendAutoCreditFromQuarter";
export const SETTING_AUTO_ENABLED = "dividendAutoCreditEnabled";
export const FROM_QUARTER_MIN = 20001;
export const FROM_QUARTER_MAX = 21004;

/** 20264 -> "2026 Q4"; anything that is not a valid code is shown as it came. */
export function quarterCodeLabel(code: number | null | undefined): string {
  if (code == null) return "—";
  if (!isValidQuarterCode(code)) return String(code);
  return `${Math.floor(code / 10)} Q${code % 10}`;
}

/** Same rule as the API: 20001..21004 and a last digit of 1..4. */
export function isValidQuarterCode(code: number): boolean {
  return Number.isInteger(code) && code >= FROM_QUARTER_MIN && code <= FROM_QUARTER_MAX && code % 10 >= 1 && code % 10 <= 4;
}

/** "2026Q4" (what the API calls a quarter) -> "2026 Q4"; unknown shapes are returned untouched. */
export function periodKeyLabel(key: string | null | undefined): string {
  if (!key) return "—";
  const m = /^(\d{4})Q([1-4])$/.exec(key);
  return m ? `${m[1]} Q${m[2]}` : key;
}

/**
 * What an admin may type for the first quarter: the code (20264), or 2026Q4 / 2026 Q4 / 2026-Q4. Returns the
 * code, or null when it is not a quarter. Range and last digit are checked separately by the settings form.
 */
export function parseQuarterInput(raw: string): number | null {
  const text = raw.trim().toUpperCase();
  const m = /^(\d{4})\s*[-]?\s*Q\s*([1-4])$/.exec(text);
  if (m) return Number(m[1]) * 10 + Number(m[2]);
  if (/^\d{5}$/.test(text)) return Number(text);
  return null;
}

/** Quarter text of the "run a quarter" field: 2026Q4 (also 2026 Q4 / 20264), upper case, as the route takes it. */
export function runQuarterParam(raw: string): string | null {
  const code = parseQuarterInput(raw);
  if (code === null || !isValidQuarterCode(code)) return null;
  return `${Math.floor(code / 10)}Q${code % 10}`;
}

/** Whole TWD part with grouping + 2 decimals from integer cents TEXT, with BigInt (no float at any step). */
export function formatCentsText(cents: string | null | undefined, locale = "en-US"): string {
  if (cents == null || !/^-?\d+$/.test(cents)) return "—";
  const neg = cents.startsWith("-");
  const digits = (neg ? cents.slice(1) : cents).replace(/^0+(?=\d)/, "");
  const padded = digits.padStart(3, "0");
  const whole = padded.slice(0, -2);
  const frac = padded.slice(-2);
  const wholeFmt = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(BigInt(whole));
  const sep = new Intl.NumberFormat(locale, { minimumFractionDigits: 1 }).formatToParts(1.1).find((p) => p.type === "decimal")?.value ?? ".";
  return `${neg ? "-" : ""}${wholeFmt}${sep}${frac}`;
}

export function formatMoney(m: Money | null | undefined, locale = "en-US"): string {
  return m ? formatCentsText(m.cents, locale) : "—";
}

/** Tax in basis points as a percent text with 2 decimals by integer split ("500" -> "5.00%"). */
export function formatBps(bps: number | null | undefined): string {
  if (bps == null || !Number.isSafeInteger(bps) || bps < 0) return "—";
  return `${Math.floor(bps / 100)}.${String(bps % 100).padStart(2, "0")}%`;
}

export const SETTLEMENT_STATUSES: SettlementStatus[] = ["RUNNING", "COMPLETED", "FAILED"];
export const ITEM_STATUSES: ItemStatus[] = ["PENDING", "CREDITED", "SKIPPED_ZERO", "SKIPPED_NO_WALLET"];

export type RunErrorInfo = { key: string; params?: Record<string, string> };

/**
 * Failures of the run route and the reads. The 409 codes carry details (quarter, fromQuarter, lockAt) that
 * are shown in the text; unknown codes fall through to the generic mapper (null).
 */
export function dividendErrorKey(e: unknown): RunErrorInfo | null {
  if (!(e instanceof ApiError)) return null;
  const d = (e.body?.data as { details?: { quarter?: string; fromQuarter?: string } } | undefined)?.details;
  const q = periodKeyLabel(d?.quarter);
  switch (e.code) {
    case "DIVIDEND_AUTO_CREDIT_DISABLED":
      return { key: "dividendSettlements.errors.disabled" };
    case "DIVIDEND_AUTO_CREDIT_FROM_REQUIRED":
      return { key: "dividendSettlements.errors.fromRequired" };
    case "DIVIDEND_QUARTER_NOT_LOCKED":
      return { key: "dividendSettlements.errors.notLocked", params: { quarter: q } };
    case "DIVIDEND_QUARTER_BEFORE_START":
      return { key: "dividendSettlements.errors.beforeStart", params: { quarter: q, fromQuarter: periodKeyLabel(d?.fromQuarter) } };
    case "DIVIDEND_SETTLEMENT_FAILED":
      return { key: "dividendSettlements.errors.failed", params: { quarter: q } };
    case "DIVIDEND_SETTLEMENT_NOT_FOUND":
      return { key: "dividendSettlements.errors.notFound" };
    case "DIVIDEND_CREDIT_NOT_FOUND":
      return { key: "dividendSettlements.errors.creditNotFound" };
    default:
      return null;
  }
}

/** Outcome line key of a finished run. */
export const runOutcomeKey = (o: string) => `dividendSettlements.run.outcome.${o}`;

/** "Armed" = switch on AND first quarter set (from meta.autoCredit of the settlements list). */
export function armedState(a: { enabled: boolean; fromQuarterCode: number | null; armed?: boolean } | null | undefined): "armed" | "enabledNoQuarter" | "off" | "unknown" {
  if (!a) return "unknown";
  if (a.armed) return "armed";
  if (a.enabled) return "enabledNoQuarter";
  return "off";
}
