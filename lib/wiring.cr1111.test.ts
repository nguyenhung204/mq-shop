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
