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

import { EnableAutoCreditConfirm } from "@/components/dividend/SettlementViews";
import { DIVIDEND_CREDIT_ROLES, canViewDividendCredits, needsEnableConfirm, quarterFromSegment } from "./access";
import { resolveNotificationRoute } from "@/lib/notifications/routes";

describe("turning the automatic credit ON needs a confirmation", () => {
  it("only enabling that key (false/null -> true) asks; disabling and other settings do not", () => {
    expect(needsEnableConfirm("dividendAutoCreditEnabled", true, false)).toBe(true);
    expect(needsEnableConfirm("dividendAutoCreditEnabled", true, null)).toBe(true);
    expect(needsEnableConfirm("dividendAutoCreditEnabled", false, true)).toBe(false);
    expect(needsEnableConfirm("dividendAutoCreditEnabled", true, true)).toBe(false);
    expect(needsEnableConfirm("taxEnabled", true, false)).toBe(false);
    expect(needsEnableConfirm("dividendAutoCreditFromQuarter", 20264, null)).toBe(false);
  });
  const render = (props: Partial<Parameters<typeof EnableAutoCreditConfirm>[0]> = {}) =>
    renderToStaticMarkup(createElement(LanguageProvider, null, createElement(EnableAutoCreditConfirm, { open: true, fromQuarterLabel: null, onClose: () => {}, onConfirm: () => {}, ...props })));
  it("repeats the warning, says whether the first quarter is set, and the confirm button starts disabled (needs the tick)", () => {
    const html = render();
    expect(html).toContain('data-testid="auto-credit-warning"');
    expect(html).toContain("dividendSettlements.warning.order");
    expect(html).toContain("dividendSettlements.enableConfirm.fromNotSet");
    expect(html).toMatch(/<button[^>]*disabled[^>]*>dividendSettlements\.enableConfirm\.confirm|<button[^>]*disabled=""[^>]*>dividendSettlements\.enableConfirm\.confirm/);
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('role="alertdialog"');
  });
  it("shows the first quarter when it is set", () => {
    const html = render({ fromQuarterLabel: "2026 Q4" });
    expect(html).toContain("dividendSettlements.enableConfirm.fromSet");
    expect(html).not.toContain("fromNotSet");
  });
  it("renders nothing while closed", () => {
    expect(render({ open: false })).toBe("");
  });
  it("the settings page routes the ON switch through it and the stored value comes from the list", async () => {
    const { readFileSync } = await import("node:fs");
    const p = readFileSync(`${__dirname}/../../app/admin/settings/page.tsx`, "utf8");
    expect(p).toContain("needsEnableConfirm(editing.key, body.value, editing.value)");
    expect(p).toContain("<EnableAutoCreditConfirm");
  });
});

describe("dividend credit access", () => {
  it("roles of the backend route: ACCOUNTANT, ADMIN, SUPER_ADMIN, SELLER, BUYER; not CS or WAREHOUSE", () => {
    expect([...DIVIDEND_CREDIT_ROLES].sort()).toEqual(["ACCOUNTANT", "ADMIN", "BUYER", "SELLER", "SUPER_ADMIN"]);
    expect(canViewDividendCredits({ roles: ["BUYER"] })).toBe(true);
    expect(canViewDividendCredits({ roles: ["CS", "SELLER"] })).toBe(true);
    expect(canViewDividendCredits({ roles: ["CS"] })).toBe(false);
    expect(canViewDividendCredits({ roles: ["WAREHOUSE"] })).toBe(false);
    expect(canViewDividendCredits({ roles: ["CS", "WAREHOUSE"] })).toBe(false);
    expect(canViewDividendCredits(null)).toBe(false);
  });
  it("the credited notice goes nowhere for CS / WAREHOUSE, to the line for everybody else", () => {
    const route = (roles: string[]) => resolveNotificationRoute({ type: "DIVIDEND_CREDITED", meta: { itemId: "i1" } } as never, { roles } as never);
    expect(route(["CS"])).toBeNull();
    expect(route(["WAREHOUSE"])).toBeNull();
    for (const r of ["BUYER", "SELLER", "ACCOUNTANT", "ADMIN", "SUPER_ADMIN"]) expect(route([r]), r).toBe("/dividend-credits/i1");
  });
  it("the dashboard link is shown by canViewDividendCredits (same rule as the page)", async () => {
    const { readFileSync } = await import("node:fs");
    expect(readFileSync(`${__dirname}/../../components/account/AccountDashboard.tsx`, "utf8")).toContain("canViewDividendCredits(user) ? (");
  });
});

describe("quarterFromSegment", () => {
  it("decodes a valid quarter, returns null for malformed escapes and other text", () => {
    expect(quarterFromSegment("2026Q4")).toBe("2026Q4");
    expect(quarterFromSegment("2026%51" + "4")).toBe("2026Q4");
    for (const bad of ["%25", "%", "%E0%A4%A", "abc", "2026Q5", "2026q4", "", "2026Q4%2F"]) expect(quarterFromSegment(bad), bad).toBeNull();
  });
});
