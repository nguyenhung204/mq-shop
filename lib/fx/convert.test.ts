import { describe, expect, it } from "vitest";
import { formatMoneyDisplay, formatMoneyForCurrency } from "./convert";

// Owner decision N2 (2026-11-23): TWD shows 2 decimals when the amount has cents, none when whole;
// rounding is half-up on the decimal ledger value (numeric(12,2)), never on the binary double.
const twd = (n: number) => formatMoneyForCurrency(n, "TWD", "en-US");

describe("formatMoneyForCurrency TWD", () => {
  it.each([
    [2350.5, "NT$2,350.50"],
    [2355.5, "NT$2,355.50"],
    [2350, "NT$2,350"],
    [0, "NT$0"],
    [0.01, "NT$0.01"],
    [0.1, "NT$0.10"],
    [1234.99, "NT$1,234.99"],
    [9999999999.99, "NT$9,999,999,999.99"],
    [9999999999, "NT$9,999,999,999"],
    [-2350.5, "-NT$2,350.50"],
    [-5, "-NT$5"],
  ])("%s -> %s", (n, want) => {
    expect(twd(n)).toBe(want);
  });

  it("rounds half-up on the decimal value, not on the double (x.005, x.995)", () => {
    expect(twd(0.005)).toBe("NT$0.01");
    expect(twd(1.005)).toBe("NT$1.01"); // double 1.005 is 1.00499999999999989...
    expect(twd(1234.995)).toBe("NT$1,235"); // rounds up to a whole amount: no cents shown
    expect(twd(2350.995)).toBe("NT$2,351");
    expect(twd(0.004)).toBe("NT$0");
    expect(twd(0.995)).toBe("NT$1");
    expect(twd(10.995)).toBe("NT$11");
    expect(twd(10.994)).toBe("NT$10.99");
    expect(twd(-1.005)).toBe("-NT$1.01");
  });

  it("grid 0.00 .. 20.00 step 0.01 prints the exact ledger text", () => {
    for (let c = 0; c <= 2000; c++) {
      const dec = `${Math.floor(c / 100)}.${String(c % 100).padStart(2, "0")}`;
      const shown = twd(Number(dec)).replace("NT$", "");
      const want = c % 100 === 0 ? String(c / 100) : dec;
      expect(shown).toBe(want);
    }
  });

  it("renders in vi and zh-TW with the locale separators", () => {
    expect(formatMoneyForCurrency(2350.5, "TWD", "vi-VN")).toBe("2.350,50 NT$");
    expect(formatMoneyForCurrency(2350, "TWD", "vi-VN")).toBe("2.350 NT$");
    expect(formatMoneyForCurrency(2350.5, "TWD", "zh-TW")).toBe("$2,350.50");
  });

  it("formatMoneyDisplay of a TWD region keeps the cents", () => {
    expect(formatMoneyDisplay(2355.5, "TWD", {}, "en-US")).toBe("NT$2,355.50");
  });
});

describe("formatMoneyForCurrency other currencies unchanged", () => {
  it("VND stays 0 decimals, USD/MYR/SGD 2", () => {
    expect(formatMoneyForCurrency(12345.6, "VND", "en-US")).toBe("₫12,346");
    expect(formatMoneyForCurrency(12.5, "USD", "en-US")).toBe("$12.50");
    expect(formatMoneyForCurrency(12, "MYR", "en-US")).toBe("MYR 12.00");
    expect(formatMoneyForCurrency(0.5, "SGD", "en-US")).toBe("SGD 0.50");
  });
});

describe("the other TWD formatters follow the same rule", () => {
  it("formatMoney / formatMoneyLocale / formatPrice show 2350.5 as 2,350.50 and 2350 as 2,350", async () => {
    const { formatMoney } = await import("@/lib/api/utils");
    const { formatMoneyLocale } = await import("@/lib/i18n/locale-format");
    const { formatPrice } = await import("@/lib/data/products");
    expect(formatMoney("2350.50")).toBe("NT$2,350.50");
    expect(formatMoney(2350)).toBe("NT$2,350");
    expect(formatMoney("abc")).toBe("NT$0");
    expect(formatMoneyLocale("2350.5", "en")).toBe("NT$2,350.50");
    expect(formatMoneyLocale(2350, "vi")).toBe("2.350 NT$");
    expect(formatPrice(2350.5)).toBe("NT$2,350.50");
  });
});

describe("formatMoneyForCurrency TWD edge values and formatDisplayMoney", () => {
  it("non-finite and tiny values do not throw and keep the TWD rule", () => {
    expect(formatMoneyForCurrency(Number.NaN, "TWD")).toBe("NT$0");
    expect(formatMoneyForCurrency(Number.POSITIVE_INFINITY, "TWD")).toBe("NT$0");
    expect(formatMoneyForCurrency(-0, "TWD")).toBe("NT$0");
    expect(formatMoneyForCurrency(1e-7, "TWD")).toBe("NT$0");
    expect(formatMoneyForCurrency(-0.004, "TWD")).toBe("NT$0"); // rounds to zero: no "-NT$0"
  });
  it("formatDisplayMoney shows TWD cents exactly (withdrawal rows)", async () => {
    const { formatDisplayMoney } = await import("@/lib/points");
    expect(formatDisplayMoney("2355.50", "TWD")).toBe("NT$2,355.50");
    expect(formatDisplayMoney(0.5, "TWD")).toBe("NT$0.50");
    expect(formatDisplayMoney(2350, "TWD")).toBe("NT$2,350");
  });
});
