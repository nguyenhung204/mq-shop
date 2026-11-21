import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/client";
import type { RefundCaseEvent } from "@/lib/api/refund-cases";
import { getErrorMessage } from "@/lib/queries/utils";
import {
  EMPTY_ADMIN_FILTER,
  buildAdminQuery,
  canDo,
  eventText,
  formatCaseAmount,
  inclusiveDays,
  overrideTargets,
  partyEvents,
  refundCaseErrorKey,
  validateConfirm,
  validateDayRange,
  validateDispute,
  validateMarkPaid,
  validateNote,
  validateOverride,
  validateReference,
} from "./model";

const apiErr = (status: number, code: string, details?: unknown) =>
  new ApiError(status, code, { statusCode: status, message: code, data: { code, ...(details !== undefined ? { details } : {}) } } as never);

describe("validateNote", () => {
  it("optional: empty is fine and not sent; trims; 1000 ok, 1001 not", () => {
    expect(validateNote("   ", { required: false })).toEqual({ ok: true, value: undefined });
    expect(validateNote("  paid  ", { required: false })).toEqual({ ok: true, value: "paid" });
    expect(validateNote("x".repeat(1000), { required: false }).ok).toBe(true);
    expect(validateNote("x".repeat(1001), { required: false })).toEqual({ ok: false, error: "tooLong" });
  });
  it("required: 3..1000 after trim", () => {
    expect(validateNote("", { required: true })).toEqual({ ok: false, error: "required" });
    expect(validateNote("  ab ", { required: true })).toEqual({ ok: false, error: "tooShort" });
    expect(validateNote("abc", { required: true })).toEqual({ ok: true, value: "abc" });
    expect(validateNote("x".repeat(1000), { required: true }).ok).toBe(true);
    expect(validateNote("x".repeat(1001), { required: true })).toEqual({ ok: false, error: "tooLong" });
  });
  it("a NUL byte is refused like the API does", () => {
    expect(validateNote("a\u0000b", { required: false })).toEqual({ ok: false, error: "invalid" });
    expect(validateNote("a\u0000b", { required: true })).toEqual({ ok: false, error: "invalid" });
    expect(validateReference("a\u0000")).toEqual({ ok: false, error: "invalid" });
  });
});

describe("validateReference", () => {
  it("120 characters at most, empty not sent", () => {
    expect(validateReference("")).toEqual({ ok: true, value: undefined });
    expect(validateReference(" TX-1 ")).toEqual({ ok: true, value: "TX-1" });
    expect(validateReference("r".repeat(120)).ok).toBe(true);
    expect(validateReference("r".repeat(121))).toEqual({ ok: false, error: "tooLong" });
  });
});

