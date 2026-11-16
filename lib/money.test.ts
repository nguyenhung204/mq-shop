import { describe, expect, it } from "vitest";
import {
  bpsToPercentString,
  centsToDecimalString,
  formatCentsDisplay,
  parseDecimalToCents,
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
