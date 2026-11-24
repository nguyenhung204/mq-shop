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
    ["/admin/mlm", ["SUPER_ADMIN", "ACCOUNTANT", "ADMIN"]],
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
  it("menu: mlm keeps ADMIN (read-only overview); transfers exclude WAREHOUSE as decided; audit-logs excludes ACCOUNTANT; landing-cost is role-gated (not CS)", () => {
    expect(navRoles("/admin/mlm")).toEqual(["SUPER_ADMIN", "ACCOUNTANT", "ADMIN"]);
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
    expect(card("/admin/mlm")).toContain('roles: ["SUPER_ADMIN", "ACCOUNTANT", "ADMIN"]');
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
  it("next.config.ts does not redirect /admin/fx-rates away (a redirect there shadows the page; found by E2E spec 15)", () => {
    const cfg = readFileSync(path.join(root, "next.config.ts"), "utf8");
    expect(cfg).not.toMatch(/source:\s*["']\/admin\/fx-rates["']/);
  });
});

describe("ADMIN on /admin/mlm: read-only blocks only (server: VIEW_MLM_COMSN/TREE = A, CONFIG_MLM = N)", () => {
  const src = readFileSync(path.join(root, "app/admin/mlm/page.tsx"), "utf8");
  it("does not request mlm/ranks (CONFIG_MLM) for a role that cannot read it", () => {
    expect(src).toContain('const canReadRanks = canMutateConfig || hasRole("SUPER_ADMIN") || hasRole("ACCOUNTANT");');
    expect(src).toMatch(/useMlmRanks\(\{\s*enabled: canReadRanks,/);
  });
  it("the back link of the commission report points at a page every report role can open", () => {
    const report = guardRoles(pageSrc("/admin/mlm/commissions/report")!)!;
    expect(report.filter((r) => !guardRoles(src.slice(src.indexOf("export default function AdminMlmPage")))!.includes(r))).toEqual([]);
  });
});

describe("fee config is read only where the server grants CONFIG_FEE (not ADMIN)", () => {
  for (const file of ["app/admin/payouts/page.tsx", "components/admin/AdminFxRatesPanel.tsx"]) {
    it(`${file} gates useActiveFinanceConfig by role`, () => {
      const s = readFileSync(path.join(root, file), "utf8");
      expect(s).toContain('const canReadFeeConfig = hasRole("SUPER_ADMIN") || hasRole("ACCOUNTANT");');
      expect(s).toContain("useActiveFinanceConfig({ enabled: canReadFeeConfig })");
    });
  }
});

/**
 * Contract with the server RBAC matrix. FIXTURE copied from mq_backend/src/common/rbac/role-permission.matrix.ts
 * (columns GUEST,BUYER,SELLER,WAREHOUSE,CS,ACCOUNTANT,ADMIN,SUPER_ADMIN; N = none). Staff roles only.
 * If the backend checkout is next to this repo, the fixture is also compared with the real file (drift check).
 */
const STAFF_COLS = ["WAREHOUSE", "CS", "ACCOUNTANT", "ADMIN", "SUPER_ADMIN"] as const;
const MATRIX_FIXTURE: Record<string, string> = {
  VIEW_MLM_COMSN: "NSSNNAAA",
  VIEW_MLM_TREE: "NSSNNAAA",
  CONFIG_MLM: "NNNNNPNA",
  MANAGE_DIVIDEND_SLOTS: "NNNNNNAA",
  CONFIG_FEE: "NNNNNPNA",
  CONFIG_SYS: "NNNNNNPA",
  VIEW_AUDIT_LOG: "NNNNNAAA",
  CALC_LAND_COST: "NSHNAAAA",
};
const granted = (perm: string, role: (typeof STAFF_COLS)[number]) =>
  MATRIX_FIXTURE[perm][["GUEST", "BUYER", "SELLER", "WAREHOUSE", "CS", "ACCOUNTANT", "ADMIN", "SUPER_ADMIN"].indexOf(role)] !== "N";
// page -> permission its primary API needs on the server
const PAGE_PERMISSION: Record<string, string> = {
  "/admin/mlm": "VIEW_MLM_COMSN",
  "/admin/mlm/commissions/report": "VIEW_MLM_COMSN",
  "/admin/finance/configs": "CONFIG_FEE",
  "/admin/fx-rates": "CONFIG_SYS",
  "/admin/audit-logs": "VIEW_AUDIT_LOG",
  "/admin/landing-cost": "CALC_LAND_COST",
};
describe("page guards never admit a staff role the server RBAC matrix refuses", () => {
  for (const [href, perm] of Object.entries(PAGE_PERMISSION)) {
    it(`${href} (${perm}): guard roles are a subset of the roles the matrix grants`, () => {
      const roles = guardRoles(pageSrc(href)!)!;
      const refused = roles.filter((r) => (STAFF_COLS as readonly string[]).includes(r) && !granted(perm, r as (typeof STAFF_COLS)[number]));
      expect(refused).toEqual([]);
    });
  }
  it("fixture still equals the backend matrix when that checkout is present", () => {
    const file = path.join(root, "..", "mq_backend", "src", "common", "rbac", "role-permission.matrix.ts");
    if (!existsSync(file)) return;
    const text = readFileSync(file, "utf8");
    for (const [perm, cells] of Object.entries(MATRIX_FIXTURE)) {
      const m = text.match(new RegExp(`\\[Permission\\.${perm}\\]:\\s*row\\(([^)]*)\\)`));
      expect(m, perm).not.toBeNull();
      expect(m![1].split(",").map((x) => x.trim()).join(""), perm).toBe(cells);
    }
  });
});
