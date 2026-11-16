import { describe, expect, it } from "vitest";
import { adminNavItems } from "@/components/admin/nav";
import en from "@/lib/i18n/locales/en.json";
import vi from "@/lib/i18n/locales/vi.json";
import zh from "@/lib/i18n/locales/zh-TW.json";

const NEW_ROUTES = [
  "/admin/settings",
  "/admin/dividend/rates",
  "/admin/dividend/slots",
  "/admin/dividend/report",
];

const get = (loc: unknown, key: string) =>
  key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], loc);

describe("CR 11/11 admin nav (U9, UI1)", () => {
  for (const href of NEW_ROUTES) {
    const item = adminNavItems.find((i) => i.href === href);
    it(`${href} exists, is gated by roles and permissions, never open to SELLER/BUYER`, () => {
      expect(item).toBeTruthy();
      expect(item!.roles?.length).toBeGreaterThan(0);
      expect(item!.permissions?.length).toBeGreaterThan(0);
      for (const forbidden of ["SELLER", "BUYER", "CS", "WAREHOUSE"]) {
        expect(item!.roles, forbidden).not.toContain(forbidden);
      }
    });
    it(`${href} label exists in en/vi/zh-TW`, () => {
      for (const loc of [en, vi, zh]) expect(typeof get(loc, item!.labelKey), item!.labelKey).toBe("string");
    });
  }
  it("settings read is ADMIN/SUPER_ADMIN only (no ACCOUNTANT)", () => {
    expect(adminNavItems.find((i) => i.href === "/admin/settings")!.roles).toEqual(["ADMIN", "SUPER_ADMIN"]);
  });
});
