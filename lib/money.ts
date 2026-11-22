/**
 * Integer-cent money helpers & strict locale-aware input parser/formatter.
 * Amounts from the API are decimal strings or integer cents; nothing here
 * converts through floating point for money math.
 */

const DECIMAL_RE = /^(\d{1,12})(?:\.(\d{1,2}))?$/;
const PERCENT_RE = /^(\d{1,3})(?:\.(\d{1,2}))?$/;

export type MoneyInputErrorCode =
  | "EMPTY"
  | "INVALID_CHARS"
  | "AMBIGUOUS_FORMAT"
  | "TOO_MANY_DECIMALS"
  | "NEGATIVE_NOT_ALLOWED"
  | "ZERO_NOT_ALLOWED"
  | "TOO_LARGE"
  | "BELOW_MIN"
  | "ABOVE_MAX";

export interface ParseLocaleMoneyOptions {
  locale?: string | null;
  maxDecimals?: number;
  allowZero?: boolean;
  allowNegative?: boolean;
  min?: number;
  max?: number;
}

export type ParseLocaleMoneyResult =
  | { ok: true; canonical: string; cents?: number; value: number }
  | { ok: false; error: MoneyInputErrorCode };

export interface ParseLocaleIntOptions {
  locale?: string | null;
  min?: number;
  max?: number;
  allowZero?: boolean;
  allowNegative?: boolean;
}

export type ParseLocaleIntResult =
  | { ok: true; value: number; canonical: string }
  | { ok: false; error: MoneyInputErrorCode };

export const BACKEND_AMOUNT_ERROR_MAP: Record<string, string> = {
  AMOUNT_INVALID: "toast.amountInvalid",
  AMOUNT_NOT_POSITIVE: "toast.amountNotPositive",
  AMOUNT_TOO_LARGE: "toast.amountTooLarge",
  AMOUNT_TOO_MANY_DECIMALS: "toast.amountTooManyDecimals",
};

/** Map a backend amount error code to its i18n key, or null if not a money code. */
export function mapBackendAmountErrorKey(code: string | null | undefined): string | null {
  if (!code) return null;
  return BACKEND_AMOUNT_ERROR_MAP[code] ?? null;
}

/** Normalize hidden characters, fullwidth digits/separators, and Arabic-Indic digits. */
function normalizeRawMoneyInput(raw: string): string {
  return raw
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, "")
    .trim()
    .replace(/[\uFF10-\uFF19]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/\uFF0E/g, ".")
    .replace(/\uFF0C/g, ",")
    .replace(/[\u0660-\u0669]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x0660 + 48))
    .replace(/[\u06F0-\u06F9]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x06f0 + 48));
}

function isViLocale(locale?: string | null): boolean {
  return (locale ?? "").toLowerCase().startsWith("vi");
}

function isValidGrouping(intPart: string, groupSep: string): boolean {
  const groups = intPart.split(groupSep);
  if (groups.length === 1) {
    return /^\d+$/.test(groups[0]!);
  }
  if (!/^[1-9]\d{0,2}$/.test(groups[0]!) && groups[0] !== "0") {
    return false;
  }
  // Disallow "0,123" or "0.123" as grouped integer
  if (groups[0] === "0") return false;
  for (let i = 1; i < groups.length; i++) {
    if (!/^\d{3}$/.test(groups[i]!)) return false;
  }
  return true;
}

/**
 * Strictly parse a locale-formatted money/number input string.
 * - `vi`: `.` thousands grouping (3-digit groups), `,` decimal separator.
 * - `en` / `zh-TW`: `,` thousands grouping (3-digit groups), `.` decimal separator.
 * Rejects ambiguous formats, currency symbols, letters, scientific notation,
 * leading/trailing dots (`.5`, `5.`, `0.`), `+5`, `-0`, `NaN`, `Infinity`.
 */
