import { describe, expect, it } from "vitest";
import type { SlotHolding } from "@/lib/api/dividend";
import { quarterStartIso, validateSetSlots, validateTransfer, type SlotsContext } from "./slots-form";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const NOW = new Date("2026-11-16T10:00:00Z"); // 2026Q4

const holding = (userId: string, slots: number, expiresAt: string | null = null): SlotHolding => ({
  userId,
  email: null,
  fullName: null,
  slots,
  expiresAt,
  sinceQuarter: "2026Q3",
});
const ctx = (over: Partial<SlotsContext> = {}): SlotsContext => ({
  quarter: "2026Q4",
  locked: false,
  holdings: [holding(A, 5)],
  now: NOW,
  ...over,
});
const codes = (r: { ok: boolean; errors?: Array<{ field: string; code: string }> }) =>
  r.ok ? [] : r.errors!.map((e) => `${e.field}:${e.code}`);

describe("validateSetSlots", () => {
  const base = { userId: A, slots: "7", expiresAtLocal: "", reason: "Client approved" };
  it("builds the body (absolute slots, quarter, trimmed reason)", () => {
    expect(validateSetSlots({ ...base, reason: " ok then " }, ctx())).toEqual({
      ok: true,
      body: { userId: A, slots: 7, quarter: "2026Q4", reason: "ok then" },
    });
  });
  it("converts the expiry from Taipei wall clock to ISO", () => {
    const r = validateSetSlots({ ...base, expiresAtLocal: "2027-01-01T00:00" }, ctx());
    expect(r.ok && r.body.expiresAt).toBe("2026-12-31T16:00:00.000Z");
    expect(codes(validateSetSlots({ ...base, expiresAtLocal: "garbage" }, ctx()))).toEqual(["expiresAt:invalid"]);
  });
  it("UI3: a locked quarter can never validate", () => {
    expect(codes(validateSetSlots(base, ctx({ locked: true })))).toEqual(["quarter:locked"]);
  });
  it("future quarters are refused like the server", () => {
    expect(codes(validateSetSlots(base, ctx({ quarter: "2027Q1" })))).toEqual(["quarter:future"]);
    expect(validateSetSlots(base, ctx({ quarter: "2026Q3", holdings: [] })).ok).toBe(true);
  });
  it("slots must be an integer 0..1,000,000", () => {
    for (const [v, code] of [["", "required"], ["1.5", "notInteger"], ["-1", "notInteger"], ["1e3", "notInteger"], ["1000001", "tooHigh"]] as const) {
      expect(codes(validateSetSlots({ ...base, slots: v }, ctx())), v).toEqual([`slots:${code}`]);
    }
    expect(validateSetSlots({ ...base, slots: "0" }, ctx()).ok).toBe(true);
    expect(validateSetSlots({ ...base, slots: "1000000" }, ctx()).ok).toBe(true);
  });
  it("flags no-change like the server, but a new expiry is a change", () => {
    expect(codes(validateSetSlots({ ...base, slots: "5" }, ctx()))).toEqual(["slots:unchanged"]);
    expect(validateSetSlots({ ...base, slots: "5", expiresAtLocal: "2027-01-01T00:00" }, ctx()).ok).toBe(true);
    expect(codes(validateSetSlots({ ...base, slots: "0", userId: B }, ctx()))).toEqual(["slots:unchanged"]);
  });
  it("an expiry makes no sense with 0 slots", () => {
    expect(codes(validateSetSlots({ ...base, slots: "0", expiresAtLocal: "2027-01-01T00:00" }, ctx()))).toContain("expiresAt:withZero");
  });
  it("requires a real user id and a reason", () => {
    expect(codes(validateSetSlots({ ...base, userId: "" }, ctx()))).toEqual(["userId:required"]);
    expect(codes(validateSetSlots({ ...base, userId: "abc" }, ctx()))).toEqual(["userId:invalid"]);
    expect(codes(validateSetSlots({ ...base, reason: "  " }, ctx()))).toEqual(["reason:required"]);
  });
});

