import { beforeEach, describe, expect, it, vi } from "vitest";

const post = vi.fn();
vi.mock("@/lib/api/client", async (orig) => {
  const real = await orig<typeof import("@/lib/api/client")>();
  return {
    ...real,
    api: { post: (...a: unknown[]) => post(...a), get: vi.fn(), patch: vi.fn(), delete: vi.fn(), postForm: vi.fn() },
  };
});

import { orderApi } from "@/lib/api/orders";
import type { AuthUser } from "@/lib/api/types";
import { canSetSellerPartialRefund } from "@/lib/auth/admin-write";
import { approveVars, sendRmaDecision, submitApprove } from "./approve-flow";
import { refundDisplayEquivalent } from "./display-equivalent";

beforeEach(() => post.mockReset());

/** Seller path, from the typed text in the dialog to the JSON body of POST /rma/:id/approve. */
async function sellerPath(user: string[], typed: string, cap: number | null) {
  post.mockResolvedValue({});
  const canPartial = canSetSellerPartialRefund({ roles: user } as AuthUser);
  const res = await submitApprove({
    canPartial,
    amount: typed,
    cap,
    onConfirm: async (refundAmount) => {
      await sendRmaDecision(orderApi, approveVars("rma-1", refundAmount));
    },
  });
  return { res, calls: post.mock.calls };
}

describe("seller partial refund, dialog to request body (C1-3)", () => {
  it("a seller typing 250 sends the string 250.00 to the seller route", async () => {
    const { res, calls } = await sellerPath(["SELLER"], "250", 100000);
    expect(res.errorKey).toBeNull();
    expect(calls).toHaveLength(1);
    expect(calls[0]![0]).toBe("/rma/rma-1/approve");
    expect(JSON.parse(JSON.stringify(calls[0]![1]))).toEqual({ refundAmount: "250.00" });
  });
  it("keeps cents exactly, no float drift (0.10 + 0.20 style inputs, 16 digits)", async () => {
    for (const [typed, sent] of [["0.1", "0.10"], ["0.30", "0.30"], ["1234567.89", "1234567.89"], ["999999999999.99", "999999999999.99"]] as const) {
      post.mockClear();
      const { calls } = await sellerPath(["SELLER"], typed, 99999999999999);
      expect((calls[0]![1] as { refundAmount: string }).refundAmount, typed).toBe(sent);
    }
  });
  it("empty means refund what is left: no refundAmount in the body", async () => {
    const { calls } = await sellerPath(["SELLER"], "", 100000);
    expect("refundAmount" in (calls[0]![1] as object)).toBe(false);
  });
  it("same validation as the admin modal: zero, negative, 3 decimals, text and over the cap never reach the API", async () => {
    for (const [typed, key] of [
      ["0", "zero"],
      ["0.00", "zero"],
      ["-5", "invalid"],
      ["1.234", "invalid"],
      ["abc", "invalid"],
      ["1e2", "invalid"],
      ["1000.01", "exceeds"],
    ] as const) {
      post.mockClear();
      const { res, calls } = await sellerPath(["SELLER"], typed, 100000);
      expect(res.errorKey, typed).toBe(`admin.rmaPage.approveModal.errors.${key}`);
      expect(calls, typed).toHaveLength(0);
    }
  });
  it("the cap itself is accepted (<= remaining)", async () => {
    const { res, calls } = await sellerPath(["SELLER"], "1000.00", 100000);
    expect(res.errorKey).toBeNull();
    expect(calls).toHaveLength(1);
  });
  it("CS and WAREHOUSE (also combined with SELLER) have no field and never send an amount", async () => {
    for (const roles of [["CS"], ["WAREHOUSE"], ["SELLER", "CS"], ["SELLER", "WAREHOUSE"], ["SELLER", "ACCOUNTANT"], ["ACCOUNTANT"], ["BUYER"]]) {
      post.mockClear();
      const { calls } = await sellerPath(roles, "250", 100000);
      expect("refundAmount" in (calls[0]![1] as object), roles.join()).toBe(false);
    }
  });
});

