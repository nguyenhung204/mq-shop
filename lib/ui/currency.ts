import { getFxDecimals } from "@/lib/fx/convert";
import {
  parseLocaleIntInput,
  parseLocaleMoneyInput,
  type MoneyInputErrorCode,
} from "@/lib/money";

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
 * Parse a locale-formatted string (or raw number) into a clean JavaScript number
 * using the strict locale money parser. Returns null if input is empty, invalid,
 * or ambiguous.
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
  const res = parseLocaleMoneyInput(input, {
    locale,
    maxDecimals,
    allowZero: true,
    allowNegative: true,
  });
  return res.ok ? res.value : null;
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
  const parsed = Number(numStr);
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


export interface InputEvaluation {
  value: number | null;
  error: MoneyInputErrorCode | null;
}

/**
 * Judge the raw text of a money input without ever altering it.
 * Empty -> no value, no error. Invalid -> no value plus the error code.
 * min/max are reported as errors, never clamped.
 */
export function evaluateCurrencyInput(
  raw: string,
  opts: { locale: string; decimals: number; min?: number; max?: number },
): InputEvaluation {
  if (!raw.trim()) return { value: null, error: null };
  const res = parseLocaleMoneyInput(raw, {
    locale: opts.locale,
    maxDecimals: opts.decimals,
    allowZero: true,
    allowNegative: opts.min == null || opts.min < 0,
    min: opts.min,
    max: opts.max,
  });
  return res.ok ? { value: res.value, error: null } : { value: null, error: res.error };
}

/** Same as evaluateCurrencyInput for whole-number quantities; empty is an error. */
export function evaluateQuantityInput(
  raw: string,
  opts: { locale: string; min?: number; max?: number },
): InputEvaluation {
  const res = parseLocaleIntInput(raw, opts);
  return res.ok ? { value: res.value, error: null } : { value: null, error: res.error };
}
