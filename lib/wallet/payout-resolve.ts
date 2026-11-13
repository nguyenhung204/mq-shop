import type { PayoutRequestStatus } from "@/lib/api/wallet";

export type ResolveOutcome = "COMPLETED" | "FAILED";

export type ResolveFormError = "outcomeNotAllowed" | "gatewayRefRequired" | "gatewayRefTooLong" | "noteInvalid";

export const RESOLVE_NOTE_MIN = 3;
export const RESOLVE_NOTE_MAX = 500;
export const RESOLVE_GATEWAY_REF_MAX = 128;

/** Statuses an admin can still manually resolve. */
export function canResolvePayoutStatus(status: PayoutRequestStatus): boolean {
  return status === "PROCESSING" || status === "PAID_UNRECONCILED";
}

/**
 * Outcomes the API accepts: a payout the gateway already paid (PAID_UNRECONCILED
 * or any gatewayRef) can only be COMPLETED (FAILED -> 409 PAYOUT_PAID_CANNOT_FAIL).
 */
export function allowedResolveOutcomes(
  status: PayoutRequestStatus,
  gatewayRef?: string | null,
): ResolveOutcome[] {
  const paid = status === "PAID_UNRECONCILED" || Boolean(gatewayRef?.trim());
  return paid ? ["COMPLETED"] : ["COMPLETED", "FAILED"];
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
  /** gatewayRef already stored on the payout (satisfies the requirement). */
  payoutGatewayRef?: string | null;
}): ResolveFormError | null {
  const note = input.note.trim();
  if (note.length < RESOLVE_NOTE_MIN || note.length > RESOLVE_NOTE_MAX) return "noteInvalid";
  const ref = input.gatewayRef.trim();
  if (ref.length > RESOLVE_GATEWAY_REF_MAX) return "gatewayRefTooLong";
  if (
    input.outcome === "COMPLETED" &&
    input.status === "PROCESSING" &&
    !ref &&
    !input.payoutGatewayRef?.trim()
  ) {
    return "gatewayRefRequired";
  }
  return null;
}

export type ProcessResultKind =
  | "success"
  | "unreconciled"
  | "processing"
  | "failed"
  | "resolvedElsewhere"
  | "unknown";

/**
 * How to report a `process` response (HTTP 200 in all cases). Fails closed:
 * ONLY an explicit COMPLETED is a success; any other or missing status is not.
 * The message is checked first because the race guard ("paid by the gateway but
 * had already been resolved manually") returns the manually-resolved row,
 * whose status is COMPLETED or PAY_FAILED.
 */
export function processResultKind(
  status: PayoutRequestStatus | string | undefined | null,
  message?: string | null,
): ProcessResultKind {
  if (/already been resolved/i.test(message ?? "")) return "resolvedElsewhere";
  if (status === "PAID_UNRECONCILED") return "unreconciled";
  if (status === "PROCESSING") return "processing";
  if (status === "PAY_FAILED") return "failed";
  if (status === "COMPLETED") return "success";
  return "unknown";
}

export type ToastSpec = {
  level: "success" | "info" | "warning" | "error";
  key: string;
};

const PROCESS_TOASTS: Record<ProcessResultKind, ToastSpec> = {
  success: { level: "success", key: "toast.walletPayoutProcessed" },
  unreconciled: { level: "warning", key: "toast.walletPayoutUnreconciled" },
  resolvedElsewhere: { level: "warning", key: "toast.walletPayoutPaidAfterResolve" },
  processing: { level: "warning", key: "toast.walletPayoutStillProcessing" },
  failed: { level: "error", key: "toast.walletPayoutPayFailed" },
  unknown: { level: "warning", key: "toast.walletPayoutProcessUnknown" },
};

/** Toast for a `process` response: the normal "processed" success only for a clean COMPLETED. */
export function processToast(res: {
  data?: { status?: string | null } | null;
  message?: string | null;
} | null | undefined): ToastSpec {
  return PROCESS_TOASTS[processResultKind(res?.data?.status, res?.message)];
}

/** Toast for a `resolve` response: repeating the same outcome is an info "already resolved". */
export function resolveToast(res: { message?: string | null } | null | undefined): ToastSpec {
  return /already resolved/i.test(res?.message ?? "")
    ? { level: "info", key: "toast.walletPayoutAlreadyResolved" }
    : { level: "success", key: "toast.walletPayoutResolved" };
}

export type ResolveSubmit =
  | { ok: true; body: { outcome: ResolveOutcome; gatewayRef?: string; note: string } }
  | { ok: false; error: ResolveFormError };

/**
 * Everything the Resolve modal does on submit: refuse an outcome the API would
 * reject (FAILED on an already-paid payout), validate, and build the request body.
 */
export function prepareResolveSubmit(input: {
  status: PayoutRequestStatus;
  payoutGatewayRef?: string | null;
  outcome: ResolveOutcome;
  gatewayRef: string;
  note: string;
}): ResolveSubmit {
  if (!allowedResolveOutcomes(input.status, input.payoutGatewayRef).includes(input.outcome)) {
    return { ok: false, error: "outcomeNotAllowed" };
  }
  const error = validateResolveForm(input);
  if (error) return { ok: false, error };
  const ref = input.gatewayRef.trim();
  return {
    ok: true,
    body: {
      outcome: input.outcome,
      ...(ref ? { gatewayRef: ref } : {}),
      note: input.note.trim(),
    },
  };
}
