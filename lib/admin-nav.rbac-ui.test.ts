import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { adminNavItems } from "@/components/admin/nav";

/**
 * M1: the sidebar must not offer a page its own AuthGuard refuses, and the pages whose primary API the server
 * refuses (RBAC matrix) must not admit that role. Roles are read from the real page sources.
 */
const root = path.join(__dirname, "..");
const pageSrc = (href: string) => {
  const file = path.join(root, "app", href, "page.tsx");
  return existsSync(file) ? readFileSync(file, "utf8") : null;
};
const guardRoles = (src: string): string[] | null => {
  const m = src.match(/<AuthGuard[^>]*?roles=\{\[([^\]]*)\]\}/);
  return m ? [...m[1].matchAll(/"([A-Z_]+)"/g)].map((x) => x[1]) : null;
};
const navRoles = (href: string) => adminNavItems.find((i) => i.href === href)?.roles;

describe("admin sidebar roles never exceed the page guard", () => {
  for (const item of adminNavItems.filter((i) => i.roles?.length && i.href.startsWith("/admin"))) {
    const src = pageSrc(item.href);
    if (!src) continue;
    const pageRoles = guardRoles(src);
    if (!pageRoles) continue;
    it(`${item.href}: nav roles [${item.roles}] are all in the guard [${pageRoles}]`, () => {
      expect(item.roles!.filter((r) => !pageRoles.includes(r))).toEqual([]);
    });
  }
});

describe("M1 roles the server refuses are neither in the menu nor admitted by the page", () => {
  const cases: Array<[string, string[]]> = [
    ["/admin/mlm", ["SUPER_ADMIN", "ACCOUNTANT"]],
    ["/admin/finance/configs", ["SUPER_ADMIN", "ACCOUNTANT"]],
    ["/admin/transfers", ["ADMIN", "SUPER_ADMIN"]],
    ["/admin/audit-logs", ["ADMIN", "SUPER_ADMIN"]],
    ["/admin/landing-cost", ["ADMIN", "SUPER_ADMIN", "ACCOUNTANT"]],
    ["/admin/products-view", ["ADMIN", "SUPER_ADMIN"]],
  ];
  for (const [href, roles] of cases) {
    it(`${href}: page guard is exactly [${roles}]`, () => {
      expect(guardRoles(pageSrc(href)!)?.slice().sort()).toEqual(roles.slice().sort());
    });
  }
  it("menu: mlm and transfers exclude ADMIN/WAREHOUSE as decided; audit-logs excludes ACCOUNTANT; landing-cost is role-gated (not CS)", () => {
    expect(navRoles("/admin/mlm")).toEqual(["SUPER_ADMIN", "ACCOUNTANT"]);
    expect(navRoles("/admin/transfers")).toEqual(["ADMIN", "SUPER_ADMIN"]);
    expect(navRoles("/admin/audit-logs")).toEqual(["ADMIN", "SUPER_ADMIN"]);
    expect(navRoles("/admin/landing-cost")).toEqual(["ADMIN", "SUPER_ADMIN", "ACCOUNTANT"]);
    expect(navRoles("/admin/finance/configs")).toEqual(["SUPER_ADMIN", "ACCOUNTANT"]);
  });
  it("no sidebar entry offers WAREHOUSE the products-view page", () => {
    expect(adminNavItems.some((i) => i.href === "/admin/products-view")).toBe(false);
  });
  it("the overview cards use the same role lists", () => {
    const s = readFileSync(path.join(root, "app/admin/page.tsx"), "utf8");
    const card = (href: string) => s.slice(s.indexOf(`href: "${href}"`), s.indexOf("icon:", s.indexOf(`href: "${href}"`)));
    expect(card("/admin/mlm")).not.toContain('"ADMIN"');
    expect(card("/admin/audit-logs")).toContain('roles: ["ADMIN", "SUPER_ADMIN"]');
    expect(card("/admin/landing-cost")).toContain('roles: ["ADMIN", "SUPER_ADMIN", "ACCOUNTANT"]');
  });
});

describe("FX rates stay reachable for ADMIN (server grants CONFIG_SYS to ADMIN, not CONFIG_FEE)", () => {
  it("has its own page and menu entry for ADMIN and SUPER_ADMIN, and the page does not redirect away", () => {
    const src = pageSrc("/admin/fx-rates")!;
    expect(src).not.toContain("redirect(");
    expect(src).toContain("AdminFxRatesPanel");
    expect(guardRoles(src)?.slice().sort()).toEqual(["ADMIN", "SUPER_ADMIN"]);
    expect(navRoles("/admin/fx-rates")).toEqual(["ADMIN", "SUPER_ADMIN"]);
  });
});
