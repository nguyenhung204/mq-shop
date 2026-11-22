import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { USER_STATUS_FILTERS, canLockUnlock, userStatusParam } from "./user-status";

describe("userStatusParam: /admin/users and /cs/customers answer 400 to anything else, an empty value included", () => {
  it("passes the three valid values", () => {
    for (const s of ["ACTIVE", "LOCKED", "PENDING_ACTIVATION"]) expect(userStatusParam(s)).toBe(s);
    expect([...USER_STATUS_FILTERS]).toEqual(["ACTIVE", "LOCKED", "PENDING_ACTIVATION"]);
  });
  it("omits the parameter for empty, junk, lower case and the old names", () => {
    for (const s of ["", " ", "active", "PENDING", "DELETED", "SUSPENDED", null, undefined]) expect(userStatusParam(s as never), String(s)).toBeUndefined();
  });
});

describe("lock / unlock", () => {
  it("not available for an account nobody claimed yet (409 ACCOUNT_PENDING_ACTIVATION)", () => {
    expect(canLockUnlock("PENDING_ACTIVATION")).toBe(false);
    for (const s of ["ACTIVE", "LOCKED", undefined, null]) expect(canLockUnlock(s as never)).toBe(true);
  });
});

describe("wiring", () => {
  const src = (f: string) => readFileSync(path.join(__dirname, "..", "..", f), "utf8");
  it("both lists send status through userStatusParam and offer the pending filter", () => {
    expect(src("app/admin/users/page.tsx")).toContain("status: userStatusParam(status)");
    expect(src("lib/queries/cs.ts")).toContain("status: userStatusParam(status)");
    for (const f of ["app/admin/users/page.tsx", "app/admin/customers/page.tsx"]) expect(src(f), f).toContain('value="PENDING_ACTIVATION"');
  });
  it("lock and unlock are disabled for a pending account", () => {
    const p = src("app/admin/users/page.tsx");
    expect(p.match(/!canLockUnlock\(u\.status\)/g)?.length).toBe(2);
  });
  it("the pending status has a label in every locale", async () => {
    const { getTranslation } = await import("@/lib/i18n/get-translation");
    const labels = new Set(["en", "vi", "zh-TW"].map((l) => getTranslation(l as "en", "status.user.PENDING_ACTIVATION")));
    expect(labels.size).toBe(3);
    for (const l of labels) expect(l).not.toContain("status.user");
  });
});
