import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/client";
import { remainingFromError, validateRefundAmount } from "./refund-amount";

describe("validateRefundAmount", () => {
  it("empty means refund everything left (nothing is sent)", () => {
    expect(validateRefundAmount("", 100000)).toEqual({ ok: true, refundAmount: undefined, partial: false });
    expect(validateRefundAmount("   ", null)).toEqual({ ok: true, refundAmount: undefined, partial: false });
  });
  it("normalises to 2 decimals and marks partial", () => {
    expect(validateRefundAmount("250", 100000)).toEqual({ ok: true, refundAmount: "250.00", partial: true });
    expect(validateRefundAmount("0.1", 100000)).toEqual({ ok: true, refundAmount: "0.10", partial: true });
  });
  it("the full remaining amount typed out is not partial", () => {
    expect(validateRefundAmount("1000", 100000)).toEqual({ ok: true, refundAmount: "1000.00", partial: false });
    expect(validateRefundAmount("1000.00", 100000)).toMatchObject({ partial: false });
  });
  it("compares in cents with no float error", () => {
    expect(validateRefundAmount("1000.01", 100000)).toEqual({ ok: false, error: "exceeds" });
    expect(validateRefundAmount("999.99", 100000)).toMatchObject({ ok: true, partial: true });
    // 0.1 + 0.2 style traps: 30 cents must equal 30 cents
    expect(validateRefundAmount("0.30", 30)).toMatchObject({ ok: true, partial: false });
  });
  it("rejects zero, negatives, 3 decimals, junk", () => {
    expect(validateRefundAmount("0", 100)).toEqual({ ok: false, error: "zero" });
    expect(validateRefundAmount("0.00", 100)).toEqual({ ok: false, error: "zero" });
    for (const bad of ["-5", "1.234", "1e2", "abc", "5,5", "NT$5", ".5"]) {
      expect(validateRefundAmount(bad, 100000), bad).toEqual({ ok: false, error: "invalid" });
    }
  });
  it("without a known cap only format is checked", () => {
    expect(validateRefundAmount("99999999", null)).toMatchObject({ ok: true, partial: true });
  });
});

describe("remainingFromError", () => {
  const err = (details: unknown, code = "RMA_REFUND_AMOUNT_INVALID") =>
    new ApiError(400, "x", { message: "x", data: { code, details } } as never);
  it("derives the remaining cents from the 400 details", () => {
    const r = remainingFromError(err({ orderTotal: "1000.00", alreadyRefunded: "250.50", requested: "900" }));
    expect(r?.remainingCents).toBe(74950);
    expect(r?.details.requested).toBe("900");
  });
  it("ignores other errors and malformed details", () => {
    expect(remainingFromError(new Error("x"))).toBeNull();
    expect(remainingFromError(err({ orderTotal: "1000.00", alreadyRefunded: "250.50" }, "OTHER"))).toBeNull();
    expect(remainingFromError(err(undefined))).toBeNull();
    expect(remainingFromError(err({ orderTotal: "100.00", alreadyRefunded: "200.00" }))).toBeNull();
    expect(remainingFromError(err({ orderTotal: "abc", alreadyRefunded: "1" }))).toBeNull();
  });
});
