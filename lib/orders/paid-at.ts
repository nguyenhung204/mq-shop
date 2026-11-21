import { ApiError } from "@/lib/api/client";
import { validateReason, type ReasonError } from "@/lib/admin/reason";
import { gmt8DateTimeLocalToIso } from "@/lib/i18n/gmt8-calendar";

export type PaidAtError =
  | { field: "paidAt"; code: "required" | "invalidDate" | "future" | "beforeCreated" | "unchanged" }
  | { field: "reason"; code: ReasonError };

export type PaidAtEditResult =
  | { ok: true; body: { paidAt: string; reason: string } }
  | { ok: false; errors: PaidAtError[] };

/**
 * Client mirror of PATCH /admin/orders/:id/paid-at. The picker value is a GMT+8 wall clock; the body
 * carries an absolute instant with an explicit offset (the API refuses a date-only or offset-less
 * value). Impossible calendar dates (2026-02-30) are refused here instead of rolling over. The API
 * also refuses a future date and a date before the order was created, and guards locked quarters.
 */
export function validatePaidAtEdit(
  input: { local: string; reason: string },
  ctx: { nowMs: number; createdAt?: string | null; currentPaidAt?: string | null },
): PaidAtEditResult {
  const errors: PaidAtError[] = [];
  let paidAt = "";
  if (input.local.trim() === "") {
    errors.push({ field: "paidAt", code: "required" });
  } else {
    paidAt = gmt8DateTimeLocalToIso(input.local);
    const ms = Date.parse(paidAt);
    if (!paidAt || Number.isNaN(ms)) errors.push({ field: "paidAt", code: "invalidDate" });
    else if (ms > ctx.nowMs) errors.push({ field: "paidAt", code: "future" });
    else if (ctx.createdAt && ms < Date.parse(ctx.createdAt)) errors.push({ field: "paidAt", code: "beforeCreated" });
    else if (ctx.currentPaidAt && ms === Date.parse(ctx.currentPaidAt)) errors.push({ field: "paidAt", code: "unchanged" });
  }
  const reason = validateReason(input.reason);
  if (!reason.ok) errors.push({ field: "reason", code: reason.error });
  if (errors.length > 0 || !reason.ok) return { ok: false, errors };
  return { ok: true, body: { paidAt, reason: reason.value } };
}

/** Translation key for the failures the paid-at edit can return; null = use the generic message. */
export function paidAtErrorKey(e: unknown): string | null {
  if (!(e instanceof ApiError)) return null;
  if (e.status === 403) return "orders.paidAt.errors.forbidden";
  if (e.status === 409 && e.code === "DIVIDEND_QUARTER_LOCKED") return "orders.paidAt.errors.quarterLocked";
  if (e.status === 400 && e.code === "ORDER_PAID_AT_INVALID") return "orders.paidAt.errors.invalid";
  return null;
}
