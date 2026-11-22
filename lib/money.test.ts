import { describe, expect, it } from "vitest";
import {
  bpsToPercentString,
  centsToDecimalString,
  formatBpsPercent,
  formatBlurMoneyInput,
  formatCentsDisplay,
  getMoneyInputErrorMessage,
  mapBackendAmountErrorKey,
  parseDecimalToCents,
  parseLocaleIntInput,
  parseLocaleMoneyInput,
  parsePercentToBps,
  toCents,
} from "./money";

describe("parseDecimalToCents", () => {
  it("parses without float error", () => {
    expect(parseDecimalToCents("0.10")).toBe(10);
    expect(parseDecimalToCents("0.3")).toBe(30);
    expect(parseDecimalToCents("1.15")).toBe(115);
    expect(parseDecimalToCents("19.99")).toBe(1999);
    expect(parseDecimalToCents("250")).toBe(25000);
    expect(parseDecimalToCents(" 7.5 ")).toBe(750);
  });
  it("rejects malformed input", () => {
    for (const bad of ["", "-1", "+1", "1e3", "1.234", ".5", "1.", "abc", "1,5", "0x10", "1 2"]) {
      expect(parseDecimalToCents(bad), bad).toBeNull();
    }
  });
});

describe("parsePercentToBps", () => {
  it("accepts 0..100 with 2 decimals", () => {
    expect(parsePercentToBps("0")).toBe(0);
    expect(parsePercentToBps("12.5")).toBe(1250);
    expect(parsePercentToBps("12.34")).toBe(1234);
    expect(parsePercentToBps("100")).toBe(10000);
    expect(parsePercentToBps("100.00")).toBe(10000);
  });
  it("rejects over 100, 3 decimals and junk", () => {
    for (const bad of ["100.01", "101", "1.234", "-1", "", "abc", "1e1"]) {
      expect(parsePercentToBps(bad), bad).toBeNull();
    }
  });
});

describe("cents formatting", () => {
  it("splits integers", () => {
    expect(centsToDecimalString(1234)).toBe("12.34");
    expect(centsToDecimalString(5)).toBe("0.05");
    expect(centsToDecimalString(0)).toBe("0.00");
    expect(centsToDecimalString(-250)).toBe("-2.50");
    expect(bpsToPercentString(1250)).toBe("12.50");
  });
  it("normalises API values", () => {
    expect(toCents("250.00")).toBe(25000);
    expect(toCents(19.99)).toBe(1999);
    expect(toCents(0)).toBe(0);
    expect(toCents("0")).toBe(0);
    expect(toCents(-0.01)).toBeNull();
    expect(toCents(null)).toBeNull();
    expect(toCents(-1)).toBeNull();
  });
  it("groups the whole part per locale", () => {
    expect(formatCentsDisplay(123456789, "en-US")).toBe("1,234,567.89");
    expect(formatCentsDisplay(5, "en-US", "TWD")).toBe("0.05 TWD");
    expect(formatCentsDisplay(123456, "vi-VN")).toBe("1.234,56");
  });
});

describe("money boundaries", () => {
  it("12 digits is the maximum whole part; 13 digits is refused", () => {
    expect(parseDecimalToCents("999999999999.99")).toBe(99999999999999);
    expect(parseDecimalToCents("1000000000000")).toBeNull();
    expect(parseDecimalToCents("1000000000000.00")).toBeNull();
  });
  it("every parsed amount is a safe integer", () => {
    expect(Number.isSafeInteger(parseDecimalToCents("999999999999.99"))).toBe(true);
  });
  it("an unsafe integer is refused, never shown as 0.00", () => {
    expect(() => centsToDecimalString(2 ** 53)).toThrow(RangeError);
    expect(() => centsToDecimalString(1.5)).toThrow(RangeError);
    expect(() => centsToDecimalString(Number.NaN)).toThrow(RangeError);
    expect(centsToDecimalString(Number.MAX_SAFE_INTEGER)).toBe("90071992547409.91");
    expect(formatCentsDisplay(2 ** 53)).toBe("—");
  });
});

