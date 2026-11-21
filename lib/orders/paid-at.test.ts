import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/client";
import { canEditPaidAt, canReadPaidAtHistory } from "@/lib/auth/admin-write";
import type { AuthUser } from "@/lib/api/types";
import { paidAtErrorKey, validatePaidAtEdit } from "./paid-at";

const NOW = Date.parse("2026-11-20T12:00:00Z");
const ctx = { nowMs: NOW, createdAt: "2026-11-01T00:00:00Z", currentPaidAt: "2026-11-10T02:00:00Z" };
const run = (local: string, reason = "Proof shows 10 Nov", c = ctx) => validatePaidAtEdit({ local, reason }, c);
const codes = (r: ReturnType<typeof run>) => (r.ok ? [] : r.errors.map((e) => `${e.field}:${e.code}`));

describe("validatePaidAtEdit", () => {
  it("turns the GMT+8 wall clock into an absolute instant", () => {
    expect(run("2026-11-12T10:00")).toEqual({ ok: true, body: { paidAt: "2026-11-12T02:00:00.000Z", reason: "Proof shows 10 Nov" } });
    // 07:30 GMT+8 is the previous UTC day
    expect(run("2026-11-12T07:30")).toMatchObject({ ok: true, body: { paidAt: "2026-11-11T23:30:00.000Z" } });
  });
  it("the body paidAt always carries an explicit offset the API accepts", () => {
    const r = run("2026-11-12T10:00");
    expect(r.ok && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/.test(r.body.paidAt)).toBe(true);
  });
  it("refuses a calendar date that does not exist instead of rolling it over", () => {
    expect(codes(run("2026-02-30T10:00"))).toEqual(["paidAt:invalidDate"]);
    expect(codes(run("2026-04-31T10:00"))).toEqual(["paidAt:invalidDate"]);
    expect(codes(run("2025-02-29T10:00"))).toEqual(["paidAt:invalidDate"]);
    expect(codes(run("2026-13-01T10:00"))).toEqual(["paidAt:invalidDate"]);
    expect(codes(run("2026-11-10T25:00"))).toEqual(["paidAt:invalidDate"]);
    expect(codes(run("not a date"))).toEqual(["paidAt:invalidDate"]);
  });
  it("accepts 29 February of a leap year", () => {
    expect(run("2028-02-29T10:00", "abc", { ...ctx, nowMs: Date.parse("2028-03-01T00:00:00Z"), createdAt: "2028-01-01T00:00:00Z" }).ok).toBe(true);
  });
  it("requires a value", () => {
    expect(codes(run(""))).toEqual(["paidAt:required"]);
    expect(codes(run("   "))).toEqual(["paidAt:required"]);
  });
  it("refuses the future (boundary: now itself is allowed, one minute later is not)", () => {
    // NOW = 20:00 GMT+8
    expect(run("2026-11-20T20:00").ok).toBe(true);
    expect(codes(run("2026-11-20T20:01"))).toEqual(["paidAt:future"]);
  });
  it("refuses a date before the order was created (boundary at the creation minute)", () => {
    // createdAt 2026-11-01T00:00Z = 08:00 GMT+8
    expect(run("2026-11-01T08:00").ok).toBe(true);
    expect(codes(run("2026-11-01T07:59"))).toEqual(["paidAt:beforeCreated"]);
  });
  it("refuses the date the order already has", () => {
    expect(codes(run("2026-11-10T10:00"))).toEqual(["paidAt:unchanged"]);
  });
  it("needs a reason of 3..500 characters and trims it", () => {
    expect(codes(run("2026-11-12T10:00", ""))).toEqual(["reason:required"]);
    expect(codes(run("2026-11-12T10:00", "ab"))).toEqual(["reason:tooShort"]);
    expect(codes(run("2026-11-12T10:00", "x".repeat(501)))).toEqual(["reason:tooLong"]);
    expect(run("2026-11-12T10:00", "  abc  ")).toMatchObject({ ok: true, body: { reason: "abc" } });
    expect(run("2026-11-12T10:00", "x".repeat(500)).ok).toBe(true);
  });
  it("reports date and reason problems together", () => {
    expect(codes(run("", ""))).toEqual(["paidAt:required", "reason:required"]);
  });
});

const err = (status: number, code: string) =>
  new ApiError(status, code, { message: code, statusCode: status, data: { code } } as never);

describe("paidAtErrorKey", () => {
  it("maps the three documented failures", () => {
    expect(paidAtErrorKey(err(400, "ORDER_PAID_AT_INVALID"))).toBe("orders.paidAt.errors.invalid");
    expect(paidAtErrorKey(err(409, "DIVIDEND_QUARTER_LOCKED"))).toBe("orders.paidAt.errors.quarterLocked");
    expect(paidAtErrorKey(err(403, "FORBIDDEN"))).toBe("orders.paidAt.errors.forbidden");
  });
  it("does not claim other errors", () => {
    expect(paidAtErrorKey(err(500, "INTERNAL_SERVER_ERROR"))).toBeNull();
    expect(paidAtErrorKey(err(409, "SOMETHING_ELSE"))).toBeNull();
    expect(paidAtErrorKey(err(400, "VALIDATION_ERROR"))).toBeNull();
    expect(paidAtErrorKey(new Error("x"))).toBeNull();
  });
});

describe("paid-at access", () => {
  const u = (...roles: string[]) => ({ roles }) as AuthUser;
  it("only SUPER_ADMIN edits; ADMIN and SUPER_ADMIN read the history", () => {
    expect(canEditPaidAt(u("SUPER_ADMIN"))).toBe(true);
    for (const r of ["ADMIN", "CS", "ACCOUNTANT", "WAREHOUSE", "SELLER", "BUYER"]) expect(canEditPaidAt(u(r)), r).toBe(false);
    expect(canEditPaidAt(null)).toBe(false);
    expect(canReadPaidAtHistory(u("ADMIN"))).toBe(true);
    expect(canReadPaidAtHistory(u("SUPER_ADMIN"))).toBe(true);
    for (const r of ["CS", "ACCOUNTANT", "WAREHOUSE", "SELLER", "BUYER"]) expect(canReadPaidAtHistory(u(r)), r).toBe(false);
    expect(canReadPaidAtHistory(undefined)).toBe(false);
  });
});
