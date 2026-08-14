import { describe, expect, it } from "vitest";
import { formatOrderMoney } from "./formatOrderMoney";

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
