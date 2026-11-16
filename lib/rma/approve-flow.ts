import { approveBody, decideApprove } from "@/lib/rma/refund-amount";

/**
 * The approve dialog's submit: validate, then hand the (possibly typed) amount to the caller.
 * Returns the error key when the amount is refused; otherwise calls `onConfirm(refundAmount)`.
 */
export async function submitApprove(args: {
  canPartial: boolean;
  amount: string;
  cap: number | null;
  onConfirm: (refundAmount: string | undefined) => void | Promise<void>;
}): Promise<{ errorKey: string | null }> {
  const res = decideApprove(args.canPartial, args.amount, args.cap);
  if (!res.ok) return { errorKey: res.errorKey };
  await args.onConfirm(res.refundAmount);
  return { errorKey: null };
}

export type RmaDecisionVars = {
  id: string;
  decision: "APPROVED" | "REJECTED";
  note?: string;
  /** Staff partial refund (2 dp string); omit for the full remaining amount. */
  refundAmount?: string;
};

/** Variables of the approve mutation started from the dialog. */
export function approveVars(rmaId: string, refundAmount: string | undefined): RmaDecisionVars {
  return { id: rmaId, decision: "APPROVED", refundAmount };
}

type DecisionApi = {
  approveRma: (id: string, body: { note?: string; refundAmount?: string }) => Promise<unknown>;
  rejectRma: (id: string, body: { note: string }) => Promise<unknown>;
};

/** What the decision mutation sends to the API. */
export function sendRmaDecision(api: DecisionApi, vars: RmaDecisionVars): Promise<unknown> {
  if (vars.decision === "APPROVED") return api.approveRma(vars.id, approveBody(vars.note, vars.refundAmount));
  return api.rejectRma(vars.id, { note: vars.note || "Rejected" });
}
