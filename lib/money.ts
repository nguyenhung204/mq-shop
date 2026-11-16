/**
 * Integer-cent money helpers. Amounts from the API are decimal strings or
 * integer cents; nothing here converts through floating point.
 */

const DECIMAL_RE = /^(\d{1,12})(?:\.(\d{1,2}))?$/;
const PERCENT_RE = /^(\d{1,3})(?:\.(\d{1,2}))?$/;

/** "12", "12.5", "12.50" -> 1250. Returns null for anything else (signs, exponents, 3+ decimals, empty). */
export function parseDecimalToCents(input: string): number | null {
  const m = DECIMAL_RE.exec(input.trim());
  if (!m) return null;
  return Number(m[1] + (m[2] ?? "").padEnd(2, "0"));
}

/** "12.34" -> 1234 basis points. Percent must be 0..100 with at most 2 decimals. */
export function parsePercentToBps(input: string): number | null {
  const m = PERCENT_RE.exec(input.trim());
  if (!m) return null;
  const bps = Number(m[1] + (m[2] ?? "").padEnd(2, "0"));
  return bps <= 10000 ? bps : null;
}

/** 1234 -> "12.34" (integer split; negative values keep the sign). */
export function centsToDecimalString(cents: number): string {
  if (!Number.isSafeInteger(cents)) throw new RangeError("amount outside the safe integer range");
  const neg = cents < 0;
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, "0");
  return `${neg ? "-" : ""}${whole}.${frac}`;
}

/** 1250 -> "12.50"; bps share the same 2-decimal layout. */
export const bpsToPercentString = centsToDecimalString;

/** Display "12.50%" for API basis points; "-" for a malformed value instead of crashing the page. */
export function formatBpsPercent(bps: number): string {
  try {
    return `${bpsToPercentString(bps)}%`;
  } catch {
    return "-";
  }
}

/**
 * Normalise an API decimal (string or number, 2 dp expected) to integer cents
 * without float math on strings; numbers are only rounded to the cent.
 */
export function toCents(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "string") return parseDecimalToCents(value);
  if (!Number.isFinite(value) || value < 0) return null;
  return parseDecimalToCents(value.toFixed(2));
}

/** Display with grouping for the locale and exactly 2 decimals, via integer split. */
export function formatCentsDisplay(cents: number, locale = "en-US", currency?: string): string {
  let dec: string;
  try {
    dec = centsToDecimalString(cents);
  } catch {
    return "—"; // never show a wrong amount
  }
  const neg = dec.startsWith("-");
  const [whole, frac] = (neg ? dec.slice(1) : dec).split(".");
  const wholeFmt = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Number(whole));
  const sep =
    new Intl.NumberFormat(locale, { minimumFractionDigits: 1 })
      .formatToParts(1.1)
      .find((p) => p.type === "decimal")?.value ?? ".";
  const body = `${neg ? "-" : ""}${wholeFmt}${sep}${frac}`;
  return currency ? `${body} ${currency}` : body;
}

/** Whole-unit amount (e.g. NTD already floored by the server) with locale grouping. */
export function formatWholeDisplay(whole: number, locale = "en-US", currency?: string): string {
  const body = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Number.isSafeInteger(whole) ? whole : 0);
  return currency ? `${body} ${currency}` : body;
}
