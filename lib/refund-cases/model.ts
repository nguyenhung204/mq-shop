import { ApiError } from "@/lib/api/client";
import type {
  AdminRefundCaseQuery,
  RefundCaseAction,
  RefundCaseEvent,
  RefundCaseStatus,
  RefundCaseView,
} from "@/lib/api/refund-cases";
import { REFUND_CASE_STATUSES } from "@/lib/api/refund-cases";
import { gmt8DayStartIso } from "@/lib/i18n/gmt8-calendar";
import { centsToDecimalString, parseDecimalToCents } from "@/lib/money";

export const NOTE_MAX = 1000;
export const REFERENCE_MAX = 120;
export const NOTE_MIN_REQUIRED = 3;
/** Same ceiling as the API: a case-list or export window is at most 366 days. */
export const MAX_RANGE_DAYS = 366;

/** What the API refuses everywhere in a free-text field (NUL byte). */
function hasNul(s: string): boolean {
  return s.includes("\u0000");
}

export function canDo(c: Pick<RefundCaseView, "actions">, action: RefundCaseAction): boolean {
  return Array.isArray(c.actions) && c.actions.includes(action);
}

/**
 * The API lists OVERRIDE in `actions[]` for every staff reader, but the override route itself needs
 * ADMIN or SUPER_ADMIN (CS and ACCOUNTANT would get 403). The button needs both.
 */
export function canOverrideCase(
  user: { roles?: string[] } | null | undefined,
  c: Pick<RefundCaseView, "actions">,
): boolean {
  const staff = Boolean(user?.roles?.some((r) => r === "ADMIN" || r === "SUPER_ADMIN"));
  return staff && canDo(c, "OVERRIDE");
}

export type NoteError = "required" | "tooShort" | "tooLong" | "invalid";

/**
 * Free-text note. `required` notes (dispute, override reason) must have 3..1000 characters after trim;
 * optional notes (mark paid, confirm) may be empty and are then not sent.
 */
export function validateNote(
  raw: string,
  opts: { required: boolean },
): { ok: true; value: string | undefined } | { ok: false; error: NoteError } {
  const value = raw.trim();
  if (hasNul(value)) return { ok: false, error: "invalid" };
  if (value === "") return opts.required ? { ok: false, error: "required" } : { ok: true, value: undefined };
  if (value.length > NOTE_MAX) return { ok: false, error: "tooLong" };
  if (opts.required && value.length < NOTE_MIN_REQUIRED) return { ok: false, error: "tooShort" };
  return { ok: true, value };
}

export type ReferenceError = "tooLong" | "invalid";
export function validateReference(raw: string): { ok: true; value: string | undefined } | { ok: false; error: ReferenceError } {
  const value = raw.trim();
  if (hasNul(value)) return { ok: false, error: "invalid" };
  if (value === "") return { ok: true, value: undefined };
  if (value.length > REFERENCE_MAX) return { ok: false, error: "tooLong" };
  return { ok: true, value };
}

export type CaseFormError = { field: "note" | "reference" | "reason" | "toStatus"; code: string };

export function validateMarkPaid(input: { note: string; reference: string }):
  | { ok: true; body: { note?: string; reference?: string } }
  | { ok: false; errors: CaseFormError[] } {
  const note = validateNote(input.note, { required: false });
  const ref = validateReference(input.reference);
  const errors: CaseFormError[] = [];
  if (!note.ok) errors.push({ field: "note", code: note.error });
  if (!ref.ok) errors.push({ field: "reference", code: ref.error });
  if (errors.length > 0 || !note.ok || !ref.ok) return { ok: false, errors };
  return { ok: true, body: { ...(note.value !== undefined ? { note: note.value } : {}), ...(ref.value !== undefined ? { reference: ref.value } : {}) } };
}

export function validateConfirm(input: { note: string }):
  | { ok: true; body: { note?: string } }
  | { ok: false; errors: CaseFormError[] } {
  const note = validateNote(input.note, { required: false });
  if (!note.ok) return { ok: false, errors: [{ field: "note", code: note.error }] };
  return { ok: true, body: note.value !== undefined ? { note: note.value } : {} };
}

export function validateDispute(input: { note: string }):
  | { ok: true; body: { note: string } }
  | { ok: false; errors: CaseFormError[] } {
  const note = validateNote(input.note, { required: true });
  if (!note.ok || note.value === undefined) return { ok: false, errors: [{ field: "note", code: note.ok ? "required" : note.error }] };
  return { ok: true, body: { note: note.value } };
}

