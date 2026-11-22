import { describe, expect, it } from "vitest";
import { formatPrefillDecimal, parseLocaleMoneyInput } from "./money";

const SEED = [0.1269, 814.09, 0.0398, 0.031, 1, 100000, 0.00000001, 12.5];
const LOCALES = ["en", "vi", "zh-TW"];

describe("formatPrefillDecimal", () => {
  it.each(LOCALES)("%s: prefilled text parses back to the same canonical value", (loc) => {
    for (const rate of SEED) {
      const text = formatPrefillDecimal(rate, loc);
      const res = parseLocaleMoneyInput(text, { locale: loc, maxDecimals: 8, allowZero: false });
      expect(res.ok, `${loc} ${text}`).toBe(true);
      if (res.ok) expect(Number(res.canonical)).toBe(rate);
    }
  });

  it("uses the locale decimal separator and drops no digit", () => {
    expect(formatPrefillDecimal("814.09", "vi")).toBe("814,09");
    expect(formatPrefillDecimal("814.09", "en")).toBe("814.09");
    expect(formatPrefillDecimal(0.1269, "vi")).toBe("0,1269");
    expect(formatPrefillDecimal(1e-7, "en")).toBe("0.0000001");
    expect(formatPrefillDecimal("1.00000000", "zh-TW")).toBe("1");
  });

  it("never rounds beyond 8 dp and never emits exponents", () => {
    expect(formatPrefillDecimal("0.123456789012", "en")).toBe("0.123456789012");
    expect(formatPrefillDecimal("0.123456789012", "vi")).toBe("0,123456789012");
    expect(formatPrefillDecimal(1e-9, "en")).toBe("0.000000001");
    expect(formatPrefillDecimal(1e21, "en")).toBe("1000000000000000000000");
    expect(formatPrefillDecimal("100", "vi")).toBe("100");
    expect(formatPrefillDecimal("100.50", "en")).toBe("100.5");
    expect(formatPrefillDecimal("1e3", "en")).toBe("");
  });

  it("returns empty for missing or non-finite input", () => {
    expect(formatPrefillDecimal(null, "en")).toBe("");
    expect(formatPrefillDecimal("", "en")).toBe("");
    expect(formatPrefillDecimal("abc", "en")).toBe("");
  });
});

import { localizeDecimalString } from "./money";
describe("localizeDecimalString", () => {
  it.each(LOCALES)("%s: keeps digits and round-trips through the parser", (loc) => {
    for (const s of ["5.00", "2.00", "4.5", "0.99999", "12"]) {
      const text = localizeDecimalString(s, loc);
      const res = parseLocaleMoneyInput(text, { locale: loc, maxDecimals: 8, allowZero: false });
      expect(res.ok, `${loc} ${text}`).toBe(true);
      if (res.ok) expect(res.canonical).toBe(s.replace(/^0+(?=\d)/, ""));
    }
  });
  it("vi swaps only the decimal point", () => {
    expect(localizeDecimalString("5.00", "vi")).toBe("5,00");
    expect(localizeDecimalString("5.00", "en")).toBe("5.00");
  });
});
