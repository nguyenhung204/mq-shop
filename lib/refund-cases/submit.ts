import type { RefundCaseStatus } from "@/lib/api/refund-cases";
import type { CaseActionVars } from "@/lib/queries/refund-cases";
import {
  validateConfirm,
  validateDispute,
  validateMarkPaid,
  validateOverride,
  type CaseFormError,
} from "./model";

export type CaseFormKind = "markPaid" | "confirm" | "dispute" | "override";

export type CaseFormInput = { note: string; reference: string; reason: string; toStatus: string };

export type OverrideVars = { id: string; toStatus: RefundCaseStatus; reason: string };

export type CaseSubmit =
  | { ok: true; kind: "override"; vars: OverrideVars }
  | { ok: true; kind: "markPaid" | "confirm" | "dispute"; vars: CaseActionVars }
  | { ok: false; errors: CaseFormError[] };

/** Validates the dialog and builds the exact variables the mutation hook sends (typed text -> request body). */
export function buildCaseSubmit(kind: CaseFormKind, id: string, input: CaseFormInput, current: RefundCaseStatus): CaseSubmit {
  switch (kind) {
    case "markPaid": {
      const r = validateMarkPaid(input);
      return r.ok ? { ok: true, kind, vars: { id, action: "markPaid", body: r.body } } : r;
    }
    case "confirm": {
      const r = validateConfirm(input);
      return r.ok ? { ok: true, kind, vars: { id, action: "confirm", body: r.body } } : r;
    }
    case "dispute": {
      const r = validateDispute(input);
      return r.ok ? { ok: true, kind, vars: { id, action: "dispute", body: r.body } } : r;
    }
    case "override": {
      const r = validateOverride(input, current);
      return r.ok ? { ok: true, kind, vars: { id, toStatus: r.body.toStatus, reason: r.body.reason } } : r;
    }
  }
}
