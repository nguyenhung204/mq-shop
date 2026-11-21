import { describe, expect, it } from "vitest";
import type { SystemSetting } from "@/lib/api/settings";
import {
  formatSettingValue,
  initialSettingFlag,
  initialSettingText,
  settingKind,
  validateSettingEdit,
} from "./edit";

const def = (over: Partial<SystemSetting> = {}): SystemSetting => ({
  key: "dividendEditWindowDays",
  value: null,
  default: null,
  isDefault: true,
  min: 0,
  max: 365,
  nullable: true,
  description: "",
  nullMeaning: "x",
  updatedBy: null,
  updatedAt: null,
  ...over,
});
const ok = (raw: string, over: Partial<{ clear: boolean; reason: string }> = {}) =>
  validateSettingEdit(def(), { raw, clear: false, reason: "Client confirmed", ...over });

describe("validateSettingEdit", () => {
  it("accepts integers on the bounds and trims the reason", () => {
    expect(ok("0", { reason: "  Client said so  " })).toEqual({ ok: true, body: { value: 0, reason: "Client said so" } });
    expect(ok("365")).toMatchObject({ ok: true, body: { value: 365 } });
  });
  it("rejects out of range, decimals, signs, exponent and empty", () => {
    const code = (raw: string) => {
      const r = ok(raw);
      return r.ok ? "ok" : r.errors.find((e) => e.field === "value")?.code;
    };
    expect(code("366")).toBe("aboveMax");
    expect(code("")).toBe("required");
    expect(code("1.5")).toBe("notInteger");
    expect(code("-1")).toBe("notInteger");
    expect(code("1e2")).toBe("notInteger");
    expect(code("abc")).toBe("notInteger");
  });
  it("enforces the setting's own minimum", () => {
    const r = validateSettingEdit(def({ min: 1 }), { raw: "0", clear: false, reason: "abc" });
    expect(r).toEqual({ ok: false, errors: [{ field: "value", code: "belowMin" }] });
  });
  it("clear sends null only for nullable settings", () => {
    expect(ok("", { clear: true })).toEqual({ ok: true, body: { value: null, reason: "Client confirmed" } });
    const r = validateSettingEdit(def({ nullable: false }), { raw: "", clear: true, reason: "abc" });
    expect(r).toEqual({ ok: false, errors: [{ field: "value", code: "notNullable" }] });
  });
  it("requires a 3..500 char reason", () => {
    const reasonCode = (reason: string) => {
      const r = ok("5", { reason });
      return r.ok ? "ok" : r.errors.find((e) => e.field === "reason")?.code;
    };
    expect(reasonCode("")).toBe("required");
    expect(reasonCode("   ")).toBe("required");
    expect(reasonCode("ab")).toBe("tooShort");
    expect(reasonCode("abc")).toBe("ok");
    expect(reasonCode("x".repeat(500))).toBe("ok");
    expect(reasonCode("x".repeat(501))).toBe("tooLong");
  });
  it("reports both field errors together", () => {
    const r = validateSettingEdit(def(), { raw: "999", clear: false, reason: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.map((e) => e.field).sort()).toEqual(["reason", "value"]);
  });
});

describe("validateSettingEdit: bool and decimal kinds (C1-8)", () => {
  const dec = (over: Partial<SystemSetting> = {}) =>
    def({ key: "taxRatePercent", kind: "decimal", value: 0, default: 0, min: 0, max: 100, nullable: false, ...over });
  const flag = (over: Partial<SystemSetting> = {}) =>
    def({ key: "taxEnabled", kind: "bool", value: false, default: false, min: null, max: null, nullable: false, ...over });
  const decRes = (raw: string) => validateSettingEdit(dec(), { raw, clear: false, reason: "Client said 5%" });

  it("sends a decimal as the exact JSON number the server's 2-decimal check accepts", () => {
    expect(decRes("5")).toEqual({ ok: true, body: { value: 5, reason: "Client said 5%" } });
    expect(decRes("5.25")).toMatchObject({ ok: true, body: { value: 5.25 } });
    expect(decRes(" 5.2 ")).toMatchObject({ ok: true, body: { value: 5.2 } });
    expect(decRes("0")).toMatchObject({ ok: true, body: { value: 0 } });
    expect(decRes("100")).toMatchObject({ ok: true, body: { value: 100 } });
    expect(decRes("100.00")).toMatchObject({ ok: true, body: { value: 100 } });
    // the value must survive JSON exactly as typed
    const r = decRes("7.05");
    expect(r.ok && JSON.stringify(r.body.value)).toBe("7.05");
  });
  it("rejects 3 decimals, signs, exponent, comma, empty and out of range decimals", () => {
    const code = (raw: string) => {
      const r = decRes(raw);
      return r.ok ? "ok" : r.errors.find((e) => e.field === "value")?.code;
    };
    expect(code("5.255")).toBe("notDecimal");
    expect(code("-1")).toBe("notDecimal");
    expect(code("1e1")).toBe("notDecimal");
    expect(code("5,5")).toBe("notDecimal");
    expect(code(".5")).toBe("notDecimal");
    expect(code("5.")).toBe("notDecimal");
    expect(code("")).toBe("required");
    expect(code("100.01")).toBe("aboveMax");
    expect(code("101")).toBe("aboveMax");
  });
  it("decimal bounds are compared exactly (no float drift)", () => {
    const r = validateSettingEdit(dec({ min: 0.1, max: 0.3 }), { raw: "0.30", clear: false, reason: "abc" });
    expect(r).toMatchObject({ ok: true, body: { value: 0.3 } });
    expect(validateSettingEdit(dec({ min: 0.1, max: 0.3 }), { raw: "0.31", clear: false, reason: "abc" }).ok).toBe(false);
    expect(validateSettingEdit(dec({ min: 0.1, max: 0.3 }), { raw: "0.09", clear: false, reason: "abc" }).ok).toBe(false);
  });
  it("a bool setting sends true/false, never a number or text, and cannot be cleared", () => {
    expect(validateSettingEdit(flag(), { raw: "junk", clear: false, reason: "abc", flag: true })).toEqual({
      ok: true,
      body: { value: true, reason: "abc" },
    });
    expect(validateSettingEdit(flag(), { raw: "", clear: false, reason: "abc", flag: false })).toEqual({
      ok: true,
      body: { value: false, reason: "abc" },
    });
    expect(validateSettingEdit(flag(), { raw: "", clear: false, reason: "abc" })).toMatchObject({ body: { value: false } });
    expect(validateSettingEdit(flag(), { raw: "", clear: true, reason: "abc", flag: true }).ok).toBe(false);
  });
  it("a bool still needs a reason", () => {
    expect(validateSettingEdit(flag(), { raw: "", clear: false, reason: " ", flag: true }).ok).toBe(false);
  });
  it("an older API without kind is treated as int", () => {
    expect(settingKind({})).toBe("int");
    expect(validateSettingEdit(def({ kind: undefined }), { raw: "1.5", clear: false, reason: "abc" }).ok).toBe(false);
  });
  it("initial field state comes from the stored value", () => {
    expect(initialSettingText({ kind: "decimal", value: 5.25 })).toBe("5.25");
    expect(initialSettingText({ kind: "bool", value: true })).toBe("");
    expect(initialSettingFlag({ value: true })).toBe(true);
    expect(initialSettingFlag({ value: null })).toBe(false);
  });
  it("formats stored values for the table and history", () => {
    expect(formatSettingValue("bool", true)).toEqual({ type: "bool", on: true });
    expect(formatSettingValue("bool", false)).toEqual({ type: "bool", on: false });
    expect(formatSettingValue("decimal", 5)).toEqual({ type: "text", text: "5.00" });
    expect(formatSettingValue("decimal", 5.25)).toEqual({ type: "text", text: "5.25" });
    expect(formatSettingValue("int", 12)).toEqual({ type: "text", text: "12" });
    expect(formatSettingValue("int", null)).toEqual({ type: "unset" });
  });
});