/** Admin override: a target status that differs from the current one and a mandatory reason (3..1000). */
export function validateOverride(
  input: { toStatus: string; reason: string },
  current: RefundCaseStatus,
):
  | { ok: true; body: { toStatus: RefundCaseStatus; reason: string } }
  | { ok: false; errors: CaseFormError[] } {
  const errors: CaseFormError[] = [];
  const target = REFUND_CASE_STATUSES.find((s) => s === input.toStatus);
  if (!target) errors.push({ field: "toStatus", code: "required" });
  else if (target === current) errors.push({ field: "toStatus", code: "same" });
  const reason = validateNote(input.reason, { required: true });
  if (!reason.ok) errors.push({ field: "reason", code: reason.error });
  if (errors.length > 0 || !target || !reason.ok || reason.value === undefined) return { ok: false, errors };
  return { ok: true, body: { toStatus: target, reason: reason.value } };
}

/** Targets offered by the override dialog: every status but the current one. The API stays authoritative (409). */
export function overrideTargets(current: RefundCaseStatus): RefundCaseStatus[] {
  return REFUND_CASE_STATUSES.filter((s) => s !== current);
}

/** Event kinds whose free text is internal to support: parties see a neutral line instead. */
const REDACTED_FOR_PARTIES: ReadonlySet<RefundCaseEvent["kind"]> = new Set(["ADMIN_OVERRIDE", "RMA_SYNC"]);

export type EventText =
  | { type: "support" }
  | { type: "text"; note: string | null; reference: string | null };

/**
 * What to show as the free text of an event. Buyer and seller never see the real reason of an admin
 * override (or of an RMA sync made by support): the note and reference of those events are ignored
 * and a fixed "Updated by support" line is shown instead. Staff see the real text.
 */
export function eventText(e: Pick<RefundCaseEvent, "kind" | "note" | "reference">, viewer: "party" | "staff"): EventText {
  if (viewer === "party" && REDACTED_FOR_PARTIES.has(e.kind)) return { type: "support" };
  return { type: "text", note: e.note, reference: e.reference };
}

/** Raw detail from the party route, defensively stripped of staff-only data and of support-only text. */
export function partyEvents(events: RefundCaseEvent[]): RefundCaseEvent[] {
  return events.map((e) =>
    REDACTED_FOR_PARTIES.has(e.kind) ? { ...e, note: null, reference: null, actorId: undefined, actorName: undefined, actorEmail: undefined } : e,
  );
}

function detailsOf(e: ApiError): { reason?: string; max?: number } | undefined {
  const d = (e.body?.data as { details?: unknown } | undefined)?.details;
  return d && typeof d === "object" ? (d as { reason?: string; max?: number }) : undefined;
}

/**
 * Translation key (and params) for refund-case failures; null = not ours, use the generic message.
 * SELF_DEALING and DISPUTE_LIMIT are NOT error codes: both arrive as 409 REFUND_CASE_INVALID_TRANSITION
 * with `details.reason`, so the reason is read first. The same 409 SELF_DEALING also comes from the
 * RMA confirm-completed route.
 */
export function refundCaseErrorKey(e: unknown): { key: string; params?: Record<string, string> } | null {
  if (!(e instanceof ApiError)) return null;
  if (e.status === 409 && e.code === "REFUND_CASE_INVALID_TRANSITION") {
    const d = detailsOf(e);
    if (d?.reason === "SELF_DEALING") return { key: "refundCases.errors.selfDealing" };
    if (d?.reason === "DISPUTE_LIMIT") {
      return { key: "refundCases.errors.disputeLimit", params: { max: String(typeof d.max === "number" ? d.max : 3) } };
    }
    return { key: "refundCases.errors.invalidTransition" };
  }
  if (e.code === "REFUND_CASE_NOT_FOUND" && e.status === 404) return { key: "refundCases.errors.notFound" };
  if (e.code === "REFUND_CASE_INVALID" && e.status === 400) return { key: "refundCases.errors.invalid" };
  return null;
}

/**
 * An RMA-sourced case that is OPEN and has no refund proof yet: the API withholds MARK_PAID until the
 * seller uploads the transfer proof on the return request (page hint, not a button).
 */
export function needsRefundProofFirst(c: Pick<RefundCaseView, "source" | "status" | "hasRefundProof">): boolean {
  return c.source === "RMA" && c.status === "OPEN" && c.hasRefundProof === false;
}

/**
 * Refund-case routes that run through the RMA answer 409 RMA_NOT_PENDING when the RMA is not in the
 * state the action needs: on mark-paid the refund proof is not uploaded yet; on override the RMA must
 * be escalated first. Scoped to these routes (the RMA pages have their own texts).
 */
export function caseRouteErrorKey(e: unknown, _route: "party" | "override"): { key: string; params?: Record<string, string> } | null {
  if (e instanceof ApiError && e.status === 409) {
    // missing refund proof keeps RMA_NOT_PENDING; "requires prior SLA escalation" has its own code
    if (e.code === "RMA_NOT_PENDING") return { key: "refundCases.errors.rmaProofFirst" };
    if (e.code === "RMA_ESCALATION_REQUIRED") return { key: "refundCases.errors.rmaEscalateFirst" };
  }
  return refundCaseErrorKey(e);
}