describe("action forms", () => {
  it("mark paid: omits empty fields", () => {
    expect(validateMarkPaid({ note: "", reference: "" })).toEqual({ ok: true, body: {} });
    expect(validateMarkPaid({ note: "sent", reference: "TX9" })).toEqual({ ok: true, body: { note: "sent", reference: "TX9" } });
    expect(validateMarkPaid({ note: "x".repeat(1001), reference: "r".repeat(121) })).toEqual({
      ok: false,
      errors: [
        { field: "note", code: "tooLong" },
        { field: "reference", code: "tooLong" },
      ],
    });
  });
  it("confirm: note optional", () => {
    expect(validateConfirm({ note: "" })).toEqual({ ok: true, body: {} });
    expect(validateConfirm({ note: "got it" })).toEqual({ ok: true, body: { note: "got it" } });
  });
  it("dispute: note is mandatory (3..1000)", () => {
    expect(validateDispute({ note: "" })).toEqual({ ok: false, errors: [{ field: "note", code: "required" }] });
    expect(validateDispute({ note: "no" })).toEqual({ ok: false, errors: [{ field: "note", code: "tooShort" }] });
    expect(validateDispute({ note: "Nothing arrived" })).toEqual({ ok: true, body: { note: "Nothing arrived" } });
  });
  it("override: a different target and a reason of 3..1000 (not 500)", () => {
    expect(validateOverride({ toStatus: "CLOSED", reason: "x".repeat(1000) }, "OPEN").ok).toBe(true);
    expect(validateOverride({ toStatus: "CLOSED", reason: "x".repeat(1001) }, "OPEN")).toEqual({
      ok: false,
      errors: [{ field: "reason", code: "tooLong" }],
    });
    expect(validateOverride({ toStatus: "CLOSED", reason: "" }, "OPEN")).toEqual({ ok: false, errors: [{ field: "reason", code: "required" }] });
    expect(validateOverride({ toStatus: "CLOSED", reason: "ab" }, "OPEN")).toEqual({ ok: false, errors: [{ field: "reason", code: "tooShort" }] });
    expect(validateOverride({ toStatus: "", reason: "valid reason" }, "OPEN")).toEqual({ ok: false, errors: [{ field: "toStatus", code: "required" }] });
    expect(validateOverride({ toStatus: "NOPE", reason: "valid reason" }, "OPEN")).toEqual({ ok: false, errors: [{ field: "toStatus", code: "required" }] });
    expect(validateOverride({ toStatus: "OPEN", reason: "valid reason" }, "OPEN")).toEqual({ ok: false, errors: [{ field: "toStatus", code: "same" }] });
    expect(validateOverride({ toStatus: "CLOSED", reason: "  Bank slip checked  " }, "OPEN")).toEqual({
      ok: true,
      body: { toStatus: "CLOSED", reason: "Bank slip checked" },
    });
  });
  it("override targets exclude the current status", () => {
    expect(overrideTargets("OPEN")).not.toContain("OPEN");
    expect(overrideTargets("OPEN")).toHaveLength(4);
  });
});

describe("canDo reads actions only", () => {
  it("never infers from anything else", () => {
    expect(canDo({ actions: ["CONFIRM"] }, "CONFIRM")).toBe(true);
    expect(canDo({ actions: ["CONFIRM"] }, "DISPUTE")).toBe(false);
    expect(canDo({ actions: [] }, "OVERRIDE")).toBe(false);
    expect(canDo({ actions: undefined as never }, "OVERRIDE")).toBe(false);
  });
});

const REASON = "Seller bank statement shows a transfer on the 5th, internal ticket 4411";
const ev = (kind: RefundCaseEvent["kind"], note: string | null = REASON): RefundCaseEvent => ({
  seq: 1,
  at: "2026-11-20T00:00:00Z",
  kind,
  actorRole: "ADMIN",
  onBehalfOf: null,
  from: "OPEN",
  to: "CLOSED",
  amount: null,
  note,
  reference: "INTERNAL-REF",
  actorId: "a1",
  actorName: "Ann Admin",
  actorEmail: "ann@x.test",
});

describe("override reason never reaches buyer or seller", () => {
  it("eventText hides the note of an override and of a support RMA sync from parties", () => {
    expect(eventText(ev("ADMIN_OVERRIDE"), "party")).toEqual({ type: "support" });
    expect(eventText(ev("RMA_SYNC"), "party")).toEqual({ type: "support" });
    expect(JSON.stringify(eventText(ev("ADMIN_OVERRIDE"), "party"))).not.toContain("4411");
  });
  it("other events keep their text for parties; staff see everything", () => {
    expect(eventText(ev("BUYER_DISPUTE", "Nothing arrived"), "party")).toEqual({ type: "text", note: "Nothing arrived", reference: "INTERNAL-REF" });
    expect(eventText(ev("ADMIN_OVERRIDE"), "staff")).toEqual({ type: "text", note: REASON, reference: "INTERNAL-REF" });
  });
  it("partyEvents strips note, reference and actor data of support events defensively", () => {
    const out = partyEvents([ev("ADMIN_OVERRIDE"), ev("BUYER_CONFIRM", "thanks")]);
    expect(out[0]).toMatchObject({ note: null, reference: null, actorId: undefined, actorName: undefined, actorEmail: undefined });
    expect(JSON.stringify(out[0])).not.toContain("4411");
    expect(out[1]!.note).toBe("thanks");
  });
});

