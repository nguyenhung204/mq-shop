import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * Behaviour of the role gates: the REAL page components are rendered with a signed-in account of each role.
 * A refused role gets the guard's loading placeholder and the page body is never rendered; an allowed role
 * gets the body. (Data hooks are stubbed: the pages themselves are what is under test.)
 */
const state = vi.hoisted(() => ({ roles: [] as string[] }));

vi.mock("@/components/providers/AuthProvider", () => ({
  useAuth: () => ({
    user: { id: "u1", email: "u@x.co", roles: state.roles },
    loading: false,
    isAuthenticated: true,
    hasRole: (r: string) => state.roles.includes(r),
    hasAnyPermission: () => false,
  }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: () => {}, push: () => {} }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
}));

const hook = vi.hoisted(
  () => () => ({
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
    isPending: false,
    isSuccess: false,
    mutate: () => {},
    mutateAsync: async () => ({}),
    reset: () => {},
  }),
);
vi.mock("@/lib/queries/dividend-settlements", () => ({
  useDividendSettlements: hook,
  useSettlementDetail: hook,
  useRunSettlement: hook,
  useMyDividendCredits: hook,
  useMyDividendCredit: hook,
}));
vi.mock("@/lib/queries/sub-accounts", () => ({
  useSubAccounts: hook,
  useSubAccountInvites: hook,
  useCreateSubAccount: hook,
  useWithdrawSubAccount: hook,
  useCreateInvite: hook,
  useRevokeInvite: hook,
  useSubAccountTree: hook,
  useAccountRoot: hook,
  useAdminCreateSubAccount: hook,
  useDiscardPending: hook,
  useDeclineSubAccount: hook,
}));
vi.mock("@/lib/queries/refund-cases", () => ({
  useBuyerRefundCases: hook,
  useSellerRefundCases: hook,
  useRefundCaseDetail: hook,
  useRefundCaseAction: hook,
  useAdminRefundCases: hook,
  useAdminRefundSummary: hook,
  useAdminRefundCaseDetail: hook,
  useOverrideRefundCase: hook,
}));
vi.mock("@/lib/queries/accounting-export", () => ({ useExportSummary: hook, useExportDownload: hook }));

import { LanguageProvider } from "@/components/providers/LanguageProvider";

const params = <T,>(value: T) => Object.assign(Promise.resolve(value), { status: "fulfilled", value });

type Page = { default: (p: never) => React.ReactElement };
async function render(path: string, roles: string[], props: object = {}): Promise<string> {
  state.roles = roles;
  const mod = (await import(/* @vite-ignore */ path)) as Page;
  return renderToStaticMarkup(createElement(LanguageProvider, null, createElement(mod.default as never, props as never)));
}
const GUARD_PLACEHOLDER = "admin.common.loading";
const allowed = (html: string) => !html.includes(GUARD_PLACEHOLDER);

const ALL = ["BUYER", "SELLER", "CS", "WAREHOUSE", "ACCOUNTANT", "ADMIN", "SUPER_ADMIN"];
const matrix: Array<{ name: string; path: string; props?: object; roles: string[] }> = [
  { name: "/dividend-credits", path: "@/app/dividend-credits/page", roles: ["ACCOUNTANT", "ADMIN", "SUPER_ADMIN", "SELLER", "BUYER"] },
  { name: "/dividend-credits/[id]", path: "@/app/dividend-credits/[id]/page", props: { params: params({ id: "i1" }) }, roles: ["ACCOUNTANT", "ADMIN", "SUPER_ADMIN", "SELLER", "BUYER"] },
  { name: "/admin/dividend/settlements", path: "@/app/admin/dividend/settlements/page", roles: ["ACCOUNTANT", "ADMIN", "SUPER_ADMIN"] },
  { name: "/admin/dividend/settlements/[quarter]", path: "@/app/admin/dividend/settlements/[quarter]/page", props: { params: params({ quarter: "2026Q4" }) }, roles: ["ACCOUNTANT", "ADMIN", "SUPER_ADMIN"] },
  { name: "/sub-accounts", path: "@/app/sub-accounts/page", roles: ["BUYER", "SELLER"] },
  { name: "/admin/accounts/[id]/sub-accounts", path: "@/app/admin/accounts/[id]/sub-accounts/page", props: { params: params({ id: "a1" }) }, roles: ["ACCOUNTANT", "ADMIN", "SUPER_ADMIN"] },
  { name: "/refunds", path: "@/app/refunds/page", roles: ["BUYER", "SELLER"] },
  { name: "/seller/refunds", path: "@/app/seller/refunds/page", roles: ["SELLER"] },
  { name: "/admin/refund-cases", path: "@/app/admin/refund-cases/page", roles: ["CS", "ACCOUNTANT", "ADMIN", "SUPER_ADMIN"] },
  { name: "/admin/refund-cases/[id]", path: "@/app/admin/refund-cases/[id]/page", props: { params: params({ id: "c1" }) }, roles: ["CS", "ACCOUNTANT", "ADMIN", "SUPER_ADMIN"] },
  { name: "/admin/accounting-export", path: "@/app/admin/accounting-export/page", roles: ["ACCOUNTANT", "ADMIN", "SUPER_ADMIN"] },
];

