import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/client";
import { approveBody, decideApprove, remainingFromError, validateRefundAmount } from "./refund-amount";

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

describe("fully refunded order", () => {
  const err = (details: unknown) => new ApiError(400, "x", { message: "x", data: { code: "RMA_REFUND_AMOUNT_INVALID", details } } as never);
  it("alreadyRefunded == orderTotal gives remaining 0 (cap 0), not 'unknown'", () => {
    const r = remainingFromError(err({ orderTotal: "500.00", alreadyRefunded: "500.00", requested: "1" }));
    expect(r?.remainingCents).toBe(0);
    expect(validateRefundAmount("0.01", r!.remainingCents)).toEqual({ ok: false, error: "exceeds" });
  });
});

describe("decideApprove and approveBody", () => {
  it("non-staff never send an amount, even if one is passed", () => {
    expect(decideApprove(false, "250", 100000)).toEqual({ ok: true, refundAmount: undefined, partial: false });
  });
  it("staff over the cap are blocked with the translated error key", () => {
    expect(decideApprove(true, "1000.01", 100000)).toEqual({ ok: false, errorKey: "admin.rmaPage.approveModal.errors.exceeds" });
    expect(decideApprove(true, "abc", 100000)).toEqual({ ok: false, errorKey: "admin.rmaPage.approveModal.errors.invalid" });
  });
  it("staff partial amount is normalised and flagged partial; empty means full", () => {
    expect(decideApprove(true, "250", 100000)).toEqual({ ok: true, refundAmount: "250.00", partial: true });
    expect(decideApprove(true, "", 100000)).toEqual({ ok: true, refundAmount: undefined, partial: false });
  });
  it("the typed amount reaches the request body; no amount means no field", () => {
    expect(approveBody("ok", "250.00")).toEqual({ note: "ok", refundAmount: "250.00" });
    expect("refundAmount" in approveBody("ok", undefined)).toBe(false);
  });
});
