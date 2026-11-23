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

describe("resolveNotificationRoute dividend notices (C5)", () => {
  const route = (type: string, roles: string[], meta: Record<string, string> = {}) =>
    resolveNotificationRoute({ type, meta } as never, { roles } as never);
  it("a credited dividend opens the line, or the list without meta; any signed-in role", () => {
    for (const r of [["BUYER"], ["SELLER"], ["ADMIN"]]) {
      expect(route("DIVIDEND_CREDITED", r, { itemId: "it-1", quarter: "2026Q4" })).toBe("/dividend-credits/it-1");
      expect(route("DIVIDEND_CREDITED", r)).toBe("/dividend-credits");
    }
  });
  it("a hostile item id is encoded", () => {
    expect(route("DIVIDEND_CREDITED", ["BUYER"], { itemId: "a/../b?x" })).toBe("/dividend-credits/a%2F..%2Fb%3Fx");
  });
  it("a failed settlement goes to finance staff only, to the quarter when known", () => {
    for (const r of ["ACCOUNTANT", "ADMIN", "SUPER_ADMIN"]) {
      expect(route("DIVIDEND_SETTLEMENT_FAILED", [r], { quarter: "2026Q4" }), r).toBe("/admin/dividend/settlements/2026Q4");
      expect(route("DIVIDEND_SETTLEMENT_FAILED", [r]), r).toBe("/admin/dividend/settlements");
    }
    for (const r of ["BUYER", "SELLER", "CS", "WAREHOUSE"]) expect(route("DIVIDEND_SETTLEMENT_FAILED", [r], { quarter: "2026Q4" }), r).toBeNull();
  });
});

describe("resolveNotificationRoute MLM admin routes", () => {
  it("ADMIN, SUPER_ADMIN and ACCOUNTANT can open /admin/mlm (page guard admits all three); others get no link", () => {
    for (const roles of [["ADMIN"], ["SUPER_ADMIN"], ["ACCOUNTANT"]] as const) {
      expect(resolveNotificationRoute({ type: "COMMISSION_JOB_FAILED" }, { roles: [...roles] })).toBe("/admin/mlm");
      expect(resolveNotificationRoute({ type: "MLM_REFERRAL_RATE_UPDATED" }, { roles: [...roles] })).toBe("/admin/mlm");
    }
    expect(resolveNotificationRoute({ type: "COMMISSION_JOB_FAILED" }, { roles: ["CS"] })).toBeNull();
  });
});
