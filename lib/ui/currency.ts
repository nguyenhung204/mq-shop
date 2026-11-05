import { getFxDecimals } from "@/lib/fx/convert";

export interface LocaleSeparators {
  group: string;
  decimal: string;
}

/**
 * Extract group (thousands) and decimal separators for a given locale.
 */
export function getLocaleSeparators(locale = "en-US"): LocaleSeparators {
  try {
    const parts = new Intl.NumberFormat(locale).formatToParts(1000.5);
    const group = parts.find((p) => p.type === "group")?.value ?? ",";
    const decimal = parts.find((p) => p.type === "decimal")?.value ?? ".";
    return { group, decimal };
  } catch {
    return { group: ",", decimal: "." };
  }
}

/**
 * Returns allowed decimal precision for a currency (e.g. 0 for VND/TWD, 2 for USD/MYR/SGD).
 */
export function getCurrencyDecimals(currency: string): number {
  return getFxDecimals(currency);
}

/**
 * Get currency symbol (or standard abbreviation) formatted for the locale.
 */
export function getCurrencySymbol(currency: string, locale = "en-US"): string {
  try {
    const parts = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
    }).formatToParts(0);
    const sym = parts.find((p) => p.type === "currency")?.value;
    return sym || currency;
  } catch {
    return currency;
  }
}

/**
 * Check if the currency symbol typically appears before or after the number in this locale.
 */
export function getCurrencyAffix(
  currency: string,
  locale = "en-US",
): { symbol: string; position: "prefix" | "suffix" } {
  try {
    const parts = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
    }).formatToParts(100);
    const curIndex = parts.findIndex((p) => p.type === "currency");
    const numIndex = parts.findIndex(
      (p) => p.type === "integer" || p.type === "decimal",
    );
    const symbol = parts[curIndex]?.value || currency;
    return {
      symbol,
      position: curIndex < numIndex ? "prefix" : "suffix",
    };
  } catch {
    return { symbol: currency, position: "prefix" };
  }
}

/**
 * Parse a locale-formatted string (or raw number) into a clean JavaScript number.
 * Returns null if input is empty or invalid.
 */
export function parseLocaleNumber(
  input: string | number | null | undefined,
  locale = "en-US",
  maxDecimals = 0,
): number | null {
  if (input == null) return null;
  if (typeof input === "number") {
    return Number.isFinite(input) ? input : null;
  }

  const raw = input.trim();
  if (!raw) return null;

  // Zero-decimal currencies (e.g. VND, TWD, JPY):
  // Any punctuation (, or .) entered by the user is a thousand grouping or accidental typing.
  if (maxDecimals === 0) {
    const cleaned = raw.replace(/[^\d-]/g, "");
    if (!cleaned || cleaned === "-") return null;
    const n = parseInt(cleaned, 10);
    return Number.isFinite(n) ? n : null;
  }

  const { group, decimal } = getLocaleSeparators(locale);

  let normalized = raw;

  // Handle keypad dot when locale uses comma as decimal (e.g. vi-VN with USD/EUR):
  // If user typed dot and no comma, check if it was intended as a decimal point
  if (decimal === "," && !normalized.includes(",") && normalized.includes(".")) {
    const parts = normalized.split(".");
    if (parts.length === 2 && parts[1].length <= maxDecimals) {
      normalized = parts[0] + "." + parts[1];
    } else {
      normalized = normalized.split(group).join("");
    }
  } else {
    // Strip thousands group separator
    normalized = normalized.split(group).join("");
    // Replace decimal separator with "."
    if (decimal !== ".") {
      normalized = normalized.split(decimal).join(".");
    }
  }

  // Strip remaining non-numeric characters (keep minus and dot)
  normalized = normalized.replace(/[^\d.-]/g, "");
  if (!normalized || normalized === "-" || normalized === ".") return null;

  const n = parseFloat(normalized);
  if (!Number.isFinite(n)) return null;

  // Round to maxDecimals to avoid floating point artifacts
  const factor = Math.pow(10, maxDecimals);
  return Math.round(n * factor) / factor;
}

/**
 * Format a number using locale thousand grouping and currency decimal rules.
 */
