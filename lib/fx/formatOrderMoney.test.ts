import { describe, expect, it } from "vitest";
import { formatOrderLineMoney, formatOrderMoney } from "./formatOrderMoney";

describe("formatOrderMoney", () => {
  it("uses displayTotal for snapshot total", () => {
    const result = formatOrderMoney({
      total: 100,
      displayCurrency: "MYR",
      fxRate: 0.1269,
      displayTotal: 12.69,
    });
    expect(result.primary).toContain("12.69");
    expect(result.ledgerHint).toBeTruthy();
    expect(result.showCurrencySuffix).toBe(false);
  });

  it("falls back to total * fxRate when displayTotal missing", () => {
    const result = formatOrderMoney({
      total: 100,
      displayCurrency: "USD",
      fxRate: 0.031,
    });
    expect(result.primary).toContain("3.10");
    expect(result.ledgerHint).toBeTruthy();
  });

  it("legacy order without snapshot shows TWD only", () => {
    const result = formatOrderMoney({
      total: 500,
      currency: "TWD",
    });
    expect(result.primary).toContain("500");
    expect(result.ledgerHint).toBeNull();
    expect(result.showCurrencySuffix).toBe(true);
  });

  it("TWD snapshot shows TWD without FX conversion", () => {
    const result = formatOrderMoney({
      total: 200,
      displayCurrency: "TWD",
      fxRate: 1,
      displayTotal: 200,
    });
    expect(result.primary).toContain("200");
    expect(result.showCurrencySuffix).toBe(true);
  });
});

describe("formatOrderLineMoney", () => {
  it("uses the line total, not the order total (legacy TWD order)", () => {
    const line = formatOrderLineMoney({ currency: "TWD" }, 89.97);
    expect(line.primary).toContain("89.97");
    expect(line.primary).not.toContain("2,094.97");
  });

  it("converts the line total with the FX snapshot, ignoring displayTotal", () => {
    const line = formatOrderLineMoney(
      { displayCurrency: "USD", fxRate: 0.03, displayTotal: 62.85 },
      2000,
    );
    expect(line.primary).toContain("60.00");
    expect(line.ledgerHint).toContain("2,000");
  });
});

describe("formatOrderLineMoney with a full order object (M15 regression)", () => {
  it("TWD order: uses the line total even though the order has a different total", () => {
    const order = { total: 999, displayTotal: 99999, currency: "TWD" };
    const line = formatOrderLineMoney(order, 89.97);
    expect(line.primary).toContain("89.97");
    expect(line.primary).not.toContain("999");
  });

  it("FX snapshot order: converts the line total, never the order total/displayTotal", () => {
    const order = { total: 999, displayTotal: 99999, displayCurrency: "USD", fxRate: 0.03, currency: "TWD" };
    const a = formatOrderLineMoney(order, 2000);
    const b = formatOrderLineMoney(order, 100);
    expect(a.primary).toContain("60.00");
    expect(b.primary).toContain("3.00");
    expect(a.ledgerHint).toContain("2,000");
    expect(a.primary).not.toContain("99,999");
  });

  it("two lines of one order differ from each other", () => {
    const order = { total: 2094.97, currency: "TWD" };
    expect(formatOrderLineMoney(order, 89.97).primary).not.toBe(
      formatOrderLineMoney(order, 2000).primary,
    );
  });
});