/** "partial" vs "full" label key. */
export const caseKindKey = (c: Pick<RefundCaseView, "isPartial">) => (c.isPartial ? "refundCases.kind.partial" : "refundCases.kind.full");

/** Decimal string of a case amount in cents, null when malformed (never shows a wrong amount). */
export function amountCents(amount: string | null | undefined): number | null {
  return amount == null ? null : parseDecimalToCents(amount);
}

export function formatCaseAmount(amount: string | null | undefined, currency: string): string {
  const c = amountCents(amount);
  if (c === null) return "—";
  return currency ? `${centsToDecimalString(c)} ${currency}` : centsToDecimalString(c);
}

// ---- admin filters ----------------------------------------------------------------------------

export type AdminFilterState = {
  statuses: RefundCaseStatus[];
  source: "" | "CANCEL" | "RMA";
  shopId: string;
  from: string;
  to: string;
  overdueOnly: boolean;
  kind: "" | "partial" | "full";
  orderCode: string;
};

export const EMPTY_ADMIN_FILTER: AdminFilterState = {
  statuses: [],
  source: "",
  shopId: "",
  from: "",
  to: "",
  overdueOnly: false,
  kind: "",
  orderCode: "",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: string) => UUID_RE.test(s.trim());

export type FilterError = "badFrom" | "badTo" | "rangeOrder" | "rangeTooLong" | "badShop";

const DAY_MS = 86_400_000;
const isRealDay = (d: string) => gmt8DayStartIso(d) !== "" && !Number.isNaN(Date.parse(gmt8DayStartIso(d))) && roundTrips(d);
function roundTrips(d: string): boolean {
  // gmt8DayStartIso rolls impossible days over (2026-02-30 -> 03-02): compare the calendar day back
  const iso = gmt8DayStartIso(d);
  const back = new Date(Date.parse(iso) + 8 * 3600_000).toISOString().slice(0, 10);
  return back === d.trim();
}

/** Days between two inclusive YYYY-MM-DD days (to - from + 1), null if either is not a real day. */
export function inclusiveDays(from: string, to: string): number | null {
  if (!isRealDay(from) || !isRealDay(to)) return null;
  return Math.round((Date.parse(gmt8DayStartIso(to)) - Date.parse(gmt8DayStartIso(from))) / DAY_MS) + 1;
}

/** Date window rules shared by the list filters and the export form (from/to real days, ordered, <= 366 days). */
export function validateDayRange(from: string, to: string, opts: { required: boolean }): FilterError[] {
  const errors: FilterError[] = [];
  const f = from.trim();
  const t = to.trim();
  if (f === "" && t === "") {
    if (opts.required) errors.push("badFrom", "badTo");
    return errors;
  }
  if (f !== "" && !isRealDay(f)) errors.push("badFrom");
  if (t !== "" && !isRealDay(t)) errors.push("badTo");
  if (opts.required && f === "") errors.push("badFrom");
  if (opts.required && t === "") errors.push("badTo");
  if (errors.length > 0) return errors;
  if (f !== "" && t !== "") {
    const n = inclusiveDays(f, t);
    if (n === null || n < 1) errors.push("rangeOrder");
    else if (n > MAX_RANGE_DAYS) errors.push("rangeTooLong");
  }
  return errors;
}

/** Query for GET /admin/refund-cases and /summary from the filter form. Errors block the request. */
export function buildAdminQuery(
  f: AdminFilterState,
): { ok: true; query: Omit<AdminRefundCaseQuery, "page" | "pageSize"> } | { ok: false; errors: FilterError[] } {
  const errors = validateDayRange(f.from, f.to, { required: false });
  if (f.shopId.trim() !== "" && !isUuid(f.shopId)) errors.push("badShop");
  if (errors.length > 0) return { ok: false, errors };
  const q: Omit<AdminRefundCaseQuery, "page" | "pageSize"> = {};
  if (f.statuses.length > 0) q.status = REFUND_CASE_STATUSES.filter((s) => f.statuses.includes(s)).join(",");
  if (f.source) q.source = f.source;
  if (f.shopId.trim()) q.shopId = f.shopId.trim().toLowerCase();
  if (f.from.trim()) q.from = f.from.trim();
  if (f.to.trim()) q.to = f.to.trim();
  if (f.overdueOnly) q.overdue = "true";
  if (f.kind) q.kind = f.kind;
  if (f.orderCode.trim()) q.orderCode = f.orderCode.trim();
  return { ok: true, query: q };
}
