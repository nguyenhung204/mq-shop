import { validateReason, type ReasonError } from "@/lib/admin/reason";
import type { SettingValue, SystemSetting } from "@/lib/api/settings";
import { SETTING_FROM_QUARTER, isValidQuarterCode, parseQuarterInput, quarterCodeLabel } from "@/lib/dividend/settlement";
import { centsToDecimalString, parseDecimalToCents } from "@/lib/money";

export type SettingEditInput = {
  /** Raw text of the integer / decimal field. */
  raw: string;
  /** "Clear the value" (only offered when the setting is nullable). */
  clear: boolean;
  reason: string;
  /** State of the switch of a bool setting. */
  flag?: boolean;
};

export type SettingEditError =
  | { field: "value"; code: "required" | "notInteger" | "notDecimal" | "notQuarter" | "belowMin" | "aboveMax" | "notNullable" }
  | { field: "reason"; code: ReasonError };

export type SettingEditResult =
  | { ok: true; body: { value: SettingValue; reason: string } }
  | { ok: false; errors: SettingEditError[] };

const INT_RE = /^\d{1,9}$/;
const DECIMAL_RE = /^\d{1,9}(?:\.\d{1,2})?$/;

export function settingKind(def: Pick<SystemSetting, "kind">): "int" | "bool" | "decimal" {
  return def.kind ?? "int";
}

/** Initial text of the value field: the stored number, or empty. Bool settings have no text field. */
export function initialSettingText(def: Pick<SystemSetting, "kind" | "value"> & { key?: string }): string {
  if (def.key === SETTING_FROM_QUARTER && typeof def.value === "number" && isValidQuarterCode(def.value)) {
    return `${Math.floor(def.value / 10)}Q${def.value % 10}`;
  }
  return typeof def.value === "number" ? String(def.value) : "";
}

/** Initial switch position of a bool setting (anything but true is off). */
export function initialSettingFlag(def: Pick<SystemSetting, "value">): boolean {
  return def.value === true;
}

/** A registry bound (a plain number such as 0.5 or 100) in integer hundredths, for exact comparison. */
function boundHundredths(n: number): number {
  return Math.round(n * 100);
}

/**
 * Client-side mirror of the registry rules: int = whole number within min..max, decimal = at most
 * 2 decimals within min..max (compared in integer hundredths, sent as the number the server's own
 * "shortest text has <= 2 decimals" check accepts), bool = true/false; null only if nullable;
 * reason 3..500.
 */
export function validateSettingEdit(def: SystemSetting, input: SettingEditInput): SettingEditResult {
  const errors: SettingEditError[] = [];
  const kind = settingKind(def);
  let value: SettingValue = null;

  if (kind === "bool") {
    if (input.clear) errors.push({ field: "value", code: "notNullable" });
    else value = input.flag === true;
  } else if (input.clear) {
    if (!def.nullable) errors.push({ field: "value", code: "notNullable" });
  } else if (input.raw.trim() === "") {
    errors.push({ field: "value", code: "required" });
  } else if (def.key === SETTING_FROM_QUARTER) {
    // first quarter of the automatic dividend credit: 20264 or 2026Q4, range 20001..21004, last digit 1..4
    const code = parseQuarterInput(input.raw);
    if (code === null || !isValidQuarterCode(code)) errors.push({ field: "value", code: "notQuarter" });
    else value = code;
  } else if (kind === "int") {
    if (!INT_RE.test(input.raw.trim())) errors.push({ field: "value", code: "notInteger" });
    else {
      const n = Number(input.raw.trim());
      if (def.min != null && n < def.min) errors.push({ field: "value", code: "belowMin" });
      else if (def.max != null && n > def.max) errors.push({ field: "value", code: "aboveMax" });
      else value = n;
    }
  } else {
    const text = input.raw.trim();
    const hundredths = DECIMAL_RE.test(text) ? parseDecimalToCents(text) : null;
    if (hundredths === null) errors.push({ field: "value", code: "notDecimal" });
    else if (def.min != null && hundredths < boundHundredths(def.min)) errors.push({ field: "value", code: "belowMin" });
    else if (def.max != null && hundredths > boundHundredths(def.max)) errors.push({ field: "value", code: "aboveMax" });
    else value = Number(centsToDecimalString(hundredths));
  }

  const reason = validateReason(input.reason);
  if (!reason.ok) errors.push({ field: "reason", code: reason.error });

  if (errors.length > 0 || !reason.ok) return { ok: false, errors };
  return { ok: true, body: { value, reason: reason.value } };
}

/** Text of a stored value for tables and history: "On"/"Off" keys for bool are chosen by the caller. */
export function formatSettingValue(
  kind: "int" | "bool" | "decimal",
  v: SettingValue,
  key?: string,
): { type: "unset" } | { type: "bool"; on: boolean } | { type: "text"; text: string } {
  if (v == null) return { type: "unset" };
  if (typeof v === "boolean") return { type: "bool", on: v };
  if (key === SETTING_FROM_QUARTER && typeof v === "number") return { type: "text", text: quarterCodeLabel(v) };
  if (kind === "decimal") {
    const c = parseDecimalToCents(String(v));
    return { type: "text", text: c === null ? String(v) : centsToDecimalString(c) };
  }
  return { type: "text", text: String(v) };
}