export function parseLocaleMoneyInput(
  raw: string,
  options: ParseLocaleMoneyOptions = {},
): ParseLocaleMoneyResult {
  const {
    locale = "en-US",
    maxDecimals = 2,
    allowZero = true,
    allowNegative = false,
    min,
    max,
  } = options;

  const s = normalizeRawMoneyInput(raw);
  if (!s) return { ok: false, error: "EMPTY" };

  if (/^(?:nan|infinity|[+-]infinity)$/i.test(s)) {
    return { ok: false, error: "INVALID_CHARS" };
  }
  if (/[eE+]/.test(s) || /\s/.test(s)) {
    return { ok: false, error: "INVALID_CHARS" };
  }
  if (!/^-?[\d.,]+$/.test(s)) {
    return { ok: false, error: "INVALID_CHARS" };
  }

  const isNeg = s.startsWith("-");
  const body = isNeg ? s.slice(1) : s;
  if (!body || body.includes("-")) {
    return { ok: false, error: "INVALID_CHARS" };
  }
  if (
    body.startsWith(".") ||
    body.startsWith(",") ||
    body.endsWith(".") ||
    body.endsWith(",")
  ) {
    return { ok: false, error: "INVALID_CHARS" };
  }

  const vi = isViLocale(locale);
  const groupSep = vi ? "." : ",";
  const decSep = vi ? "," : ".";

  const hasGroup = body.includes(groupSep);
  const hasDec = body.includes(decSep);

  let rawInt = "";
  let rawFrac = "";

  if (hasGroup && hasDec) {
    const decParts = body.split(decSep);
    if (decParts.length !== 2) {
      return { ok: false, error: "AMBIGUOUS_FORMAT" };
    }
    const [intSection, fracSection] = decParts as [string, string];
    if (fracSection.includes(groupSep) || !fracSection || !intSection) {
      return { ok: false, error: "AMBIGUOUS_FORMAT" };
    }
    if (!isValidGrouping(intSection, groupSep)) {
      return { ok: false, error: "AMBIGUOUS_FORMAT" };
    }
    rawInt = intSection.split(groupSep).join("");
    rawFrac = fracSection;
  } else if (hasDec) {
    const decParts = body.split(decSep);
    if (decParts.length !== 2) {
      return { ok: false, error: "AMBIGUOUS_FORMAT" };
    }
    const [intSection, fracSection] = decParts as [string, string];
    if (maxDecimals === 0) {
      return fracSection.length === 3
        ? { ok: false, error: "AMBIGUOUS_FORMAT" }
        : { ok: false, error: "TOO_MANY_DECIMALS" };
    }
    rawInt = intSection;
    rawFrac = fracSection;
  } else if (hasGroup) {
    const groups = body.split(groupSep);
    if (groups.length === 2 && groups[1]!.length !== 3) {
      // e.g. "1234.50" in vi or "1,50" in en
      return { ok: false, error: "AMBIGUOUS_FORMAT" };
    }
    if (!isValidGrouping(body, groupSep)) {
      return { ok: false, error: "AMBIGUOUS_FORMAT" };
    }
    rawInt = groups.join("");
  } else {
    rawInt = body;
  }

  if (!/^\d+$/.test(rawInt) || (rawFrac && !/^\d+$/.test(rawFrac))) {
    return { ok: false, error: "INVALID_CHARS" };
  }

  if (rawFrac.length > maxDecimals) {
    return { ok: false, error: "TOO_MANY_DECIMALS" };
  }

  const cleanInt = rawInt.replace(/^0+(?=\d)/, "") || "0";
  const isZero = cleanInt === "0" && (!rawFrac || /^0+$/.test(rawFrac));

  if (isNeg && isZero) {
    if (!allowNegative) return { ok: false, error: "NEGATIVE_NOT_ALLOWED" };
    return { ok: false, error: allowZero ? "INVALID_CHARS" : "ZERO_NOT_ALLOWED" };
  }
  if (isNeg && !allowNegative) {
    return { ok: false, error: "NEGATIVE_NOT_ALLOWED" };
  }
  if (isZero && !allowZero) {
    return { ok: false, error: "ZERO_NOT_ALLOWED" };
  }

  if (cleanInt.length > 12) {
    return { ok: false, error: "TOO_LARGE" };
  }

  const canonical = `${isNeg && !isZero ? "-" : ""}${cleanInt}${rawFrac ? `.${rawFrac}` : ""}`;
  const value = Number(canonical);
  if (!Number.isFinite(value)) {
    return { ok: false, error: "TOO_LARGE" };
  }

  if (min != null && value < min) {
    return { ok: false, error: "BELOW_MIN" };
  }
  if (max != null && value > max) {
    return { ok: false, error: "ABOVE_MAX" };
  }

  const cents =
    maxDecimals <= 2
      ? (isNeg && !isZero ? -1 : 1) * Number(cleanInt + rawFrac.padEnd(2, "0"))
      : undefined;

  return {
    ok: true,
    canonical,
    ...(cents !== undefined ? { cents } : {}),
    value,
  };
}

