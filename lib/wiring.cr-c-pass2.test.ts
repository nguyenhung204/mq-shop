import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { adminNavItems } from "@/components/admin/nav";
import { hasDeadBranchMarker, stripComments } from "./test-utils/strip-comments";

/** Wiring guards for the pass 2 pages (C4 sub-accounts, C5 dividend credit, contract updates). */
const src = (f: string) => {
  const code = stripComments(readFileSync(path.join(__dirname, "..", f), "utf8"));
  if (hasDeadBranchMarker(code)) throw new Error(`${f}: dead branch marker`);
  return code;
};

describe("C4 pages", () => {
  it("owner page: BUYER and SELLER, counters from meta, cap blocks creation, withdraw only on pending rows", () => {
    const p = src("app/sub-accounts/page.tsx");
    expect(p).toContain('roles={["BUYER", "SELLER"]}');
    expect(p).toContain("counters(list.data?.meta)");
    expect(p).toContain("atCap={atCap(c)}");
    expect(p).toContain('actionLabelKey="subAccounts.withdraw"');
    expect(p).toContain("<NewInviteBox");
    // the token never leaves the mutation result: no storage, no cache write
    expect(p).not.toMatch(/localStorage|sessionStorage|setQueryData/);
  });
  it("the invite hooks never cache or store the token", () => {
    const q = src("lib/queries/sub-accounts.ts");
    expect(q).not.toMatch(/localStorage|sessionStorage|setQueryData/);
    expect(src("components/sub-accounts/parts.tsx")).not.toMatch(/localStorage|sessionStorage/);
  });
  it("admin tree page: read ACCOUNTANT / ADMIN / SUPER_ADMIN, write only through canCreateSubAccountFor", () => {
    const p = src("app/admin/accounts/[id]/sub-accounts/page.tsx");
    expect(p).toContain('roles={["ACCOUNTANT", "ADMIN", "SUPER_ADMIN"]}');
    expect(p).toContain("const canWrite = canCreateSubAccountFor(user)");
    expect(p).toContain("{canWrite ? (");
    expect(p).toContain("<AdminReasonModal");
    expect(p).toContain("TREE_DEFAULT_DEPTH, TREE_DEFAULT_LIMIT");
  });
  it("the admin users list links to the tree", () => {
    expect(src("app/admin/users/page.tsx")).toContain("/admin/accounts/${u.id}/sub-accounts");
  });
  it("register: the invite query parameter becomes inviteToken and wins over a referral code; the region stays", () => {
    const r = src("components/pages/RegisterContent.tsx");
    expect(r).toContain('inviteTokenFromQuery(searchParams.get("invite"))');
    expect(r).toContain("...registerReferral(inviteToken, refCode || undefined)");
    expect(r).toContain("regionCode: checkoutRegionCode(region)");
    expect(r).toContain("subAccounts.register.inviteBanner");
  });
  it("decline page is public, posts through the decline hook and only links to (does not change) forgot-password", () => {
    const d = src("components/pages/DeclineSubAccountContent.tsx");
    expect(d).toContain("validateDecline({ email, code })");
    expect(d).toContain("/my-account/lost-password");
    expect(src("app/my-account/decline-sub-account/page.tsx")).toContain("DeclineSubAccountContent");
    expect(src("components/pages/LostPasswordContent.tsx")).not.toMatch(/decline|sub-account/i);
  });
  it("the account dashboard links to sub-accounts and dividend credits", () => {
    const a = src("components/account/AccountDashboard.tsx");
    expect(a).toContain('href="/sub-accounts"');
    expect(a).toContain('href="/dividend-credits"');
  });
});

describe("C5 pages", () => {
  it("settings page shows the warning and the armed state when a C5 key exists", () => {
    const p = src("app/admin/settings/page.tsx");
    expect(p).toContain("<AutoCreditWarning />");
    expect(p).toContain("<AutoCreditStateCard state={settlements.data?.autoCredit ?? null} />");
    expect(p).toContain("useDividendSettlements(1, hasAutoCredit)");
  });
  it("admin settlement nav entry: finance roles only, never SELLER / BUYER / CS / WAREHOUSE", () => {
    const i = adminNavItems.find((x) => x.href === "/admin/dividend/settlements");
    expect(i?.roles).toEqual(["SUPER_ADMIN", "ADMIN", "ACCOUNTANT"]);
    expect(i?.permissions).toEqual(["VIEW_MLM_COMSN"]);
  });
  it("owner credit pages sit behind a bare AuthGuard (any signed-in account)", () => {
    for (const f of ["app/dividend-credits/page.tsx", "app/dividend-credits/[id]/page.tsx"]) {
      const p = src(f);
      expect(p, f).toContain("<AuthGuard>");
      expect(p, f).not.toContain("roles=");
    }
  });
  it("the run mutation is keyed per quarter and sent with an Idempotency-Key", () => {
    const q = src("lib/queries/dividend-settlements.ts");
    expect(q).toContain("runners.forKey(`${quarter}:run`).run(quarter,");
    expect(src("lib/api/dividend-settlements.ts")).toContain('headers: { "Idempotency-Key": key }');
  });
  it("getErrorMessage reads the dividend codes before the generic map", () => {
    const u = src("lib/queries/utils.ts");
    expect(u).toContain("refundCase ?? dividendErrorKey(e)");
  });
});

describe("contract updates", () => {
  it("the refund case views read hasRefundProof; the party view never shows a MARK_PAID button from it", () => {
    expect(src("lib/api/refund-cases.ts")).toContain("hasRefundProof?: boolean | null");
    expect(src("components/refund-cases/CaseCard.tsx")).toContain("needsRefundProofFirst(c) && side === \"seller\"");
  });
  it("fulfillment complaints are not called by any screen (route fixed on the API, no UI wiring asked)", () => {
    for (const f of ["app/admin/orders/page.tsx", "components/orders/OrderDetailContent.tsx"]) expect(src(f), f).not.toContain("listFulfillmentComplaints");
  });
});
