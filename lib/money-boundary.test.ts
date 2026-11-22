import { describe, expect, it } from "vitest";
import { parseLocaleMoneyInput } from "./money";

const en = { locale: "en", maxDecimals: 2 } as const;
const twd = { locale: "en", maxDecimals: 0 } as const;

describe("parseLocaleMoneyInput boundaries", () => {
  it("N1: hidden characters and spaces around the value are removed before trimming", () => {
    for (const raw of ["​ 5", " ​5", "  5 ", " 5", "5 ", "﻿5​", "  5  "]) {
      const r = parseLocaleMoneyInput(raw, twd);
      expect(r.ok, JSON.stringify(raw)).toBe(true);
      if (r.ok) expect(r.value).toBe(5);
    }
  });

  it("N1: hidden characters inside the value are removed too", () => {
    for (const ch of ["\u200B", "\u200C", "\u200D", "\uFEFF", "\u00A0"]) {
      expect(parseLocaleMoneyInput(`1${ch}2`, twd), JSON.stringify(ch)).toMatchObject({ ok: true, value: 12 });
    }
  });

  it("N4: first thousands group must be 1-3 digits", () => {
    expect(parseLocaleMoneyInput("1234,567", twd)).toEqual({ ok: false, error: "AMBIGUOUS_FORMAT" });
    expect(parseLocaleMoneyInput("1,234,567", twd)).toMatchObject({ ok: true, value: 1234567 });
    expect(parseLocaleMoneyInput("12345,678", twd).ok).toBe(false);
    expect(parseLocaleMoneyInput("1.234.567", { locale: "vi", maxDecimals: 0 })).toMatchObject({ ok: true, value: 1234567 });
    expect(parseLocaleMoneyInput("1234.567", { locale: "vi", maxDecimals: 0 }).ok).toBe(false);
  });

  it("N8: exactly 12 integer digits is valid, 13 is TOO_LARGE", () => {
    expect(parseLocaleMoneyInput("999999999999", twd)).toMatchObject({ ok: true, value: 999999999999 });
    expect(parseLocaleMoneyInput("1000000000000", twd)).toEqual({ ok: false, error: "TOO_LARGE" });
    expect(parseLocaleMoneyInput("999999999999.99", en)).toMatchObject({ ok: true, canonical: "999999999999.99" });
    expect(parseLocaleMoneyInput("1000000000000.00", en)).toEqual({ ok: false, error: "TOO_LARGE" });
  });

  it("N9: min and max are inclusive", () => {
    expect(parseLocaleMoneyInput("0", { ...twd, min: 0, allowZero: true })).toMatchObject({ ok: true, value: 0 });
    expect(parseLocaleMoneyInput("10", { ...twd, min: 10 })).toMatchObject({ ok: true, value: 10 });
    expect(parseLocaleMoneyInput("9", { ...twd, min: 10 })).toEqual({ ok: false, error: "BELOW_MIN" });
    expect(parseLocaleMoneyInput("100", { ...twd, max: 100 })).toMatchObject({ ok: true, value: 100 });
    expect(parseLocaleMoneyInput("101", { ...twd, max: 100 })).toEqual({ ok: false, error: "ABOVE_MAX" });
    expect(parseLocaleMoneyInput("100.00", { ...en, max: 100 })).toMatchObject({ ok: true, value: 100 });
    expect(parseLocaleMoneyInput("100.01", { ...en, max: 100 })).toEqual({ ok: false, error: "ABOVE_MAX" });
    expect(parseLocaleMoneyInput("0", { ...twd, min: 1, allowZero: true })).toEqual({ ok: false, error: "BELOW_MIN" });
  });

  it("N20: negative values keep their sign in value, canonical and cents", () => {
    const neg = { ...en, allowNegative: true } as const;
    expect(parseLocaleMoneyInput("-5.50", neg)).toEqual({ ok: true, canonical: "-5.50", cents: -550, value: -5.5 });
    expect(parseLocaleMoneyInput("5.50", neg)).toEqual({ ok: true, canonical: "5.50", cents: 550, value: 5.5 });
    expect(parseLocaleMoneyInput("-1,234.5", neg)).toMatchObject({ ok: true, canonical: "-1234.5", cents: -123450 });
    expect(parseLocaleMoneyInput("-5.50", en)).toEqual({ ok: false, error: "NEGATIVE_NOT_ALLOWED" });
  });
});