describe("refundCaseErrorKey", () => {
  it("SELF_DEALING arrives as REFUND_CASE_INVALID_TRANSITION with details.reason", () => {
    expect(refundCaseErrorKey(apiErr(409, "REFUND_CASE_INVALID_TRANSITION", { reason: "SELF_DEALING" }))).toEqual({
      key: "refundCases.errors.selfDealing",
    });
  });
  it("DISPUTE_LIMIT carries max", () => {
    expect(refundCaseErrorKey(apiErr(409, "REFUND_CASE_INVALID_TRANSITION", { reason: "DISPUTE_LIMIT", max: 3 }))).toEqual({
      key: "refundCases.errors.disputeLimit",
      params: { max: "3" },
    });
    expect(refundCaseErrorKey(apiErr(409, "REFUND_CASE_INVALID_TRANSITION", { reason: "DISPUTE_LIMIT" }))?.params).toEqual({ max: "3" });
  });
  it("a plain transition conflict and the other codes", () => {
    expect(refundCaseErrorKey(apiErr(409, "REFUND_CASE_INVALID_TRANSITION", { status: "CLOSED" }))?.key).toBe("refundCases.errors.invalidTransition");
    expect(refundCaseErrorKey(apiErr(409, "REFUND_CASE_INVALID_TRANSITION"))?.key).toBe("refundCases.errors.invalidTransition");
    expect(refundCaseErrorKey(apiErr(404, "REFUND_CASE_NOT_FOUND"))?.key).toBe("refundCases.errors.notFound");
    expect(refundCaseErrorKey(apiErr(400, "REFUND_CASE_INVALID"))?.key).toBe("refundCases.errors.invalid");
  });
  it("leaves unrelated errors (RMA codes, 500, plain Error) to the generic mapper", () => {
    expect(refundCaseErrorKey(apiErr(409, "RMA_NOT_PENDING"))).toBeNull();
    expect(refundCaseErrorKey(apiErr(500, "INTERNAL_SERVER_ERROR"))).toBeNull();
    expect(refundCaseErrorKey(apiErr(409, "SOMETHING", { reason: "SELF_DEALING" }))).toBeNull();
    expect(refundCaseErrorKey(new Error("x"))).toBeNull();
  });
  it("getErrorMessage shows the localized text, never the code, in all three locales", () => {
    const self = apiErr(409, "REFUND_CASE_INVALID_TRANSITION", { reason: "SELF_DEALING" });
    const limit = apiErr(409, "REFUND_CASE_INVALID_TRANSITION", { reason: "DISPUTE_LIMIT", max: 3 });
    const plain = apiErr(409, "REFUND_CASE_INVALID_TRANSITION", { status: "CLOSED" });
    const texts = new Set<string>();
    for (const loc of ["en", "vi", "zh-TW"] as const) {
      for (const e of [self, limit, plain]) {
        const m = getErrorMessage(e, "fallback", loc);
        expect(m).not.toContain("REFUND_CASE");
        expect(m).not.toBe("fallback");
        expect(m).not.toMatch(/[{}]/);
        texts.add(m);
      }
    }
    expect(texts.size).toBe(9);
    expect(getErrorMessage(limit, "fallback", "en")).toContain("3");
    expect(getErrorMessage(self, "fallback", "en").toLowerCase()).toContain("owner");
  });
});

