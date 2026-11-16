import { validateReason, type ReasonError } from "@/lib/admin/reason";
import { bpsToPercentString, parsePercentToBps } from "@/lib/money";
import { isRealDay, todayGmt8 } from "./dates";

export type RateFormInput = { ratePercent: string; effectiveDate: string; reason: string };

export type RateFormError =
  | { field: "ratePercent"; code: "required" | "invalid" }
  | { field: "effectiveDate"; code: "required" | "invalid" | "past" }
  | { field: "reason"; code: ReasonError };

export type RateFormResult =
  | { ok: true; body: { ratePercent: number; effectiveDate: string; reason: string }; bps: number }
  | { ok: false; errors: RateFormError[] };

/**
 * Client mirror of POST /admin/dividend/rates: percent 0..100 with at most 2 decimals,
 * a REQUIRED real calendar day that is not before today in Asia/Taipei, reason 3..500.
 * `ratePercent` is sent as a JSON number built from the exact 2-decimal string (no arithmetic).
 */
export function validateRateForm(input: RateFormInput, now: Date = new Date()): RateFormResult {
  const errors: RateFormError[] = [];

  const pct = input.ratePercent.trim();
  const bps = pct === "" ? null : parsePercentToBps(pct);
  if (pct === "") errors.push({ field: "ratePercent", code: "required" });
  else if (bps === null) errors.push({ field: "ratePercent", code: "invalid" });

  const date = input.effectiveDate.trim();
  if (date === "") errors.push({ field: "effectiveDate", code: "required" });
  else if (!isRealDay(date)) errors.push({ field: "effectiveDate", code: "invalid" });
  else if (date < todayGmt8(now)) errors.push({ field: "effectiveDate", code: "past" });

  const reason = validateReason(input.reason);
  if (!reason.ok) errors.push({ field: "reason", code: reason.error });

  if (errors.length > 0 || bps === null || !reason.ok) return { ok: false, errors };
  return {
    ok: true,
    bps,
    body: { ratePercent: Number(bpsToPercentString(bps)), effectiveDate: date, reason: reason.value },
  };
}
