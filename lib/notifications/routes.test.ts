import { describe, expect, it } from "vitest";
import { resolveNotificationRoute } from "./routes";

describe("resolveNotificationRoute proof retention", () => {
  it("routes to the order when meta has orderId", () => {
    expect(
      resolveNotificationRoute(
        {
          type: "ORDER_PROOF_RETENTION_WARNING",
          meta: { orderId: "order-1", milestone: "30" },
        },
        { roles: ["BUYER"] },
      ),
    ).toBe("/orders/order-1");
    expect(
      resolveNotificationRoute(
        {
          type: "ORDER_PROOF_PURGED",
          meta: { orderId: "order-1" },
        },
        { roles: ["SELLER"] },
      ),
    ).toBe("/orders/order-1");
  });

  it("routes RMA staff to admin RMA when rmaId is present", () => {
    expect(
      resolveNotificationRoute(
        {
          type: "ORDER_PROOF_PURGED",
          meta: { orderId: "order-1", rmaId: "rma-1" },
        },
        { roles: ["CS"] },
      ),
    ).toBe("/admin/rma/rma-1");
  });

  it("routes referral skip to commissions for sellers, not buyers-only", () => {
    expect(
      resolveNotificationRoute(
        {
          type: "COMMISSION_REFERRAL_SKIPPED_NOT_SELLER",
          meta: { orderId: "order-1" },
        },
        { roles: ["BUYER", "SELLER"] },
      ),
    ).toBe("/wallet/commissions");
    expect(
      resolveNotificationRoute(
        {
          type: "COMMISSION_REFERRAL_SKIPPED_NOT_SELLER",
          meta: { orderId: "order-1" },
        },
        { roles: ["BUYER"] },
      ),
    ).toBeNull();
  });
});

describe("resolveNotificationRoute stale bill reminder (R5)", () => {
  it("routes the seller to the order from meta.orderId", () => {
    expect(
      resolveNotificationRoute(
        { type: "ORDER_STALE_BILL_REMINDER", meta: { orderId: "order-9", shopId: "s1", orderCode: "ORD-9" } },
        { roles: ["SELLER"] },
      ),
    ).toBe("/orders/order-9");
  });
  it("falls back to the seller order list without meta, and to nothing for a buyer-only account", () => {
    expect(resolveNotificationRoute({ type: "ORDER_STALE_BILL_REMINDER", meta: {} }, { roles: ["SELLER"] })).toBe("/seller/orders");
    expect(resolveNotificationRoute({ type: "ORDER_STALE_BILL_REMINDER", meta: {} }, { roles: ["BUYER"] })).toBeNull();
  });
});

describe("resolveNotificationRoute refund case notices (C2)", () => {
  const route = (type: string, roles: string[], meta: Record<string, string> = {}) =>
    resolveNotificationRoute({ type, meta } as never, { roles } as never);
  it("the shop owner is sent to the seller refund list", () => {
    expect(route("REFUND_CASE_OPENED", ["SELLER"], { refundCaseId: "c1", shopId: "s1" })).toBe("/seller/refunds");
    expect(route("REFUND_CASE_OPENED", ["BUYER"], { refundCaseId: "c1" })).toBeNull();
  });
  it("the buyer is sent to the buyer refund list", () => {
    expect(route("REFUND_CASE_MARKED_PAID", ["BUYER"], { refundCaseId: "c1" })).toBe("/refunds");
  });
  it("platform ops open the case of a dispute, or the list without meta; others get nothing", () => {
    for (const r of ["ADMIN", "SUPER_ADMIN", "CS", "ACCOUNTANT"]) {
      expect(route("REFUND_CASE_DISPUTED", [r], { refundCaseId: "c-9" }), r).toBe("/admin/refund-cases/c-9");
      expect(route("REFUND_CASE_DISPUTED", [r]), r).toBe("/admin/refund-cases");
    }
    expect(route("REFUND_CASE_DISPUTED", ["BUYER"], { refundCaseId: "c-9" })).toBeNull();
    expect(route("REFUND_CASE_DISPUTED", ["SELLER"], { refundCaseId: "c-9" })).toBeNull();
  });
});
