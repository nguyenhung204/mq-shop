export const REASON_MIN = 3;
export const REASON_MAX = 500;

export type ReasonError = "required" | "tooShort" | "tooLong";

/** Mirrors the server DTO: trimmed, 3..500 chars. Returns the trimmed value or an error code. */
export function validateReason(raw: string): { ok: true; value: string } | { ok: false; error: ReasonError } {
  const value = raw.trim();
  if (value.length === 0) return { ok: false, error: "required" };
  if (value.length < REASON_MIN) return { ok: false, error: "tooShort" };
  if (value.length > REASON_MAX) return { ok: false, error: "tooLong" };
  return { ok: true, value };
}
