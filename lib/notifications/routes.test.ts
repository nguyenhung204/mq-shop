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
});
