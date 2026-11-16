import { validateReason, type ReasonError } from "@/lib/admin/reason";
import type { SystemSetting } from "@/lib/api/settings";

export type SettingEditInput = {
  /** Raw text of the integer field. */
  raw: string;
  /** "Clear the value" (only offered when the setting is nullable). */
  clear: boolean;
  reason: string;
};

export type SettingEditError =
  | { field: "value"; code: "required" | "notInteger" | "belowMin" | "aboveMax" | "notNullable" }
  | { field: "reason"; code: ReasonError };

export type SettingEditResult =
  | { ok: true; body: { value: number | null; reason: string } }
  | { ok: false; errors: SettingEditError[] };

const INT_RE = /^\d{1,9}$/;

/** Client-side mirror of the registry rules (integer within min..max, null only if nullable, reason 3..500). */
export function validateSettingEdit(def: SystemSetting, input: SettingEditInput): SettingEditResult {
  const errors: SettingEditError[] = [];
  let value: number | null = null;

  if (input.clear) {
    if (!def.nullable) errors.push({ field: "value", code: "notNullable" });
  } else if (input.raw.trim() === "") {
    errors.push({ field: "value", code: "required" });
  } else if (!INT_RE.test(input.raw.trim())) {
    errors.push({ field: "value", code: "notInteger" });
  } else {
    value = Number(input.raw.trim());
    if (value < def.min) errors.push({ field: "value", code: "belowMin" });
    else if (value > def.max) errors.push({ field: "value", code: "aboveMax" });
  }

  const reason = validateReason(input.reason);
  if (!reason.ok) errors.push({ field: "reason", code: reason.error });

  if (errors.length > 0 || !reason.ok) return { ok: false, errors };
  return { ok: true, body: { value, reason: reason.value } };
}
