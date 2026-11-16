import { ApiError } from "@/lib/api/client";
import { centsToDecimalString, parseDecimalToCents, toCents } from "@/lib/money";

export type RefundAmountError = "invalid" | "zero" | "exceeds";

export type RefundAmountResult =
  | { ok: true; /** undefined = refund everything that is left (no field is sent) */ refundAmount: string | undefined; partial: boolean }
  | { ok: false; error: RefundAmountError };

/**
 * Staff approve: empty input = full remaining refund (the API default).
 * A typed amount must be > 0, have at most 2 decimals and not exceed `maxCents`
 * (the remaining refundable amount when known, otherwise the order total).
 * The server is still authoritative: it also subtracts earlier partial refunds.
 * Everything is compared as integer cents.
 */
export function validateRefundAmount(input: string, maxCents: number | null): RefundAmountResult {
  const text = input.trim();
  if (text === "") return { ok: true, refundAmount: undefined, partial: false };
  const cents = parseDecimalToCents(text);
  if (cents === null) return { ok: false, error: "invalid" };
  if (cents <= 0) return { ok: false, error: "zero" };
  if (maxCents !== null && cents > maxCents) return { ok: false, error: "exceeds" };
  return { ok: true, refundAmount: centsToDecimalString(cents), partial: maxCents === null || cents < maxCents };
}

export type ApproveDecision =
  | { ok: true; refundAmount: string | undefined; partial: boolean }
  | { ok: false; errorKey: string };

/** Submit decision of the approve dialog: non-staff never send an amount; staff are validated first. */
export function decideApprove(canPartial: boolean, amount: string, maxCents: number | null): ApproveDecision {
  if (!canPartial) return { ok: true, refundAmount: undefined, partial: false };
  const res = validateRefundAmount(amount, maxCents);
  if (!res.ok) return { ok: false, errorKey: `admin.rmaPage.approveModal.errors.${res.error}` };
  return { ok: true, refundAmount: res.refundAmount, partial: res.partial };
}

/** Request body of the admin approve call: `refundAmount` is present only when staff typed one. */
export function approveBody(note: string | undefined, refundAmount: string | undefined) {
  return { note, ...(refundAmount !== undefined ? { refundAmount } : {}) };
}

export type RefundInvalidDetails = { orderTotal: string; alreadyRefunded: string; requested: string | null };

/** Remaining refundable cents from a 400 RMA_REFUND_AMOUNT_INVALID `details`, or null when absent. */
export function remainingFromError(e: unknown): { remainingCents: number; details: RefundInvalidDetails } | null {
  if (!(e instanceof ApiError) || e.code !== "RMA_REFUND_AMOUNT_INVALID") return null;
  const details = (e.body?.data as { details?: Partial<RefundInvalidDetails> } | undefined)?.details;
  if (!details) return null;
  const total = toCents(details.orderTotal ?? null);
  const prior = toCents(details.alreadyRefunded ?? null);
  if (total === null || prior === null || prior > total) return null;
  return {
    remainingCents: total - prior,
    details: { orderTotal: details.orderTotal!, alreadyRefunded: details.alreadyRefunded!, requested: details.requested ?? null },
  };
}
