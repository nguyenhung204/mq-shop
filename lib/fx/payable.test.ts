import { describe, expect, it } from "vitest";
import { formatOrderLineMoney, formatOrderMoney } from "./formatOrderMoney";
import { payableView } from "./payable";

const usdOrder = {
  total: 1000,
  currency: "TWD" as const,
  displayCurrency: "USD",
  fxRate: 0.031,
  displayTotal: 31,
  payableAmount: 31.5,
  payableCurrency: "USD",
  fxRateLocked: 0.0315,
};

describe("payableView (R4)", () => {
  it("shows payableAmount in payableCurrency, not the TWD total or a re-converted figure", () => {
    const v = payableView(usdOrder);
    expect(v.amount).toBe("$31.50");
    expect(v.currency).toBe("USD");
    expect(v.amount).not.toContain("1,000");
    expect(v.ledgerTwd).toBe("NT$1,000");
  });
  it("shows the rate locked at order time", () => {
    expect(payableView(usdOrder).lockedRate).toBe("1 TWD = 0.0315 USD");
    expect(payableView({ ...usdOrder, fxRateLocked: null }).lockedRate).toBeNull();
  });
  it("is stable when the live rate would differ (uses the order's own fields only)", () => {
    expect(payableView({ ...usdOrder, fxRate: 0.5, displayTotal: 500 }).amount).toBe("$31.50");
  });
  it("TWD orders: payable in TWD, no rate, no separate ledger hint", () => {
    const v = payableView({ total: 500, currency: "TWD", payableAmount: 500, payableCurrency: "TWD", fxRateLocked: null });
    expect(v.currency).toBe("TWD");
    expect(v.lockedRate).toBeNull();
    expect(v.ledgerTwd).toBeNull();
    expect(v.amount).toContain("500");
  });
  it("VND has no decimals", () => {
    const v = payableView({ total: 1000, currency: "TWD", payableAmount: 780000, payableCurrency: "VND", fxRateLocked: 780 });
    expect(v.amount).not.toContain(".");
    expect(v.lockedRate).toBe("1 TWD = 780 VND");
  });
  it("older API without payable fields falls back to the order snapshot", () => {
    const v = payableView({ total: 1000, currency: "TWD", displayCurrency: "USD", fxRate: 0.031, displayTotal: 31 });
    expect(v.amount).toBe("$31.00");
    expect(v.lockedRate).toBeNull();
  });
});

describe("formatOrderMoney with payable fields", () => {
  it("total uses payable", () => {
    expect(formatOrderMoney(usdOrder, "total").primary).toBe("$31.50");
  });
  it("subtotal / shipping are not replaced by the payable total", () => {
    const m = formatOrderMoney({ ...usdOrder, subtotal: 900, shippingFee: 100 }, "shippingFee");
    expect(m.primary).not.toBe("$31.50");
  });
  it("a line amount never reuses the order payable", () => {
    expect(formatOrderLineMoney(usdOrder, 200).primary).not.toBe("$31.50");
  });
});

describe("payableView TWD with a stray rate", () => {
  it("never shows a rate line for a TWD payable, even if fxRateLocked is set", () => {
    const v = payableView({ total: 500, currency: "TWD", payableAmount: 500, payableCurrency: "TWD", fxRateLocked: 1 });
    expect(v.lockedRate).toBeNull();
  });
});