describe("page role gates (real pages rendered per role)", () => {
  for (const m of matrix) {
    it(`${m.name}: allowed for ${m.roles.join(", ")}; every other role is refused`, async () => {
      for (const role of ALL) {
        const html = await render(m.path, [role], m.props);
        expect(allowed(html), `${m.name} as ${role}`).toBe(m.roles.includes(role));
      }
    });
  }
  it("a user with several roles passes when one of them is allowed (CS + BUYER on my dividend credits)", async () => {
    expect(allowed(await render("@/app/dividend-credits/page", ["CS", "BUYER"]))).toBe(true);
    expect(allowed(await render("@/app/dividend-credits/page", ["CS", "WAREHOUSE"]))).toBe(false);
  });
  it("CS and WAREHOUSE never reach the dividend credit pages, so they never see the 403 banner", async () => {
    for (const role of ["CS", "WAREHOUSE"]) {
      const html = await render("@/app/dividend-credits/page", [role]);
      expect(html).not.toContain("dividendCredits.title");
      expect(html).not.toContain("alert-error");
    }
  });
});

// M1: pages whose primary API the server refuses to the role (RBAC matrix). Only the refused roles are rendered:
// they must get the guard placeholder (which redirects to "/"), never the page body with a 403.
describe("M1 refused roles get the guard, not an empty page with a 403", () => {
  const refused: Array<{ path: string; roles: string[] }> = [
    { path: "@/app/admin/mlm/page", roles: ["CS", "WAREHOUSE"] },
    { path: "@/app/admin/finance/configs/page", roles: ["ADMIN", "CS", "WAREHOUSE"] },
    { path: "@/app/admin/products-view/page", roles: ["WAREHOUSE", "CS", "ACCOUNTANT"] },
    { path: "@/app/admin/transfers/page", roles: ["WAREHOUSE", "CS", "ACCOUNTANT"] },
    { path: "@/app/admin/audit-logs/page", roles: ["ACCOUNTANT", "CS", "WAREHOUSE"] },
    { path: "@/app/admin/landing-cost/page", roles: ["CS", "WAREHOUSE"] },
  ];
  for (const r of refused) {
    it(`${r.path}: refused for ${r.roles.join(", ")}`, async () => {
      for (const role of r.roles) expect(allowed(await render(r.path, [role])), `${r.path} as ${role}`).toBe(false);
    });
  }
});

// FX rates page (server: CONFIG_SYS ADMIN=P, SUPER_ADMIN=A, ACCOUNTANT/CS/WAREHOUSE=N). The panel needs a data layer,
// so it is stubbed: what is under test is the guard.
vi.mock("@/components/admin/AdminFxRatesPanel", () => ({ AdminFxRatesPanel: () => createElement("div", null, "FX-PANEL-BODY") }));
describe("/admin/fx-rates role gate (real page, real guard)", () => {
  it("ADMIN and SUPER_ADMIN get the panel", async () => {
    for (const role of ["ADMIN", "SUPER_ADMIN"]) {
      const html = await render("@/app/admin/fx-rates/page", [role]);
      expect(allowed(html), role).toBe(true);
      expect(html, role).toContain("FX-PANEL-BODY");
    }
  });
  it("ACCOUNTANT, CS, WAREHOUSE are refused and never see the panel", async () => {
    for (const role of ["ACCOUNTANT", "CS", "WAREHOUSE"]) {
      const html = await render("@/app/admin/fx-rates/page", [role]);
      expect(allowed(html), role).toBe(false);
      expect(html, role).not.toContain("FX-PANEL-BODY");
    }
  });
});

describe("a malformed quarter segment is a not-found state, not a crash", () => {
  it("/settlements/%25 renders 'not found' for an admin and never calls the detail hook with garbage", async () => {
    const html = await render("@/app/admin/dividend/settlements/[quarter]/page", ["ADMIN"], { params: params({ quarter: "%25" }) });
    expect(html).toContain("dividendSettlements.errors.notFound");
    expect(html).toContain('href="/admin/dividend/settlements"');
  });
  it("other invalid segments too; a valid one renders the detail page", async () => {
    for (const q of ["%E0%A4%A", "abc", "2026Q5", "..%2F", "2026q4"]) {
      const html = await render("@/app/admin/dividend/settlements/[quarter]/page", ["ADMIN"], { params: params({ quarter: q }) });
      expect(html, q).toContain("dividendSettlements.errors.notFound");
    }
    const ok = await render("@/app/admin/dividend/settlements/[quarter]/page", ["ADMIN"], { params: params({ quarter: "2026Q4" }) });
    expect(ok).not.toContain("dividendSettlements.errors.notFound");
    expect(ok).toContain("2026 Q4");
  });
});