describe("formatBpsPercent (display call sites)", () => {
  it("formats valid basis points", () => {
    expect(formatBpsPercent(1250)).toBe("12.50%");
    expect(formatBpsPercent(0)).toBe("0.00%");
  });
  it("a malformed value shows '-' and never throws", () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, 1.5, 2 ** 53]) expect(formatBpsPercent(bad), String(bad)).toBe("-");
  });
});

describe("parseLocaleMoneyInput (matrix 2A & 2B)", () => {
  it("normalizes hidden chars, whitespace, fullwidth, and Arabic-Indic digits", () => {
    expect(parseLocaleMoneyInput(" \u200B\uFEFF\u00A01,234.50\u00A0 ", { locale: "en-US" })).toEqual({
      ok: true,
      canonical: "1234.50",
      cents: 123450,
      value: 1234.5,
    });
    expect(parseLocaleMoneyInput("１，２３４．５０", { locale: "zh-TW" })).toEqual({
      ok: true,
      canonical: "1234.50",
      cents: 123450,
      value: 1234.5,
    });
    expect(parseLocaleMoneyInput("١٢٣٤.٥٠", { locale: "en" })).toEqual({
      ok: true,
      canonical: "1234.50",
      cents: 123450,
      value: 1234.5,
    });
    expect(parseLocaleMoneyInput("۱۲۳۴,۵۰", { locale: "vi" })).toEqual({
      ok: true,
      canonical: "1234.50",
      cents: 123450,
      value: 1234.5,
    });
  });

  it("handles locale grouping & decimal separators for en, zh-TW, and vi", () => {
    expect(parseLocaleMoneyInput("1.234,56", { locale: "vi", maxDecimals: 2 })).toEqual({
      ok: true,
      canonical: "1234.56",
      cents: 123456,
      value: 1234.56,
    });
    expect(parseLocaleMoneyInput("1.234", { locale: "vi", maxDecimals: 0 })).toEqual({
      ok: true,
      canonical: "1234",
      cents: 123400,
      value: 1234,
    });
    expect(parseLocaleMoneyInput("1,234.56", { locale: "en", maxDecimals: 2 })).toEqual({
      ok: true,
      canonical: "1234.56",
      cents: 123456,
      value: 1234.56,
    });
    expect(parseLocaleMoneyInput("1,234", { locale: "zh-TW", maxDecimals: 0 })).toEqual({
      ok: true,
      canonical: "1234",
      cents: 123400,
      value: 1234,
    });
  });

  it("rejects ambiguous formats without guessing", () => {
    expect(parseLocaleMoneyInput("1.234", { locale: "en", maxDecimals: 0 })).toEqual({
      ok: false,
      error: "AMBIGUOUS_FORMAT",
    });
    expect(parseLocaleMoneyInput("1.234", { locale: "zh-TW", maxDecimals: 0 })).toEqual({
      ok: false,
      error: "AMBIGUOUS_FORMAT",
    });
    expect(parseLocaleMoneyInput("1,234", { locale: "vi", maxDecimals: 0 })).toEqual({
      ok: false,
      error: "AMBIGUOUS_FORMAT",
    });
    expect(parseLocaleMoneyInput("1234.50", { locale: "vi", maxDecimals: 2 })).toEqual({
      ok: false,
      error: "AMBIGUOUS_FORMAT",
    });
    expect(parseLocaleMoneyInput("1,234.56", { locale: "vi", maxDecimals: 2 })).toEqual({
      ok: false,
      error: "AMBIGUOUS_FORMAT",
    });
    expect(parseLocaleMoneyInput("1.234,56", { locale: "en", maxDecimals: 2 })).toEqual({
      ok: false,
      error: "AMBIGUOUS_FORMAT",
    });
    expect(parseLocaleMoneyInput("1,23,456", { locale: "en", maxDecimals: 2 })).toEqual({
      ok: false,
      error: "AMBIGUOUS_FORMAT",
    });
  });

  it("rejects invalid chars, symbols, scientific notation, malformed dots, and NaN/Infinity", () => {
    for (const bad of [
      "1 234",
      "NT$100",
      "100đ",
      "$50",
      "12abc",
      "abc",
      "1e21",
      "1E3",
      ".5",
      "5.",
      "0.",
      "+5",
      "NaN",
      "Infinity",
      "-Infinity",
    ]) {
      expect(parseLocaleMoneyInput(bad, { locale: "en" }), bad).toEqual({
        ok: false,
        error: "INVALID_CHARS",
      });
    }
    expect(parseLocaleMoneyInput("   ", { locale: "en" })).toEqual({
      ok: false,
      error: "EMPTY",
    });
  });

  it("enforces decimals, zero, negative, min, and max bounds", () => {
    expect(parseLocaleMoneyInput("0.001", { locale: "en", maxDecimals: 2 })).toEqual({
      ok: false,
      error: "TOO_MANY_DECIMALS",
    });
    expect(parseLocaleMoneyInput("1.50", { locale: "en", maxDecimals: 0 })).toEqual({
      ok: false,
      error: "TOO_MANY_DECIMALS",
    });
    expect(parseLocaleMoneyInput("0", { locale: "en", allowZero: false })).toEqual({
      ok: false,
      error: "ZERO_NOT_ALLOWED",
    });
    expect(parseLocaleMoneyInput("-5", { locale: "en", allowNegative: false })).toEqual({
      ok: false,
      error: "NEGATIVE_NOT_ALLOWED",
    });
    expect(parseLocaleMoneyInput("-0", { locale: "en", allowNegative: false })).toEqual({
      ok: false,
      error: "NEGATIVE_NOT_ALLOWED",
    });
    expect(parseLocaleMoneyInput("-0", { locale: "en", allowNegative: true })).toEqual({
      ok: false,
      error: "INVALID_CHARS",
    });
    expect(parseLocaleMoneyInput("1000000000000", { locale: "en" })).toEqual({
      ok: false,
      error: "TOO_LARGE",
    });
    expect(parseLocaleMoneyInput("5", { locale: "en", min: 10 })).toEqual({
      ok: false,
      error: "BELOW_MIN",
    });
    expect(parseLocaleMoneyInput("100.01", { locale: "en", max: 100 })).toEqual({
      ok: false,
      error: "ABOVE_MAX",
    });
  });

  it("parses integers, formats blur output, and maps backend error codes", () => {
    expect(parseLocaleIntInput("1.000", { locale: "vi", min: 1, max: 1000000 })).toEqual({
      ok: true,
      value: 1000,
      canonical: "1000",
    });
    expect(parseLocaleIntInput("1.5", { locale: "en", min: 1, max: 1000000 })).toEqual({
      ok: false,
      error: "TOO_MANY_DECIMALS",
    });
    expect(formatBlurMoneyInput("1234.5", "vi", 2)).toBe("1.234,50");
    expect(formatBlurMoneyInput("1234.5", "en", 2)).toBe("1,234.50");
    expect(formatBlurMoneyInput("1234", "zh-TW", 0)).toBe("1,234");
    expect(mapBackendAmountErrorKey("AMOUNT_INVALID")).toBe("toast.amountInvalid");
    expect(mapBackendAmountErrorKey("AMOUNT_NOT_POSITIVE")).toBe("toast.amountNotPositive");
    expect(mapBackendAmountErrorKey("AMOUNT_TOO_LARGE")).toBe("toast.amountTooLarge");
    expect(mapBackendAmountErrorKey("AMOUNT_TOO_MANY_DECIMALS")).toBe("toast.amountTooManyDecimals");
    expect(getMoneyInputErrorMessage("AMBIGUOUS_FORMAT", (k, v) => `${k}:${v?.example}`, { locale: "vi" })).toBe(
      "moneyInput.ambiguousFormat:1.234,50",
    );
  });
});
