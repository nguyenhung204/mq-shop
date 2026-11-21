import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SettingEditModal } from "@/components/admin/SettingEditModal";
import { LanguageProvider } from "@/components/providers/LanguageProvider";
import type { SystemSetting } from "@/lib/api/settings";
import { formatSettingValue, initialSettingText, validateSettingEdit } from "@/lib/settings/edit";

const fromQuarter = (over: Partial<SystemSetting> = {}): SystemSetting => ({
  key: "dividendAutoCreditFromQuarter", kind: "int", value: null, default: null, isDefault: true, min: 20001, max: 21004, nullable: true,
  description: "", nullMeaning: "Not set", updatedBy: null, updatedAt: null, ...over,
});
const enabled = (over: Partial<SystemSetting> = {}): SystemSetting => ({
  key: "dividendAutoCreditEnabled", kind: "bool", value: false, default: false, isDefault: true, min: null, max: null, nullable: false,
  description: "", nullMeaning: null, updatedBy: null, updatedAt: null, ...over,
});
const edit = (raw: string, clear = false, def = fromQuarter()) => validateSettingEdit(def, { raw, clear, reason: "Client confirmed" });
const value = (r: ReturnType<typeof edit>) => (r.ok ? r.body.value : r.errors.map((e) => `${e.field}:${e.code}`));

describe("dividendAutoCreditFromQuarter input", () => {
  it("accepts the code or 2026Q4 and sends the integer code", () => {
    expect(value(edit("20264"))).toBe(20264);
    expect(value(edit("2026Q4"))).toBe(20264);
    expect(value(edit(" 2026 q1 "))).toBe(20261);
    expect(value(edit("20001"))).toBe(20001);
    expect(value(edit("21004"))).toBe(21004);
  });
  it("refuses out of range, last digit 0 or 5..9, text and empty", () => {
    for (const bad of ["20000", "21005", "20260", "20265", "20269", "2026Q5", "2026", "abc", "1999Q4", "2101Q1", "20264.0", "-20264"]) {
      expect(value(edit(bad)), bad).toEqual(["value:notQuarter"]);
    }
    expect(value(edit(""))).toEqual(["value:required"]);
  });
  it("clear = null (it is nullable)", () => {
    expect(value(edit("", true))).toBeNull();
  });
  it("the reason is still mandatory", () => {
    expect(validateSettingEdit(fromQuarter(), { raw: "20264", clear: false, reason: "" }).ok).toBe(false);
  });
  it("shows the stored value as 2026Q4 in the edit field and as '2026 Q4' in the table", () => {
    expect(initialSettingText({ key: "dividendAutoCreditFromQuarter", kind: "int", value: 20264 })).toBe("2026Q4");
    expect(initialSettingText({ key: "dividendAutoCreditFromQuarter", kind: "int", value: null })).toBe("");
    expect(initialSettingText({ key: "maxTotalSlots", kind: "int", value: 20264 })).toBe("20264");
    expect(formatSettingValue("int", 20264, "dividendAutoCreditFromQuarter")).toEqual({ type: "text", text: "2026 Q4" });
    expect(formatSettingValue("int", 20264, "maxTotalSlots")).toEqual({ type: "text", text: "20264" });
    expect(formatSettingValue("int", null, "dividendAutoCreditFromQuarter")).toEqual({ type: "unset" });
  });
});

describe("dividendAutoCreditEnabled switch", () => {
  it("is a bool: sends true / false", () => {
    expect(validateSettingEdit(enabled(), { raw: "", clear: false, reason: "go live", flag: true })).toMatchObject({ ok: true, body: { value: true } });
  });
});

const render = (s: SystemSetting) =>
  renderToStaticMarkup(createElement(LanguageProvider, null, createElement(SettingEditModal, { open: true, setting: s, onClose: () => {}, onConfirm: () => {} })));

describe("settings dialog for the C5 keys", () => {
  it("both carry the prominent warning", () => {
    expect(render(enabled())).toContain('data-testid="auto-credit-warning"');
    expect(render(fromQuarter())).toContain('data-testid="auto-credit-warning"');
  });
  it("other settings do not", () => {
    expect(render({ ...enabled(), key: "taxEnabled" })).not.toContain("auto-credit-warning");
  });
  it("the quarter field takes text, shows the stored quarter and the quarter range text, and offers 'clear'", () => {
    const html = render(fromQuarter({ value: 20264 }));
    expect(html).toContain('inputMode="text"');
    expect(html).toContain('value="2026Q4"');
    expect(html).toContain("admin.settings.rangeQuarter");
    expect(html).toContain('type="checkbox"');
  });
  it("the switch is a switch", () => {
    expect(render(enabled())).toContain('role="switch"');
  });
});
