import { describe, expect, it } from "vitest";
import { canCancelOrder } from "./orders";

describe("canCancelOrder (buyer/seller self-service)", () => {
  it("allows PENDING only", () => {
    expect(canCancelOrder("PENDING")).toBe(true);
    for (const s of ["PAID", "CONFIRMED", "PACKED", "SHIPPED", "DELIVERED", "CANCELLED"] as const) {
      expect(canCancelOrder(s)).toBe(false);
    }
  });
});
