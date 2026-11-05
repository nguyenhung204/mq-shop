import { describe, expect, it } from "vitest";
import {
  findCursorPosition,
  formatLiveCurrency,
  formatLocaleNumber,
  getCurrencyAffix,
  getCurrencyDecimals,
  getCurrencySymbol,
  getLocaleSeparators,
  parseLocaleNumber,
} from "./currency";

describe("currency utilities", () => {
  describe("getLocaleSeparators", () => {
    it("returns correct separators for vi-VN", () => {
      const seps = getLocaleSeparators("vi-VN");
      expect(seps.group).toBe(".");
      expect(seps.decimal).toBe(",");
    });

    it("returns correct separators for en-US", () => {
      const seps = getLocaleSeparators("en-US");
      expect(seps.group).toBe(",");
      expect(seps.decimal).toBe(".");
    });

    it("returns correct separators for zh-TW", () => {
      const seps = getLocaleSeparators("zh-TW");
      expect(seps.group).toBe(",");
      expect(seps.decimal).toBe(".");
    });
  });

  describe("getCurrencyDecimals", () => {
    it("returns 0 for VND and TWD", () => {
      expect(getCurrencyDecimals("VND")).toBe(0);
      expect(getCurrencyDecimals("TWD")).toBe(0);
      expect(getCurrencyDecimals("JPY")).toBe(0);
      expect(getCurrencyDecimals("KRW")).toBe(0);
    });

    it("returns 2 for USD, MYR, SGD", () => {
      expect(getCurrencyDecimals("USD")).toBe(2);
      expect(getCurrencyDecimals("MYR")).toBe(2);
      expect(getCurrencyDecimals("SGD")).toBe(2);
    });
  });

  describe("getCurrencySymbol & getCurrencyAffix", () => {
    it("retrieves symbol and affix position correctly", () => {
      const vn = getCurrencyAffix("VND", "vi-VN");
      expect(vn.symbol).toContain("₫");
      expect(vn.position).toBe("suffix");

      const tw = getCurrencyAffix("TWD", "zh-TW");
      expect(tw.symbol).toBeTruthy();
      expect(tw.position).toBe("prefix");

      const us = getCurrencyAffix("USD", "en-US");
      expect(us.symbol).toBe("$");
      expect(us.position).toBe("prefix");
    });
  });

  describe("parseLocaleNumber", () => {
    it("returns null for empty, null, undefined or whitespace", () => {
      expect(parseLocaleNumber("")).toBeNull();
      expect(parseLocaleNumber("   ")).toBeNull();
      expect(parseLocaleNumber(null)).toBeNull();
      expect(parseLocaleNumber(undefined)).toBeNull();
    });

    it("parses zero-decimal currency VND in vi-VN with dot separators", () => {
      expect(parseLocaleNumber("1.000.000", "vi-VN", 0)).toBe(1000000);
      expect(parseLocaleNumber("50.000", "vi-VN", 0)).toBe(50000);
      expect(parseLocaleNumber("250", "vi-VN", 0)).toBe(250);
    });

    it("parses zero-decimal currency VND even if user pasted comma separators", () => {
      expect(parseLocaleNumber("1,000,000", "vi-VN", 0)).toBe(1000000);
    });

    it("parses TWD in zh-TW", () => {
      expect(parseLocaleNumber("1,000", "zh-TW", 0)).toBe(1000);
      expect(parseLocaleNumber("500", "zh-TW", 0)).toBe(500);
      expect(parseLocaleNumber("10,000,000", "zh-TW", 0)).toBe(10000000);
    });

    it("parses decimal currency USD in en-US", () => {
      expect(parseLocaleNumber("1,234.56", "en-US", 2)).toBe(1234.56);
      expect(parseLocaleNumber("1234.5", "en-US", 2)).toBe(1234.5);
      expect(parseLocaleNumber("99", "en-US", 2)).toBe(99);
    });

    it("parses decimal currency in vi-VN with comma decimal", () => {
      expect(parseLocaleNumber("1.234,56", "vi-VN", 2)).toBe(1234.56);
    });

    it("handles keypad dot fallback in vi-VN when comma decimal is expected", () => {
      expect(parseLocaleNumber("12.50", "vi-VN", 2)).toBe(12.5);
      expect(parseLocaleNumber("100.5", "vi-VN", 2)).toBe(100.5);
    });

    it("handles negative numbers if present", () => {
      expect(parseLocaleNumber("-500", "en-US", 0)).toBe(-500);
    });
  });

  describe("formatLocaleNumber", () => {
    it("returns empty string for null or undefined", () => {
      expect(formatLocaleNumber(null)).toBe("");
      expect(formatLocaleNumber(undefined)).toBe("");
    });

    it("formats VND without decimals and with dots in vi-VN", () => {
      const res = formatLocaleNumber(1000000, "vi-VN", { minDecimals: 0, maxDecimals: 0 });
      expect(res).toBe("1.000.000");
    });

    it("formats TWD with commas in zh-TW", () => {
      const res = formatLocaleNumber(50000, "zh-TW", { minDecimals: 0, maxDecimals: 0 });
      expect(res).toBe("50,000");
    });

    it("formats USD with decimals in en-US", () => {
      const res = formatLocaleNumber(1234.56, "en-US", { minDecimals: 2, maxDecimals: 2 });
      expect(res).toBe("1,234.56");
    });
  });

  describe("formatLiveCurrency", () => {
    it("formats 1 -> 1 in vi-VN", () => {
      const res = formatLiveCurrency("1", ".", ",", 0);
      expect(res.display).toBe("1");
      expect(res.value).toBe(1);
    });

    it("formats 1000 -> 1.000 in vi-VN", () => {
      const res = formatLiveCurrency("1000", ".", ",", 0);
      expect(res.display).toBe("1.000");
      expect(res.value).toBe(1000);
    });

    it("formats 1000000 -> 1.000.000 in vi-VN", () => {
      const res = formatLiveCurrency("1000000", ".", ",", 0);
      expect(res.display).toBe("1.000.000");
      expect(res.value).toBe(1000000);
    });

    it("formats 1000000 -> 1,000,000 in en-US / zh-TW", () => {
      const res = formatLiveCurrency("1000000", ",", ".", 0);
      expect(res.display).toBe("1,000,000");
      expect(res.value).toBe(1000000);
    });

    it("handles zero correctly without turning empty to 0", () => {
      const emptyRes = formatLiveCurrency("", ".", ",", 0);
      expect(emptyRes.display).toBe("");
      expect(emptyRes.value).toBeNull();

      const zeroRes = formatLiveCurrency("0", ".", ",", 0);
      expect(zeroRes.display).toBe("0");
      expect(zeroRes.value).toBe(0);

      const leadingZeroRes = formatLiveCurrency("05", ".", ",", 0);
      expect(leadingZeroRes.display).toBe("5");
      expect(leadingZeroRes.value).toBe(5);
    });

    it("handles pasted strings with existing separators and extra chars", () => {
      const pasted1 = formatLiveCurrency("1.000.000", ".", ",", 0);
      expect(pasted1.display).toBe("1.000.000");
      expect(pasted1.value).toBe(1000000);

      const pasted2 = formatLiveCurrency("1,000,000", ".", ",", 0);
      expect(pasted2.display).toBe("1.000.000");
      expect(pasted2.value).toBe(1000000);

      const dirty = formatLiveCurrency("abc 50.000 vnd", ".", ",", 0);
      expect(dirty.display).toBe("50.000");
      expect(dirty.value).toBe(50000);
    });

    it("handles decimal currency live typing in en-US", () => {
      const typing1 = formatLiveCurrency("1234.56", ",", ".", 2);
      expect(typing1.display).toBe("1,234.56");
      expect(typing1.value).toBe(1234.56);

      const trailingDot = formatLiveCurrency("1234.", ",", ".", 2);
      expect(trailingDot.display).toBe("1,234.");
      expect(trailingDot.value).toBe(1234);
    });
  });

  describe("findCursorPosition", () => {
    it("places cursor correctly when typing at end of number", () => {
      // User typed "0" at end of "100" -> raw "1000" (4 digits) -> formatted "1.000"
      const pos = findCursorPosition("1.000", 4, ",", false);
      expect(pos).toBe(5);
    });

    it("places cursor correctly when typing in the middle of number", () => {
      // User typed "2" after "1" in "1.000" -> raw "12.000" (2 digits before cursor) -> formatted "12.000"
      const pos = findCursorPosition("12.000", 2, ",", false);
      expect(pos).toBe(2);
    });
  });
});

