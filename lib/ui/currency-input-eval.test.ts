import { describe, expect, it } from "vitest";
import { evaluateCurrencyInput, evaluateQuantityInput } from "./currency";

const bad = (error: string) => ({ value: null, error });
const good = (value: number) => ({ value, error: null });

describe("evaluateCurrencyInput (TWD, 0 decimals)", () => {
  const opts = (locale: string) => ({ locale, decimals: 0 });

  it.each(["en-US", "zh-TW"])("%s: wrong values are errors, never silently changed", (loc) => {
    const o = opts(loc);
    expect(evaluateCurrencyInput("0.001", o)).toEqual(bad("AMBIGUOUS_FORMAT"));
    expect(evaluateCurrencyInput("1e3", o)).toEqual(bad("INVALID_CHARS"));
    expect(evaluateCurrencyInput("12abc", o)).toEqual(bad("INVALID_CHARS"));
    expect(evaluateCurrencyInput("100.5", o)).toEqual(bad("TOO_MANY_DECIMALS"));
    expect(evaluateCurrencyInput("+5", o)).toEqual(bad("INVALID_CHARS"));
    expect(evaluateCurrencyInput("NT$100", o)).toEqual(bad("INVALID_CHARS"));
    expect(evaluateCurrencyInput("1,234.50", o)).toEqual(bad("TOO_MANY_DECIMALS"));
    expect(evaluateCurrencyInput("1.234", o)).toEqual(bad("AMBIGUOUS_FORMAT"));
    expect(evaluateCurrencyInput("1 234", o)).toEqual(bad("INVALID_CHARS"));
    expect(evaluateCurrencyInput("-0", o)).toEqual(bad("INVALID_CHARS"));
    expect(evaluateCurrencyInput("Infinity", o)).toEqual(bad("INVALID_CHARS"));
  });

  it.each(["en-US", "zh-TW"])("%s: valid values are accepted exactly", (loc) => {
    const o = opts(loc);
    expect(evaluateCurrencyInput("", o)).toEqual({ value: null, error: null });
    expect(evaluateCurrencyInput("  ", o)).toEqual({ value: null, error: null });
    expect(evaluateCurrencyInput("0", o)).toEqual(good(0));
    expect(evaluateCurrencyInput("100", o)).toEqual(good(100));
    expect(evaluateCurrencyInput("  1234 ", o)).toEqual(good(1234));
    expect(evaluateCurrencyInput("1,234", o)).toEqual(good(1234));
    expect(evaluateCurrencyInput("１２３", o)).toEqual(good(123));
  });

  it("vi: '.' groups thousands, ',' is decimal", () => {
    const o = opts("vi-VN");
    expect(evaluateCurrencyInput("1.234", o)).toEqual(good(1234));
    expect(evaluateCurrencyInput("1.234.567", o)).toEqual(good(1234567));
    expect(evaluateCurrencyInput("1234.50", o)).toEqual(bad("AMBIGUOUS_FORMAT"));
    expect(evaluateCurrencyInput("0.001", o)).toEqual(bad("AMBIGUOUS_FORMAT"));
    expect(evaluateCurrencyInput("100,5", o)).toEqual(bad("TOO_MANY_DECIMALS"));
    expect(evaluateCurrencyInput("1e3", o)).toEqual(bad("INVALID_CHARS"));
    expect(evaluateCurrencyInput("12abc", o)).toEqual(bad("INVALID_CHARS"));
    expect(evaluateCurrencyInput("100đ", o)).toEqual(bad("INVALID_CHARS"));
  });

  it("2 decimals: locale-specific forms", () => {
    expect(evaluateCurrencyInput("1,234.50", { locale: "en-US", decimals: 2 })).toEqual(good(1234.5));
    expect(evaluateCurrencyInput("1.234,50", { locale: "vi-VN", decimals: 2 })).toEqual(good(1234.5));
    expect(evaluateCurrencyInput("1234.50", { locale: "vi-VN", decimals: 2 })).toEqual(bad("AMBIGUOUS_FORMAT"));
    expect(evaluateCurrencyInput("1.005", { locale: "en-US", decimals: 2 })).toEqual(bad("TOO_MANY_DECIMALS"));
    expect(evaluateCurrencyInput(".5", { locale: "en-US", decimals: 2 })).toEqual(bad("INVALID_CHARS"));
    expect(evaluateCurrencyInput("5.", { locale: "en-US", decimals: 2 })).toEqual(bad("INVALID_CHARS"));
  });

  it("min/max produce errors instead of clamping", () => {
    const o = { locale: "en-US", decimals: 0, min: 0, max: 1000 };
    expect(evaluateCurrencyInput("1001", o)).toEqual(bad("ABOVE_MAX"));
    expect(evaluateCurrencyInput("-5", o)).toEqual(bad("NEGATIVE_NOT_ALLOWED"));
    expect(evaluateCurrencyInput("1000", o)).toEqual(good(1000));
    expect(evaluateCurrencyInput("5", { locale: "en-US", decimals: 0, min: 10 })).toEqual(bad("BELOW_MIN"));
  });
});

describe("evaluateQuantityInput", () => {
  const o = { locale: "en-US", min: 1, max: 99 };
  it("rejects instead of stripping characters", () => {
    expect(evaluateQuantityInput("1.5", o)).toEqual(bad("TOO_MANY_DECIMALS"));
    expect(evaluateQuantityInput("1e3", o)).toEqual(bad("INVALID_CHARS"));
    expect(evaluateQuantityInput("12abc", o)).toEqual(bad("INVALID_CHARS"));
    expect(evaluateQuantityInput("-1", o)).toEqual(bad("NEGATIVE_NOT_ALLOWED"));
    expect(evaluateQuantityInput("0", o)).toEqual(bad("BELOW_MIN"));
    expect(evaluateQuantityInput("100", o)).toEqual(bad("ABOVE_MAX"));
    expect(evaluateQuantityInput("", o)).toEqual(bad("EMPTY"));
  });
  it("accepts valid integers", () => {
    expect(evaluateQuantityInput(" 5 ", o)).toEqual(good(5));
    expect(evaluateQuantityInput("99", o)).toEqual(good(99));
    expect(evaluateQuantityInput("1.000", { locale: "vi", min: 1 })).toEqual(good(1000));
  });
});
