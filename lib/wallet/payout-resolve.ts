import type { PayoutRequestStatus } from "@/lib/api/wallet";

export type ResolveOutcome = "COMPLETED" | "FAILED";

export type ResolveFormError = "gatewayRefRequired" | "gatewayRefTooLong" | "noteInvalid";

export const RESOLVE_NOTE_MIN = 3;
export const RESOLVE_NOTE_MAX = 500;
export const RESOLVE_GATEWAY_REF_MAX = 128;

/** Statuses an admin can still manually resolve. */
export function canResolvePayoutStatus(status: PayoutRequestStatus): boolean {
  return status === "PROCESSING" || status === "PAID_UNRECONCILED";
}

/**
 * Client-side mirror of the API rules: note 3-500, gatewayRef <= 128 and
 * required when completing a PROCESSING payout (PAID_UNRECONCILED already has one).
 */
export function validateResolveForm(input: {
  status: PayoutRequestStatus;
  outcome: ResolveOutcome;
  gatewayRef: string;
  note: string;
}): ResolveFormError | null {
  const note = input.note.trim();
  if (note.length < RESOLVE_NOTE_MIN || note.length > RESOLVE_NOTE_MAX) return "noteInvalid";
  const ref = input.gatewayRef.trim();
  if (ref.length > RESOLVE_GATEWAY_REF_MAX) return "gatewayRefTooLong";
  if (input.outcome === "COMPLETED" && input.status === "PROCESSING" && !ref) {
    return "gatewayRefRequired";
  }
  return null;
}

export type ProcessResultKind =
  | "success"
  | "unreconciled"
  | "processing"
  | "failed"
  | "resolvedElsewhere";

/**
 * How to report a `process` response (HTTP 200 in all cases): only a clean
 * COMPLETED is a success. The message is checked first because the race guard
 * ("paid by the gateway but had already been resolved manually") returns the
 * manually-resolved row, whose status is COMPLETED or PAY_FAILED.
 */
export function processResultKind(
  status: PayoutRequestStatus | undefined,
  message?: string | null,
): ProcessResultKind {
  if (/already been resolved/i.test(message ?? "")) return "resolvedElsewhere";
  if (status === "PAID_UNRECONCILED") return "unreconciled";
  if (status === "PROCESSING") return "processing";
  if (status === "PAY_FAILED") return "failed";
  return "success";
}