describe("day ranges", () => {
  it("counts inclusive days and rejects non-real days", () => {
    expect(inclusiveDays("2026-11-01", "2026-11-01")).toBe(1);
    expect(inclusiveDays("2026-11-01", "2026-11-30")).toBe(30);
    expect(inclusiveDays("2026-02-30", "2026-03-05")).toBeNull();
    expect(inclusiveDays("2026-13-01", "2026-03-05")).toBeNull();
    expect(inclusiveDays("x", "2026-03-05")).toBeNull();
  });
  it("366 days is allowed, 367 is not (leap year span included)", () => {
    expect(validateDayRange("2025-01-01", "2025-12-31", { required: true })).toEqual([]);
    expect(validateDayRange("2024-01-01", "2024-12-31", { required: true })).toEqual([]); // 366 days
    expect(validateDayRange("2024-01-01", "2025-01-01", { required: true })).toEqual(["rangeTooLong"]); // 367 days
    expect(validateDayRange("2025-01-01", "2026-01-01", { required: true })).toEqual([]); // 366 inclusive days
    expect(validateDayRange("2025-01-01", "2026-01-02", { required: true })).toEqual(["rangeTooLong"]); // 367
  });
  it("from after to, and missing sides when required", () => {
    expect(validateDayRange("2026-11-05", "2026-11-01", { required: true })).toEqual(["rangeOrder"]);
    // reversed by exactly one day (zero days between) is still reversed
    expect(validateDayRange("2026-11-05", "2026-11-04", { required: true })).toEqual(["rangeOrder"]);
    expect(validateDayRange("2026-11-05", "2026-11-05", { required: true })).toEqual([]);
    expect(validateDayRange("", "", { required: true })).toEqual(["badFrom", "badTo"]);
    expect(validateDayRange("2026-11-01", "", { required: true })).toEqual(["badTo"]);
    expect(validateDayRange("", "", { required: false })).toEqual([]);
    expect(validateDayRange("2026-02-30", "2026-03-01", { required: false })).toEqual(["badFrom"]);
  });
});

describe("buildAdminQuery", () => {
  it("empty filter = no query params", () => {
    expect(buildAdminQuery(EMPTY_ADMIN_FILTER)).toEqual({ ok: true, query: {} });
  });
  it("statuses in canonical order as a comma list; overdue, kind, source, dates", () => {
    const r = buildAdminQuery({
      ...EMPTY_ADMIN_FILTER,
      statuses: ["CLOSED", "OPEN"],
      overdueOnly: true,
      kind: "partial",
      source: "RMA",
      from: "2026-11-01",
      to: "2026-11-30",
      orderCode: " ORD-1 ",
    });
    expect(r).toEqual({
      ok: true,
      query: { status: "OPEN,CLOSED", overdue: "true", kind: "partial", source: "RMA", from: "2026-11-01", to: "2026-11-30", orderCode: "ORD-1" },
    });
  });
  it("shop id must be a uuid and is lowercased; bad dates block the request", () => {
    expect(buildAdminQuery({ ...EMPTY_ADMIN_FILTER, shopId: "123" })).toEqual({ ok: false, errors: ["badShop"] });
    const id = "ABCDEF12-0000-4000-8000-000000000001";
    expect(buildAdminQuery({ ...EMPTY_ADMIN_FILTER, shopId: id })).toEqual({ ok: true, query: { shopId: id.toLowerCase() } });
    expect(buildAdminQuery({ ...EMPTY_ADMIN_FILTER, from: "2026-02-31" })).toEqual({ ok: false, errors: ["badFrom"] });
  });
});

describe("formatCaseAmount", () => {
  it("formats decimal strings by integer split and refuses malformed amounts", () => {
    expect(formatCaseAmount("250.5", "TWD")).toBe("250.50 TWD");
    expect(formatCaseAmount("0.10", "TWD")).toBe("0.10 TWD");
    expect(formatCaseAmount("1.234", "TWD")).toBe("—");
    expect(formatCaseAmount(null, "TWD")).toBe("—");
  });
});
