import { describe, expect, it } from "vitest";
import { needsHandling } from "./needs-handling";

describe("needsHandling", () => {
  it("true only for an escalated bill on a still-PENDING order", () => {
    expect(needsHandling({ status: "PENDING", paymentEscalatedAt: "2026-11-16T00:00:00Z" })).toBe(true);
  });
  it("false when not escalated", () => {
    expect(needsHandling({ status: "PENDING", paymentEscalatedAt: null })).toBe(false);
    expect(needsHandling({ status: "PENDING" })).toBe(false);
  });
  it("false once the order moved on (paid, cancelled, ...)", () => {
    for (const status of ["PAID", "CANCELLED", "SHIPPED", "DELIVERED", "REFUNDED"] as const) {
      expect(needsHandling({ status, paymentEscalatedAt: "2026-11-16T00:00:00Z" }), status).toBe(false);
    }
  });
});
