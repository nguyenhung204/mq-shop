import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { hasDeadBranchMarker, stripComments } from "./test-utils/strip-comments";

/** Wiring guards for the CR 11/11 pages (no component test runner in this repo). */
const raw = (f: string) => readFileSync(path.join(__dirname, "..", f), "utf8");
const src = (f: string) => {
  const code = stripComments(raw(f));
  if (hasDeadBranchMarker(code)) throw new Error(`${f}: dead branch marker`);
  return code;
};

describe("settings page wiring (U1)", () => {
  it("is guarded for ADMIN/SUPER_ADMIN and gates writes with canWriteSettings", () => {
    const p = src("app/admin/settings/page.tsx");
    expect(p).toContain('roles={["SUPER_ADMIN", "ADMIN"]}');
    expect(p).toContain("const canWrite = canWriteSettings(user)");
    expect(p).toContain("{canWrite ? (");
    expect(p).toContain("<SettingEditModal");
  });
  it("modal validates before submit and the hook sends the idempotency key", () => {
    expect(src("components/admin/SettingEditModal.tsx")).toContain("validateSettingEdit(setting, { raw, clear, reason })");
    const q = src("lib/queries/settings.ts");
    expect(q).toContain("idempotency.keyFor(vars)");
    expect(q).toContain("adminSettingsApi.update(vars.key, vars.body,");
  });
  it("nav entry is gated by role and permission", () => {
    const nav = src("components/admin/nav.ts");
    const i = nav.indexOf('href: "/admin/settings"');
    expect(i).toBeGreaterThan(-1);
    const block = nav.slice(i, nav.indexOf("},", i));
    expect(block).toContain('permissions: ["CONFIG_SYS"]');
    expect(block).toContain('roles: ["ADMIN", "SUPER_ADMIN"]');
  });
});

describe("dividend rates page wiring (U2)", () => {
  it("is read for ADMIN/ACCOUNTANT/SUPER_ADMIN, form only for SUPER_ADMIN", () => {
    const p = src("app/admin/dividend/rates/page.tsx");
    expect(p).toContain('roles={["SUPER_ADMIN", "ADMIN", "ACCOUNTANT"]}');
    expect(p).toContain("const canWrite = canWriteDividend(user)");
    expect(p).toContain("{canWrite ? (\n          <DividendRateForm");
  });
  it("form validates with validateRateForm and rows have no edit or delete control", () => {
    expect(src("components/admin/dividend/DividendRateForm.tsx")).toContain("validateRateForm({ ratePercent, effectiveDate, reason })");
    const p = src("app/admin/dividend/rates/page.tsx");
    expect(p).not.toMatch(/AdminIconButton|onDelete|onEdit|\.delete\(|\.put\(|\.patch\(/);
  });
  it("write hooks go through the idempotency store", () => {
    const q = src("lib/queries/dividend.ts");
    expect(q).toContain("run(vars, idempotency.keyFor(vars))");
    const a = src("lib/api/dividend.ts");
    expect(a).toContain('api.post<DividendRate>("/admin/dividend/rates", body, idem(idempotencyKey))');
    expect(a).toContain('"/admin/dividend/slots", body, idem(idempotencyKey)');
    expect(a).toContain('"/admin/dividend/slots/transfer", body, idem(idempotencyKey)');
  });
});

describe("dividend slots page wiring (U3)", () => {
  it("forms are SUPER_ADMIN only and receive the server lock flag", () => {
    const p = src("app/admin/dividend/slots/page.tsx");
    expect(p).toContain("const canWrite = canWriteDividend(user)");
    expect(p).toContain("{canWrite && data ? (");
    expect(p).toContain("const locked = Boolean(data?.locked)");
    expect(p).toContain("locked={locked}");
    expect(p).toContain("{canWrite && !locked ? (");
  });
  it("forms validate with the pure helpers before submit", () => {
    const f = src("components/admin/dividend/SlotForms.tsx");
    expect(f).toContain("validateSetSlots({ userId, slots, expiresAtLocal, reason }, ctx)");
    expect(f).toContain("validateTransfer({ fromUserId, toUserId, slots, reason }, ctx)");
  });
  it("a 409 DIVIDEND_QUARTER_LOCKED refreshes the lock state", () => {
    expect(src("lib/queries/dividend.ts")).toContain('e.code === "DIVIDEND_QUARTER_LOCKED"');
  });
});