/** Parse a strict locale-formatted integer input (no decimals allowed). */
export function parseLocaleIntInput(
  raw: string,
  options: ParseLocaleIntOptions = {},
): ParseLocaleIntResult {
  const res = parseLocaleMoneyInput(raw, {
    locale: options.locale,
    maxDecimals: 0,
    allowZero: options.allowZero ?? true,
    allowNegative: options.allowNegative ?? false,
    min: options.min,
    max: options.max,
  });
  if (!res.ok) return res;
  return { ok: true, value: res.value, canonical: res.canonical };
}

/**
 * Format a canonical ASCII decimal string (e.g. "1234.50") for display on blur
 * using locale grouping and decimal separators without floating-point math.
 */
export function formatBlurMoneyInput(
  canonical: string,
  locale = "en-US",
  decimals = 2,
): string {
  const s = canonical.trim();
  if (!s || !/^-?\d+(?:\.\d+)?$/.test(s)) return "";
  const isNeg = s.startsWith("-");
  const body = isNeg ? s.slice(1) : s;
  const [rawInt = "0", rawFrac = ""] = body.split(".");
  const cleanInt = rawInt.replace(/^0+(?=\d)/, "") || "0";

  const vi = isViLocale(locale);
  const groupSep = vi ? "." : ",";
  const decSep = vi ? "," : ".";

  const groupedInt = cleanInt.replace(/\B(?=(\d{3})+(?!\d))/g, groupSep);
  if (decimals <= 0) {
    return `${isNeg && cleanInt !== "0" ? "-" : ""}${groupedInt}`;
  }
  const paddedFrac = rawFrac.slice(0, decimals).padEnd(decimals, "0");
  return `${isNeg && !(cleanInt === "0" && /^0+$/.test(paddedFrac)) ? "-" : ""}${groupedInt}${decSep}${paddedFrac}`;
}

/** Build a localized error message with a locale-appropriate example for money/int inputs. */
export function getMoneyInputErrorMessage(
  error: MoneyInputErrorCode,
  t: (key: string, vars?: Record<string, string>) => string,
  opts: {
    locale?: string | null;
    maxDecimals?: number;
    min?: number;
    max?: number;
  } = {},
): string {
  const maxDecimals = opts.maxDecimals ?? 2;
  const vi = isViLocale(opts.locale);
  const example =
    maxDecimals === 0
      ? vi
        ? "1.000"
        : "1,000"
      : vi
        ? `1.234,${"50".padEnd(maxDecimals, "0").slice(0, maxDecimals)}`
        : `1,234.${"50".padEnd(maxDecimals, "0").slice(0, maxDecimals)}`;

  switch (error) {
    case "EMPTY":
      return t("moneyInput.empty");
    case "INVALID_CHARS":
      return t("moneyInput.invalidChars", { example });
    case "AMBIGUOUS_FORMAT":
      return t("moneyInput.ambiguousFormat", { example });
    case "TOO_MANY_DECIMALS":
      return t("moneyInput.tooManyDecimals", {
        maxDecimals: String(maxDecimals),
        example,
      });
    case "NEGATIVE_NOT_ALLOWED":
      return t("moneyInput.negativeNotAllowed");
    case "ZERO_NOT_ALLOWED":
      return t("moneyInput.zeroNotAllowed");
    case "TOO_LARGE":
      return t("moneyInput.tooLarge");
    case "BELOW_MIN":
      return t("moneyInput.belowMin", { min: String(opts.min ?? 0) });
    case "ABOVE_MAX":
      return t("moneyInput.aboveMax", { max: String(opts.max ?? "") });
  }
}

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