export function formatLocaleNumber(
  value: number | null | undefined,
  locale = "en-US",
  options?: {
    minDecimals?: number;
    maxDecimals?: number;
  },
): string {
  if (value == null || !Number.isFinite(value)) return "";

  const minDecimals = options?.minDecimals ?? 0;
  const maxDecimals = options?.maxDecimals ?? 0;

  try {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: minDecimals,
      maximumFractionDigits: maxDecimals,
      useGrouping: true,
    }).format(value);
  } catch {
    return maxDecimals > 0 ? value.toFixed(maxDecimals) : Math.round(value).toString();
  }
}

/**
 * Live formatting for currency inputs during keystrokes.
 * Formats the integer part with thousands separators while preserving typing flow,
 * handling decimals, zero values, and empty states.
 */
export function formatLiveCurrency(
  input: string,
  groupSep = ",",
  decSep = ".",
  decimals = 0,
): { display: string; value: number | null } {
  if (!input || !input.trim()) {
    return { display: "", value: null };
  }

  let isNegative = false;
  let str = input.trim();
  if (str.startsWith("-")) {
    isNegative = true;
    str = str.slice(1);
  }

  if (decimals === 0) {
    // Only digits allowed for zero-decimal currencies (VND, TWD, JPY, etc.)
    const digits = str.replace(/[^\d]/g, "");
    if (!digits) return { display: "", value: null };

    // Keep single 0 as "0", strip leading zeros if length > 1
    const cleanDigits = digits.replace(/^0+(?=\d)/, "");
    const formatted = cleanDigits.replace(/\B(?=(\d{3})+(?!\d))/g, groupSep);
    const num = parseInt(cleanDigits, 10);
    const finalDisplay = (isNegative ? "-" : "") + formatted;
    const finalValue = isNegative ? -num : num;
    return { display: finalDisplay, value: finalValue };
  }

  // Decimals > 0 (USD, MYR, SGD):
  // Support both locale decimal separator and alternative (e.g. dot on numpad when decSep is comma)
  let decIdx = str.indexOf(decSep);
  if (decIdx === -1) {
    const fallbackDec = decSep === "." ? "," : ".";
    decIdx = str.indexOf(fallbackDec);
  }

  let intStr = "";
  let decStr = "";
  let hasDec = false;

  if (decIdx !== -1) {
    hasDec = true;
    intStr = str.slice(0, decIdx).replace(/[^\d]/g, "");
    decStr = str.slice(decIdx + 1).replace(/[^\d]/g, "").slice(0, decimals);
  } else {
    intStr = str.replace(/[^\d]/g, "");
  }

  if (!intStr && !decStr && !hasDec) {
    return { display: "", value: null };
  }

  if (!intStr && hasDec) {
    intStr = "0";
  }

  const cleanInt = intStr ? intStr.replace(/^0+(?=\d)/, "") : "0";
  const formattedInt = cleanInt.replace(/\B(?=(\d{3})+(?!\d))/g, groupSep);

  let display = (isNegative ? "-" : "") + formattedInt;
  if (hasDec) {
    display += decSep + decStr;
  }

  let numStr = (isNegative ? "-" : "") + cleanInt;
  if (decStr) {
    numStr += "." + decStr;
  }
  const parsed = parseFloat(numStr);
  const value = Number.isFinite(parsed) ? parsed : null;

  return { display, value };
}

/**
 * Re-calculate cursor position in the formatted string based on digits and decimal state.
 */
export function findCursorPosition(
  formatted: string,
  digitsBefore: number,
  decSep = ".",
  hadDecBefore = false,
): number {
  if (digitsBefore === 0 && !hadDecBefore) {
    return 0;
  }
  let count = 0;
  let passedDec = false;
  for (let i = 0; i < formatted.length; i++) {
    const ch = formatted[i];
    if (ch === decSep) {
      passedDec = true;
      if (hadDecBefore && count === digitsBefore) {
        return i + 1;
      }
    } else if (/\d/.test(ch)) {
      count++;
      if (count === digitsBefore && (!hadDecBefore || passedDec)) {
        return i + 1;
      }
    }
  }
  return formatted.length;
}

