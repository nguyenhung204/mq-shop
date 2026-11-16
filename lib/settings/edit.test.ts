import { describe, expect, it } from "vitest";
import type { SystemSetting } from "@/lib/api/settings";
import { validateSettingEdit } from "./edit";

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