describe("validateTransfer", () => {
  const base = { fromUserId: A, toUserId: B, slots: "2", reason: "Merge accounts" };
  it("builds the two-account body", () => {
    expect(validateTransfer(base, ctx())).toEqual({
      ok: true,
      body: { fromUserId: A, toUserId: B, slots: 2, quarter: "2026Q4", reason: "Merge accounts" },
    });
  });
  it("transfers the entire balance but not more", () => {
    expect(validateTransfer({ ...base, slots: "5" }, ctx()).ok).toBe(true);
    expect(codes(validateTransfer({ ...base, slots: "6" }, ctx()))).toEqual(["slots:insufficient"]);
  });
  it("unknown source holds nothing", () => {
    expect(codes(validateTransfer({ ...base, fromUserId: B, toUserId: A }, ctx()))).toEqual(["slots:insufficient"]);
  });
  it("expiring slots move with their expiry: to an empty account or one with the same expiry; a different expiry is refused", () => {
    const E = "2027-03-01T00:00:00.000Z";
    expect(validateTransfer(base, ctx({ holdings: [holding(A, 5, E)] })).ok).toBe(true); // empty receiver
    expect(validateTransfer(base, ctx({ holdings: [holding(A, 5, E), holding(B, 3, E)] })).ok).toBe(true); // same expiry
    expect(codes(validateTransfer(base, ctx({ holdings: [holding(A, 5, E), holding(B, 3, "2027-06-01T00:00:00.000Z")] })))).toEqual(["toUserId:expiryMismatch"]);
    expect(codes(validateTransfer(base, ctx({ holdings: [holding(A, 5, E), holding(B, 3)] })))).toEqual(["toUserId:expiryMismatch"]); // receiver without expiry
    expect(codes(validateTransfer(base, ctx({ holdings: [holding(A, 5), holding(B, 3, E)] })))).toEqual(["toUserId:expiryMismatch"]); // moved slots without expiry
  });
  it("rejects same account, zero and locked quarter", () => {
    expect(codes(validateTransfer({ ...base, toUserId: A.toUpperCase() }, ctx()))).toEqual(["toUserId:same"]);
    expect(codes(validateTransfer({ ...base, slots: "0" }, ctx()))).toEqual(["slots:tooLow"]);
    expect(codes(validateTransfer(base, ctx({ locked: true })))).toEqual(["quarter:locked"]);
  });
  it("requires both accounts and a reason", () => {
    expect(codes(validateTransfer({ ...base, fromUserId: "", toUserId: "", reason: "" }, ctx()))).toEqual([
      "fromUserId:required",
      "toUserId:required",
      "reason:required",
    ]);
  });
});

describe("account id case (lowercase everywhere)", () => {
  // digits-only ids are unchanged by toUpperCase, so use ids with hex letters
  const LA = "abcdefab-1111-4111-8111-111111111111";
  const UP = LA.toUpperCase();
  const heldCtx = (slots: number, expiresAt: string | null = null) => ctx({ holdings: [holding(LA, slots, expiresAt)] });
  it("a pasted uppercase id still finds the holding and is sent lowercase", () => {
    expect(codes(validateTransfer({ fromUserId: UP, toUserId: B, slots: "9", reason: "Merge" }, heldCtx(5)))).toEqual(["slots:insufficient"]);
    const ok = validateTransfer({ fromUserId: UP, toUserId: B, slots: "5", reason: "Merge" }, heldCtx(5));
    expect(ok.ok && ok.body.fromUserId).toBe(LA);
    const toLA = "ABCDEFAC-1111-4111-8111-111111111111";
    const t2 = validateTransfer({ fromUserId: LA, toUserId: toLA, slots: "5", reason: "Merge" }, heldCtx(5));
    expect(t2.ok && t2.body.toUserId).toBe(toLA.toLowerCase());
    // an expiring holding found through an uppercase id moves to an empty receiver (it keeps its expiry)
    expect(validateTransfer({ fromUserId: UP, toUserId: B, slots: "2", reason: "Merge" }, heldCtx(5, "2027-03-01T00:00:00.000Z")).ok).toBe(true);
  });
  it("the unchanged guard works for an uppercase id and the body carries the lowercase id", () => {
    expect(codes(validateSetSlots({ userId: UP, slots: "5", expiresAtLocal: "", reason: "abc" }, heldCtx(5)))).toEqual(["slots:unchanged"]);
    const r = validateSetSlots({ userId: UP, slots: "6", expiresAtLocal: "", reason: "abc" }, heldCtx(5));
    expect(r.ok && r.body.userId).toBe(LA);
  });
  it("same account in different case is still the same account", () => {
    expect(codes(validateTransfer({ fromUserId: UP, toUserId: LA, slots: "1", reason: "Merge" }, heldCtx(5)))).toEqual(["toUserId:same"]);
  });
});

describe("expiry rules mirrored from the server", () => {
  const base = { userId: A, slots: "7", reason: "abc" };
  it("rejects impossible dates and times", () => {
    for (const bad of ["2026-02-30T10:00", "2026-11-16T25:61"]) {
      expect(codes(validateSetSlots({ ...base, expiresAtLocal: bad }, ctx())), bad).toEqual(["expiresAt:invalid"]);
    }
  });
  it("must be after the start of the quarter (Taipei midnight, exclusive)", () => {
    expect(codes(validateSetSlots({ ...base, expiresAtLocal: "2026-10-01T00:00" }, ctx()))).toEqual(["expiresAt:beforeQuarter"]);
    expect(codes(validateSetSlots({ ...base, expiresAtLocal: "2026-09-30T23:59" }, ctx()))).toEqual(["expiresAt:beforeQuarter"]);
    expect(validateSetSlots({ ...base, expiresAtLocal: "2026-10-01T00:01" }, ctx()).ok).toBe(true);
  });
  it("an expiry already in the past is not refused (the server does not refuse it either)", () => {
    const r = validateSetSlots({ ...base, expiresAtLocal: "2026-10-02T00:00" }, ctx({ now: new Date("2026-12-01T00:00:00Z") }));
    expect(r.ok).toBe(true);
  });
  it("quarterStartIso is Taipei midnight of the first day", () => {
    expect(quarterStartIso("2026Q4")).toBe("2026-09-30T16:00:00.000Z");
    expect(quarterStartIso("2026Q1")).toBe("2025-12-31T16:00:00.000Z");
  });
});