describe("canSetSellerPartialRefund", () => {
  const can = (...roles: string[]) => canSetSellerPartialRefund({ roles } as AuthUser);
  it("matches the API gate", () => {
    expect(can("SELLER")).toBe(true);
    expect(can("BUYER", "SELLER")).toBe(true);
    expect(can("ADMIN")).toBe(true);
    expect(can("SUPER_ADMIN")).toBe(true);
    expect(can("ADMIN", "CS")).toBe(true);
    for (const r of [["CS"], ["WAREHOUSE"], ["ACCOUNTANT"], ["BUYER"], ["SELLER", "CS"], ["SELLER", "WAREHOUSE"], ["SELLER", "ACCOUNTANT"], []]) {
      expect(can(...r), r.join() || "none").toBe(false);
    }
    expect(canSetSellerPartialRefund(null)).toBe(false);
    expect(canSetSellerPartialRefund(undefined)).toBe(false);
  });
});

describe("refundDisplayEquivalent (display only)", () => {
  const order = { total: "1000.00", payableAmount: 31, payableCurrency: "SGD", fxRateLocked: 0.031 };
  it("full order total shows the stored payable amount exactly", () => {
    expect(refundDisplayEquivalent(order, 100000)).toBe("31.00 SGD");
    expect(refundDisplayEquivalent({ ...order, payableAmount: 30.99 }, 100000)).toBe("30.99 SGD");
  });
  it("a partial amount is converted at the locked rate and rounded to the cent", () => {
    expect(refundDisplayEquivalent(order, 25000)).toBe("7.75 SGD");
    expect(refundDisplayEquivalent(order, 1)).toBe("0.00 SGD");
  });
  it("is null without a display snapshot or for a TWD order or a non-positive amount", () => {
    expect(refundDisplayEquivalent({ total: 1000 }, 100)).toBeNull();
    expect(refundDisplayEquivalent({ ...order, payableCurrency: "TWD" }, 100)).toBeNull();
    expect(refundDisplayEquivalent({ ...order, fxRateLocked: null }, 25000)).toBeNull();
    expect(refundDisplayEquivalent(order, 0)).toBeNull();
    expect(refundDisplayEquivalent(order, -5)).toBeNull();
  });
});

describe("refundDisplayEquivalent rounding follows the server (integer math, half up)", () => {
  const o = (rate: number) => ({ total: "100000.00", payableAmount: 1, payableCurrency: "SGD", fxRateLocked: rate });
  it("rounds half up on exact integer products (floating point would not)", () => {
    // 100 cents x 1.005 = 100.5 -> 101; Math.round(100 * 1.005) is 100 because 100 * 1.005 = 100.49999999999999
    expect(refundDisplayEquivalent(o(1.005), 100)).toBe("1.01 SGD");
    // 1 cent x 0.5 = 0.5 -> 1
    expect(refundDisplayEquivalent(o(0.5), 1)).toBe("0.01 SGD");
    // 3 cents x 0.5 = 1.5 -> 2 (floor would give 1)
    expect(refundDisplayEquivalent(o(0.5), 3)).toBe("0.02 SGD");
  });
  it("just below and at the half cent", () => {
    // 16 x 0.031 = 0.496 -> 0 ; 17 x 0.031 = 0.527 -> 1
    expect(refundDisplayEquivalent(o(0.031), 16)).toBe("0.00 SGD");
    expect(refundDisplayEquivalent(o(0.031), 17)).toBe("0.01 SGD");
    // 1 x 0.0049 -> 0 ; 1 x 0.005 -> 0.005 -> 0 (not a half cent); 100 x 0.00495 = 0.495 -> 0 ; 100 x 0.005 = 0.5 -> 1
    expect(refundDisplayEquivalent(o(0.0049), 1)).toBe("0.00 SGD");
    expect(refundDisplayEquivalent(o(0.005), 100)).toBe("0.01 SGD");
    expect(refundDisplayEquivalent(o(0.00495), 100)).toBe("0.00 SGD");
  });
  it("large amounts stay exact", () => {
    // 99999999 cents x 0.031 = 3099999.969 -> 3100000
    expect(refundDisplayEquivalent(o(0.031), 99999999)).toBe("31000.00 SGD");
    expect(refundDisplayEquivalent(o(25000), 12345)).toBe("3086250.00 SGD");
  });
  it("an exponent-form rate is expanded, an unusable rate gives nothing", () => {
    expect(refundDisplayEquivalent(o(1e-7), 100_000_000_000)).toBe("100.00 SGD");
    expect(refundDisplayEquivalent(o(0), 100)).toBeNull();
    expect(refundDisplayEquivalent(o(Number.NaN), 100)).toBeNull();
    expect(refundDisplayEquivalent(o(-1), 100)).toBeNull();
  });
});
