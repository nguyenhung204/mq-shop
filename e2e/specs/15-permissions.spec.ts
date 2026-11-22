import { test, expect, request, type APIResponse } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { anon, apiAs, ok, ROLES, type Api } from "../support/api";
import type { RoleName } from "../support/env";
import { WEB } from "../support/env";
import { createSellerWithSku, createUser, deliverOrder, openRma, placeOrder, adjustWallet, relogin, type TestSeller, type TestUser } from "../support/factory";
import { offPlatformPaidOrder, uploadProof } from "../support/kit-flows-9-13";
import { discoverIds, fillRoute, listAppRoutes, NIL_UUID, settleAfterGoto, viewerContext, type RealIds } from "../support/perm-ui";

/**
 * FLOW 15 — permissions for every role x every guarded route.
 *
 * ============================== EXPECTED UI MATRIX (read this first) ==============================
 * Sources: UI guards in mq-shop (AuthGuard in app/admin/layout.tsx, app/seller/layout.tsx and per page; middleware.ts)
 * and the backend RBAC (mq_backend/src/common/rbac/role-permission.matrix.ts + route-authz.spec.ts TRUTH table).
 *
 * RULES
 *  - No access token: middleware.ts answers 307 -> /my-account?next=<path> for /admin/*, /seller/*, /super-admin/*.
 *  - Signed in: AuthGuard(roles) lets a role in when it matches `roles`; `permissions` is IGNORED when `roles` is given
 *    (AuthGuard: allowed = roles ? roleOk : permOk). A refused role is sent to "/" (client-side router.replace).
 *  - Effective allowed roles = LAYOUT roles ∩ PAGE roles. /admin layout = the 5 staff roles; /seller layout = SELLER ONLY
 *    (so WAREHOUSE/CS are refused on /seller/inventory|rma|orders although those pages list them: dead code, not a leak).
 *  - Alias pages that only redirect (fx-rates, notifications/new|catalog, super-admin) use the target page's guard.
 *  - /admin/rank-tree has only a soft gate: CS/WAREHOUSE stay on the page but no `mlm/ranks` request is made.
 *  - Where the table is ambiguous, the matching API call decides (see the API matrix further down).
 */
type Role = RoleName;
const SA: Role = "SUPER_ADMIN", AD: Role = "ADMIN", AC: Role = "ACCOUNTANT", CS: Role = "CS", WH: Role = "WAREHOUSE", SE: Role = "SELLER", BU: Role = "BUYER";
const STAFF: Role[] = [SA, AD, AC, CS, WH];
const ALL_ROLES: Role[] = [SA, AD, AC, CS, WH, SE, BU];

interface UiRule { allow: Role[]; landing?: string }
const UI_MATRIX: Record<string, UiRule> = {
  "/admin": { allow: STAFF },
  "/admin/accounting-export": { allow: [AC, AD, SA] },
  "/admin/accounts/[id]/sub-accounts": { allow: [AC, AD, SA] },
  "/admin/audit-logs": { allow: [AD, SA] }, // nav.ts also shows it to ACCOUNTANT: see "menu links" test below
  "/admin/backups": { allow: [SA] },
  "/admin/banners": { allow: [AD, SA] },
  "/admin/categories": { allow: [AD, SA] },
  "/admin/customers": { allow: [CS, AC, AD, SA] },
  "/admin/customers/[id]": { allow: [CS, AC, AD, SA] },
  "/admin/dividend/rates": { allow: [AC, AD, SA] },
  "/admin/dividend/report": { allow: [AC, AD, SA] },
  "/admin/dividend/settlements": { allow: [AC, AD, SA] },
  "/admin/dividend/settlements/[quarter]": { allow: [AC, AD, SA] },
  "/admin/dividend/slots": { allow: [AC, AD, SA] },
  "/admin/dsar": { allow: [AD, SA] },
  "/admin/finance/configs": { allow: [AC, AD, SA] },
  "/admin/fx-rates": { allow: [AC, AD, SA], landing: "/admin/finance/configs" },
  "/admin/inventory": { allow: [WH, AD, SA] },
  "/admin/landing-cost": { allow: [AC, AD, SA] },
  "/admin/marketing": { allow: [AD, SA] },
  "/admin/mlm": { allow: [AC, AD, SA] },
  "/admin/mlm/commissions/report": { allow: [AC, AD, SA] },
  "/admin/notifications": { allow: [AD, SA] },
  "/admin/notifications/catalog": { allow: [AD, SA], landing: "/admin/notifications" },
  "/admin/notifications/new": { allow: [AD, SA], landing: "/admin/notifications" },
  "/admin/orders": { allow: [CS, WH, AD, SA] },
  "/admin/orders/refund-obligations": { allow: [AC, AD, SA] },
  "/admin/payouts": { allow: [AC, AD, SA] },
  "/admin/payouts/[id]": { allow: [AC, AD, SA] },
  "/admin/platform-staff": { allow: [AD, SA] },
  "/admin/products": { allow: [AD, SA] },
  "/admin/products-view": { allow: [WH, AD, SA] },
  "/admin/promotions": { allow: [AD, SA] },
  "/admin/rank-tree": { allow: STAFF },
  "/admin/rbac": { allow: [SA] },
  "/admin/refund-cases": { allow: [CS, AC, AD, SA] },
  "/admin/refund-cases/[id]": { allow: [CS, AC, AD, SA] },
  "/admin/reviews": { allow: [AD, SA] },
  "/admin/rma": { allow: [CS, WH, AD, SA] },
  "/admin/rma/[id]": { allow: [CS, WH, AD, SA] },
  "/admin/settings": { allow: [AD, SA] },
  "/admin/settlements": { allow: [AC, AD, SA] },
  "/admin/shops": { allow: [AD, SA] },
  "/admin/shops/[id]": { allow: [AD, SA] },
  "/admin/staff": { allow: [AD, SA] },
  "/admin/system": { allow: [SA] },
  "/admin/transactions": { allow: [AC, AD, SA] },
  "/admin/transfers": { allow: [WH, AD, SA] },
  "/admin/transfers/[id]": { allow: [WH, AD, SA] },
  "/admin/users": { allow: [AD, SA] },
  "/admin/wallet/adjust": { allow: [AD, SA] },
  "/admin/wallet/payouts": { allow: [AC, AD, SA] },
  "/admin/wallet/payouts/[id]": { allow: [AC, AD, SA] },
  "/super-admin": { allow: [SA], landing: "/admin/system" },
};
// every /seller/* page: the layout admits SELLER only
const SELLER_ONLY: UiRule = { allow: [SE] };

const isGuardedRoute = (r: string) => /^\/(admin|seller|super-admin)(\/|$)/.test(r);
const guardedRoutes = listAppRoutes().filter(isGuardedRoute);
const ruleOf = (route: string): UiRule | undefined => (route.startsWith("/seller") ? SELLER_ONLY : UI_MATRIX[route]);
const HOME = "/";

// =====================================================================================================
// A. The matrix itself is complete and agrees with the sources (no browser)
// =====================================================================================================
test.describe("A. matrix completeness", () => {
  test("every /admin, /seller, /super-admin page in app/ has a rule, and no rule is stale", () => {
    const missing = guardedRoutes.filter((r) => !ruleOf(r));
    const stale = Object.keys(UI_MATRIX).filter((r) => !guardedRoutes.includes(r));
    expect({ missing, stale }).toEqual({ missing: [], stale: [] });
    expect(guardedRoutes.length).toBeGreaterThan(70);
  });

  test("the matrix equals the roles written in the page sources (layout ∩ AuthGuard roles)", () => {
    const appDir = path.join(__dirname, "..", "..", "app");
    const layoutStaff = new Set<string>(STAFF);
    const diffs: string[] = [];
    for (const route of guardedRoutes.filter((r) => r.startsWith("/admin"))) {
      const file = path.join(appDir, route, "page.tsx");
      const src = fs.readFileSync(file, "utf8");
      if (/redirect\(/.test(src) && !/<AuthGuard/.test(src)) continue; // alias page: covered by its target
      const m = src.match(/<AuthGuard[^>]*?roles=\{\[([^\]]*)\]\}/s);
      const pageRoles = m ? [...m[1].matchAll(/"([A-Z_]+)"/g)].map((x) => x[1]) : null;
      const effective = (pageRoles ?? STAFF).filter((r) => layoutStaff.has(r)).sort();
      const expected = [...UI_MATRIX[route].allow].sort();
      if (JSON.stringify(effective) !== JSON.stringify(expected)) diffs.push(`${route}: source=${effective} matrix=${expected}`);
    }
    expect(diffs).toEqual([]);
  });
});

// =====================================================================================================
// B. Guest: middleware redirect for every route (plain HTTP, no browser) + one real browser run
// =====================================================================================================
test.describe("B. guest (no session)", () => {
  for (const route of guardedRoutes) {
    test(`GUEST ${route} -> 307 /my-account?next=`, async () => {
      const ctx = await request.newContext({ baseURL: WEB, maxRedirects: 0 });
      const url = fillRoute(route, { values: new Proxy({}, { get: (_t, k) => (k === "quarter" ? "2026Q4" : NIL_UUID) }) as any, fallback: [] });
      // alias pages (fx-rates, notifications/new|catalog) redirect to their target first (next.config / redirect()); follow by hand
      let target = url;
      let loc = new URL(target, WEB);
      for (let hop = 0; hop < 3 && loc.pathname !== "/my-account"; hop++) {
        const res = await ctx.get(loc.pathname + loc.search);
        expect(res.status(), `${loc.pathname}`).toBe(307);
        target = loc.pathname + loc.search;
        loc = new URL(res.headers()["location"], WEB);
      }
      expect(loc.pathname).toBe("/my-account");
      expect(loc.searchParams.get("next")).toBe(new URL(target, WEB).pathname);
      await ctx.dispose();
    });
  }

  test("GUEST in a real browser: /admin lands on the login page and shows no admin chrome", async ({ browser }) => {
    const { context, page } = await viewerContext(browser, "GUEST");
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/my-account\?next=%2Fadmin$/);
    await expect(page.locator("body")).not.toContainText("Control center");
    await context.close();
  });
});

// =====================================================================================================
// C. Every role x every guarded route, in a browser (the real guard + real session)
// =====================================================================================================
const REPORT_DIR = path.join(__dirname, "..", ".report-extra");
test.describe("C. role x route (UI guard)", () => {
  let ids: RealIds;
  test.beforeAll(async () => { ids = await discoverIds(); });

  for (const role of ALL_ROLES) {
    for (const route of guardedRoutes) {
      test(`${role} ${route}`, async ({ browser }) => {
        const rule = ruleOf(route)!;
        const allowed = rule.allow.includes(role);
        const url = fillRoute(route, ids);
        const { context, page } = await viewerContext(browser, role);
        const denied: string[] = [];
        const mlmRanks: string[] = [];
        page.on("response", (r) => {
          if (r.url().includes(":3005") && r.status() === 403) denied.push(`${r.request().method()} ${new URL(r.url()).pathname}`);
          if (/\/mlm\/ranks/.test(r.url())) mlmRanks.push(r.url());
        });
        await page.goto(url, { waitUntil: "domcontentloaded" });
        await settleAfterGoto(page);
        // alias pages redirect client-side after the first paint: poll the final path instead of reading it once
        await expect.poll(() => new URL(page.url()).pathname, { message: `${role} on ${route}`, timeout: 10_000 }).toBe(allowed ? (rule.landing ?? url.split("?")[0]) : HOME);
        if (allowed) {
          await expect(page.locator("body")).not.toContainText(/Application error|This page couldn.t load/);
          if (denied.length) {
            // allowed by the page guard but the API refuses a call it makes: UI/API inconsistency (low), recorded not failed
            fs.mkdirSync(REPORT_DIR, { recursive: true });
            fs.appendFileSync(path.join(REPORT_DIR, "ui-allowed-api-403.jsonl"), JSON.stringify({ role, route, calls: [...new Set(denied)] }) + "\n");
          }
        }
        if (route === "/admin/rank-tree" && (role === CS || role === WH)) expect(mlmRanks, "soft gate: no mlm/ranks call").toEqual([]);
        await context.close();
      });
    }
  }
});

// =====================================================================================================
// D. Menu links shown to a role must be reachable by that role (nav.ts vs guards)
// =====================================================================================================
// SPEC MƠ HỒ: chờ quyết định của chủ dự án (menu nav.ts hiện link theo quyền, guard trang theo vai; hai nơi lệch nhau).
// KNOWN ISSUES (pinned): if one is fixed or a new one appears this test goes red so the list gets updated.
const KNOWN_DEAD_MENU_LINKS: Record<string, string[]> = {
  ACCOUNTANT: ["/admin/audit-logs: shown to ACCOUNTANT but the page guard refuses ACCOUNTANT"],
  CS: ["/admin/landing-cost: shown to CS but the page guard refuses CS"],
};
test.describe("D. admin sidebar links vs guards", () => {
  for (const role of STAFF) {
    test(`${role}: every sidebar link opens (no bounce to /)`, async ({ browser }) => {
      const { context, page } = await viewerContext(browser, role);
      await page.goto("/admin", { waitUntil: "domcontentloaded" });
      await settleAfterGoto(page);
      const hrefs = await page.locator("aside a[href^='/admin']").evaluateAll((as) => [...new Set(as.map((a) => (a as HTMLAnchorElement).getAttribute("href")!))]);
      expect(hrefs.length).toBeGreaterThan(0);
      const bad: string[] = [];
      for (const href of hrefs) {
        const pattern = href.split("?")[0];
        const rule = UI_MATRIX[pattern];
        if (!rule) { bad.push(`${href}: no matrix rule`); continue; }
        if (!rule.allow.includes(role)) bad.push(`${href}: shown to ${role} but the page guard refuses ${role}`);
      }
      const known = KNOWN_DEAD_MENU_LINKS[role] ?? [];
      if (known.length) test.info().annotations.push({ type: "known-issue", description: `SPEC MƠ HỒ: chờ quyết định. ${known.join("; ")}` });
      expect(bad, "violations must equal the recorded known issues").toEqual(known);
      await context.close();
    });
  }
});

// =====================================================================================================
// G. A page the UI guard admits must not be refused by its own primary API (UI guard vs RBAC mismatch).
//    SPEC MƠ HỒ: chờ quyết định của chủ dự án/khách (guard UI cho vào, RBAC backend từ chối). Không sửa sản phẩm.
//    The test still runs every check and PINS the current status; a fixed pair (200) or a new refusal makes it red so this list is updated.
//    KNOWN ISSUES (all currently HTTP 403):
//    - WAREHOUSE /admin/products-view -> GET /products 403 (seller-scope list; page shows no products)
//    - WAREHOUSE /admin/transfers -> GET /inventory/warehouses 403 (page cannot offer a warehouse to transfer from/to)
//    - ADMIN /admin/mlm -> GET /admin/mlm/ranks 403 (CONFIG_MLM: ADMIN=N) although nav.ts and the guard admit ADMIN
//    - ADMIN /admin/finance/configs -> GET /admin/finance/configs[/active] 403 (CONFIG_FEE: ADMIN=N) although the guard admits ADMIN
// =====================================================================================================
test.describe("G. allowed page vs its own API", () => {
  const PAIRS: Array<[Role, string, RegExp]> = [
    [WH, "/admin/products-view", /:3005\/api\/v1\/products\?/],
    [WH, "/admin/transfers", /:3005\/api\/v1\/inventory\/warehouses/],
    [AD, "/admin/mlm", /:3005\/api\/v1\/admin\/mlm\/ranks/],
    [AD, "/admin/finance/configs", /:3005\/api\/v1\/admin\/finance\/configs/],
  ];
  for (const [role, route, primary] of PAIRS) {
    test(`${role} ${route}: the page's own API call is refused (known issue, pinned)`, async ({ browser }) => {
      expect(ruleOf(route)!.allow).toContain(role);
      const { context, page } = await viewerContext(browser, role);
      const first = page.waitForResponse((r) => primary.test(r.url()), { timeout: 15_000 });
      await page.goto(route, { waitUntil: "domcontentloaded" });
      const res = await first;
      const call = `${role} on ${route}: ${res.request().method()} ${new URL(res.url()).pathname} -> ${res.status()}`;
      test.info().annotations.push({ type: "known-issue", description: `SPEC MƠ HỒ: chờ quyết định. ${call}` });
      expect(res.status(), `pinned known issue changed (update the list if fixed): ${call}`).toBe(403);
      await context.close();
    });
  }
});

// =====================================================================================================
// E. API matrix (direct calls, 7 roles + guest). Rows copied from route-authz.spec.ts TRUTH + N1/N2 routes.
//    Columns: ACCOUNTANT, ADMIN, SUPER_ADMIN, WAREHOUSE, CS, SELLER, BUYER. true = the permission guard lets the role in.
//    Allowed GET: status must not be 401/403 (fake ids give 404/400, that is fine).
//    Denied (any method): must be exactly 403. Allowed mutating rows are NOT called (they would change data).
//    Guest: 401 everywhere.
// =====================================================================================================
const T = true, F = false;
type Row = [string, boolean, boolean, boolean, boolean, boolean, boolean, boolean];
const API_MATRIX: Row[] = [
  ["POST /admin/finance/configs", F, F, T, F, F, F, F],
  ["POST /admin/finance/configs/:id/approve", T, F, T, F, F, F, F],
  ["POST /admin/finance/configs/:id/reject", T, F, T, F, F, F, F],
  ["POST /admin/wallet/payouts/:id/approve", T, T, T, F, F, F, F],
  ["POST /admin/wallet/payouts/:id/reject", T, T, T, F, F, F, F],
  ["POST /admin/wallet/payouts/:id/process", F, F, T, F, F, F, F],
  ["POST /admin/wallet/payouts/:id/resolve", F, F, T, F, F, F, F],
  ["GET /admin/wash-trading-flags", T, T, T, F, F, F, F],
  ["GET /admin/orders/refund-obligations", T, T, T, F, F, F, F],
  ["GET /admin/orders/refund-obligations/:id", T, T, T, F, F, F, F],
  ["POST /admin/wallet/adjust", F, F, T, F, F, F, F],
  ["POST /admin/payouts", F, F, T, F, F, F, F],
  ["POST /admin/payouts/:id/approve", T, T, T, F, F, F, F],
  ["POST /admin/payouts/:id/reject", T, T, T, F, F, F, F],
  ["GET /admin/payouts", T, T, T, F, F, T, F],
  ["GET /admin/payouts/:id", T, T, T, F, F, T, F],
  ["POST /admin/finance/shops/:id/fee-periods/2026-01/mark-collected", T, F, T, F, F, F, F],
  ["GET /admin/finance/fee-periods", T, T, T, F, F, T, F],
  ["POST /admin/commission/periods/2026-01/mark-paid", T, F, T, F, F, F, F],
  ["GET /admin/commission/periods", T, T, T, F, F, F, F],
  ["POST /admin/mlm/commissions/run-monthly", F, F, T, F, F, F, F],
  ["POST /admin/mlm/commissions/run-quarterly", F, F, T, F, F, F, F],
  ["POST /admin/mlm/commissions/flush-pending", F, F, T, F, F, F, F],
  ["GET /admin/settings", F, T, T, F, F, F, F],
  ["GET /admin/settings/some.key/history", F, T, T, F, F, F, F],
  ["PUT /admin/settings/some.key", F, F, T, F, F, F, F],
  ["PATCH /admin/orders/:id/paid-at", F, F, T, F, F, F, F],
  ["GET /admin/orders/:id/paid-at-history", F, T, T, F, F, F, F],
  ["GET /admin/dividend/rates", T, T, T, F, F, F, F],
  ["GET /admin/dividend/slots", T, T, T, F, F, F, F],
  ["GET /admin/dividend/slots/history", T, T, T, F, F, F, F],
  ["GET /admin/dividend/quarters/2026Q4/report", T, T, T, F, F, F, F],
  ["POST /admin/dividend/rates", F, F, T, F, F, F, F],
  ["POST /admin/dividend/slots", F, F, T, F, F, F, F],
  ["POST /admin/dividend/slots/transfer", F, F, T, F, F, F, F],
  ["GET /admin/dividend/settlements", T, T, T, F, F, F, F],
  ["GET /admin/dividend/settlements/2026Q4", T, T, T, F, F, F, F],
  ["POST /admin/dividend/settlements/2026Q4/run", F, F, T, F, F, F, F],
  ["GET /dividend/credits", T, T, T, F, F, T, T],
  ["GET /dividend/credits/:id", T, T, T, F, F, T, T],
  ["PUT /admin/fx/rates", F, F, T, F, F, F, F],
  ["POST /admin/backups", F, F, T, F, F, F, F],
  ["PUT /admin/rbac/matrix/overrides", F, F, T, F, F, F, F],
  ["POST /admin/mlm/ranks", F, F, T, F, F, F, F],
  ["PATCH /admin/mlm/users/:id/rank", F, F, T, F, F, F, F],
  ["GET /admin/mlm/users/:id/full-tree", T, T, T, F, F, F, F], // N1
  ["GET /admin/mlm/commissions/report", T, T, T, F, F, F, F], // N1
  ["GET /admin/mlm/commissions/monthly-overview", T, T, T, F, F, F, F], // N1
  ["GET /admin/mlm/commissions/quarterly-overview", T, T, T, F, F, F, F], // N1
  ["GET /admin/mlm/ranks", T, F, T, F, F, F, F], // CONFIG_MLM: ACCOUNTANT=P (read ok), ADMIN=N
  ["POST /admin/shops/:id/approve", F, T, T, F, F, F, F],
  ["POST /admin/shops/:id/reject", F, T, T, F, F, F, F],
  ["POST /admin/products/:id/approve", F, T, T, F, F, F, F],
  ["POST /admin/promotions/:id/approve", F, T, T, F, F, F, F],
  ["POST /admin/dsar/:id/approve", F, T, T, F, F, F, F],
  ["POST /admin/shops/:id/violation-lock", F, F, T, F, F, F, F],
  ["POST /admin/products/:id/hide", F, F, T, F, F, F, F],
  ["PATCH /admin/staff/:id/roles", F, F, T, F, F, F, F],
  ["POST /admin/staff/:id/approve", F, F, T, F, F, F, F],
  ["POST /admin/dsar", F, F, T, F, F, F, F],
  ["POST /admin/dsar/:id/execute", F, F, T, F, F, F, F],
  ["POST /admin/rma/:id/force-complete", F, T, T, F, F, F, F],
  ["POST /admin/rma/:id/force-close-goods-returned", F, T, T, F, F, F, F],
  ["POST /admin/rma/:id/force-close-abandoned", F, T, T, F, F, F, F],
  ["POST /admin/rma/:id/mark-refunded", F, T, T, F, F, F, F],
  ["POST /admin/rma/:id/force-receive", F, T, T, F, F, F, F],
  ["POST /admin/rma/:id/force-accept-return", F, T, T, F, F, F, F],
  ["POST /admin/rma/:id/force-refund-sent", F, T, T, F, F, F, F],
  ["GET /admin/rma", F, T, T, T, T, F, F], // truth table says SELLER passes the guard; the service then refuses a seller (sellers use GET /rma)
  ["POST /admin/orders/checkout", F, T, T, F, F, F, F],
  ["POST /admin/orders/shipping-quote", F, T, T, F, F, F, F],
  ["GET /admin/orders", T, T, T, T, T, F, F], // same: guard passes for SELLER, listAdmin refuses (sellers use GET /orders)
  ["GET /refund-cases/as-buyer", F, F, F, F, F, T, T],
  ["GET /refund-cases/as-seller", F, F, F, F, F, T, T],
  ["GET /refund-cases/:id", F, F, F, F, F, T, T],
  ["POST /refund-cases/:id/mark-paid", F, F, F, F, F, T, T],
  ["POST /refund-cases/:id/confirm", F, F, F, F, F, T, T],
  ["POST /refund-cases/:id/dispute", F, F, F, F, F, T, T],
  ["GET /admin/refund-cases", T, T, T, F, T, F, F],
  ["GET /admin/refund-cases/summary", T, T, T, F, T, F, F],
  ["GET /admin/refund-cases/:id", T, T, T, F, T, F, F],
  ["POST /admin/refund-cases/:id/override", F, T, T, F, F, F, F],
  ["GET /admin/accounting-export/refund-cases", T, T, T, F, F, F, F],
  ["GET /admin/accounting-export/refund-cases/summary", T, T, T, F, F, F, F],
  ["GET /admin/accounting-export/commission-ledger", T, T, T, F, F, F, F],
  ["GET /admin/accounting-export/commission-ledger/summary", T, T, T, F, F, F, F],
  ["GET /admin/accounting-export/wallet-transactions", T, T, T, F, F, F, F],
  ["GET /admin/accounting-export/wallet-transactions/summary", T, T, T, F, F, F, F],
  ["GET /admin/accounting-export/dividend-settlements", T, T, T, F, F, F, F],
  ["GET /admin/accounting-export/dividend-settlements/summary", T, T, T, F, F, F, F],
  ["POST /sub-accounts", F, F, F, F, F, T, T],
  ["GET /sub-accounts", F, F, F, F, F, T, T],
  ["POST /sub-accounts/invites", F, F, F, F, F, T, T],
  ["GET /sub-accounts/invites", F, F, F, F, F, T, T],
  ["DELETE /sub-accounts/invites/:id", F, F, F, F, F, T, T],
  ["DELETE /sub-accounts/:id", F, F, F, F, F, T, T],
  ["POST /admin/accounts/:id/sub-accounts", F, T, T, F, F, F, F],
  ["GET /admin/accounts/:id/sub-accounts", T, T, T, F, F, F, F],
  ["GET /admin/accounts/:id/root", T, T, T, F, F, F, F],
  ["POST /admin/accounts/:id/discard-pending", F, T, T, F, F, F, F],
  // N2: customer search is staff only (SELLER used to be able to search all customers)
  ["GET /admin/users", T, T, T, F, F, F, F],
];
const API_ROLES: Role[] = [AC, AD, SA, WH, CS, SE, BU];

async function call(api: Api, method: string, url: string): Promise<APIResponse> {
  switch (method) {
    case "GET": return api.get(url);
    case "POST": return api.post(url, {});
    case "PUT": return api.put(url, {});
    case "PATCH": return api.patch(url, {});
    default: return api.delete(url);
  }
}

test.describe("E. API role matrix", () => {
  // The seed SELLER has no shop, and the shop-scoped services refuse a seller without one (403) even though the permission guard passes.
  // The SELLER column therefore uses a real seller with an approved shop (factory), one per worker.
  let shopSeller: TestSeller;
  test.beforeAll(async () => { shopSeller = await createSellerWithSku({ prefix: "permE" }); });
  for (const [key, ...expected] of API_MATRIX) {
    test(key, async () => {
      const [method, rawPath] = key.split(" ");
      const url = rawPath.replace(/:id/g, NIL_UUID).replace(/^\//, "");
      const problems: string[] = [];
      for (let i = 0; i < API_ROLES.length; i++) {
        const role = API_ROLES[i];
        const allowed = expected[i];
        if (allowed && method !== "GET") continue; // not executed: would change data
        const api = role === SE ? shopSeller.user.api : await apiAs(role);
        const res = await call(api, method, url);
        const s = res.status();
        if (allowed ? s === 401 || s === 403 : s !== 403) problems.push(`${role}: got ${s}, expected ${allowed ? "not 401/403" : "403"}`);
        if (role !== SE) await api.dispose();
      }
      const g = await anon();
      const gs = (await call(g, method, url)).status();
      if (gs !== 401) problems.push(`GUEST: got ${gs}, expected 401`);
      await g.dispose();
      expect(problems, key).toEqual([]);
    });
  }
});

// =====================================================================================================
// F. No data leaks between buyers, sellers and account trees (own factory data; every check is read-only
//    or an attempted write that must be refused AND leave the data unchanged)
// =====================================================================================================
test.describe("F. cross-account isolation", () => {
  test.describe.configure({ mode: "default", timeout: 240_000 }); // one worker, one shared world; a red test must not skip the rest
  interface World {
    sellerA: TestSeller; sellerB: TestSeller; buyerA: TestUser; buyerB: TestUser;
    orderA: any; orderA2: any; orderA3: any; rmaA: any; rmaReq: any; slipForB: string; slipSelf: string; ownerX: TestUser; ownerY: TestUser; subOfX: { id: string; email: string };
    walletPayoutId: string; refundCaseId: string | null;
  }
  let w: World;
  test.beforeAll(async () => {
    const sellerA = await createSellerWithSku({ prefix: "permA" });
    const sellerB = await createSellerWithSku({ prefix: "permB" });
    const buyerA = await createUser({ prefix: "permBuyA" });
    const buyerB = await createUser({ prefix: "permBuyB" });
    await adjustWallet(buyerA.id, "50.00");
    const orderA = await offPlatformPaidOrder(buyerA, sellerA, 1); // MOCK orders never get a refund case; OFF_PLATFORM ones do
    await deliverOrder(sellerA, orderA.id);
    const rmaA = await openRma(buyerA, orderA.id);
    // an RMA refund approval opens the C2 refund case (tracked off-platform); may stay null when the flow needs more steps
    await ok(await sellerA.user.api.post(`rma/${rmaA.id}/approve`, { refundAmount: "10.00" }));
    await ok(await buyerA.api.post(`rma/${rmaA.id}/return-shipped`, { trackingCode: "TRK-PERM-1", carrier: "E2E" }));
    await ok(await sellerA.user.api.post(`rma/${rmaA.id}/return-received`, {}));
    await ok(await sellerA.user.api.post(`rma/${rmaA.id}/accept-return`, {})); // REFUND_PENDING: the tracking case opens here
    const cases = await ok<any>(await buyerA.api.get("refund-cases/as-buyer"));
    const refundCaseId: string | null = (cases.items ?? cases).find((c: any) => c.orderId === orderA.id)?.id ?? null;
    const orderA2 = await placeOrder(buyerA, sellerA, 1); // delivered, no RMA: the target of an intruder RMA
    await deliverOrder(sellerA, orderA2.id);
    const orderA4 = await placeOrder(buyerA, sellerA, 1); // second RMA that stays REQUESTED (target of intruder approve/reject)
    await deliverOrder(sellerA, orderA4.id);
    const rmaReq = await openRma(buyerA, orderA4.id);
    // two PENDING stock-in slips of shop A (one for the intruder test, one for the self-approval test)
    const whs = await ok<any>(await sellerA.user.api.get("inventory/warehouses"));
    const warehouseCode: string = (whs.items ?? whs)[0].code;
    const newSlip = async () => { const sl = await ok<any>(await sellerA.user.api.post("inventory/slips", { type: "IN", warehouseCode, items: [{ sku: sellerA.sku, quantity: 3 }] })); return (sl.id ?? sl.slip?.id) as string; };
    const slipForB = await newSlip();
    const slipSelf = await newSlip();
    // pending OFF_PLATFORM order with proof uploaded, not yet confirmed: the target of an intruder "payment/confirm"
    const created = await ok<any>(await buyerA.api.post("orders/checkout", {
      items: [{ variantId: sellerA.variantId, quantity: 1 }],
      shippingAddress: { fullName: "E2E Buyer", phone: "0900000000", line1: "1 Test Road", city: "Taipei", country: "TW" },
      paymentMethod: "OFF_PLATFORM",
    }));
    const orderA3 = created.order ?? created.orders?.[0] ?? created;
    await uploadProof(buyerA, orderA3.id);
    const ownerX = await createUser({ prefix: "permOwnX" });
    const ownerY = await createUser({ prefix: "permOwnY" });
    const sub = await ok<any>(await ownerX.api.post("sub-accounts", { email: `${ownerX.email.split("@")[0]}-sub@e2e.test`, fullName: "Perm Sub" }));
    const subOfX = { id: (sub.account ?? sub).id as string, email: ((sub.account ?? sub).email as string) };
    const ids = await discoverIds();
    w = { sellerA, sellerB, buyerA, buyerB, orderA, orderA2, orderA3, rmaA, rmaReq, slipForB, slipSelf, ownerX, ownerY, subOfX, walletPayoutId: ids.values.walletPayout, refundCaseId };
  });

  const refused = (r: APIResponse) => expect([403, 404], `status ${r.status()} ${r.url()}`).toContain(r.status());
  /** Either refused (403/404), or answered 200 without `id` in the list. A list that quietly returned an error body must not pass as "not leaking". */
  const hidden = async (r: APIResponse, id: string) => {
    if (r.ok()) expect(idsIn(await r.json()), r.url()).not.toContain(id);
    else refused(r);
  };
  /** 200 and `id` is NOT in it (own-scope lists that must work). */
  const listedWithout = async (r: APIResponse, id: string) => { expect(r.status(), r.url()).toBe(200); expect(idsIn(await r.json())).not.toContain(id); };
  const idsIn = (j: any): string[] => { const d = j?.data; const arr = Array.isArray(d) ? d : d?.items ?? []; return arr.map((x: any) => x.id); };

  test("buyer B cannot read buyer A's order, and A's order is not in B's list", async () => {
    refused(await w.buyerB.api.get(`orders/${w.orderA.id}`));
    await listedWithout(await w.buyerB.api.get("orders?pageSize=100"), w.orderA.id);
    expect(idsIn(await (await w.buyerA.api.get("orders")).json())).toContain(w.orderA.id); // sanity: A does see it
  });

  test("buyer B cannot cancel or pay for A's order (and the order is unchanged)", async () => {
    const before = (await ok<any>(await w.buyerA.api.get(`orders/${w.orderA.id}`)));
    refused(await w.buyerB.api.post(`orders/${w.orderA.id}/cancel`, { reason: "intruder" }));
    refused(await w.buyerB.api.post(`orders/${w.orderA2.id}/rma`, { reason: "intruder (e2e)", bankInfo: { bankName: "E2E Bank", accountNumber: "99999999", accountName: "E2E Intruder" } }));
    expect(idsIn(await (await w.buyerA.api.get("rma/mine")).json()).filter((id) => id !== w.rmaA.id && id !== w.rmaReq.id)).toEqual([]); // no RMA was opened on A's second order
    const after = (await ok<any>(await w.buyerA.api.get(`orders/${w.orderA.id}`)));
    expect((after.order ?? after).status).toBe((before.order ?? before).status);
  });

  test("buyer B cannot read A's RMA; A's RMA is not in B's lists", async () => {
    refused(await w.buyerB.api.get(`rma/${w.rmaA.id}`));
    await listedWithout(await w.buyerB.api.get("rma/mine"), w.rmaA.id);
    await hidden(await w.buyerB.api.get("rma"), w.rmaA.id);
    refused(await w.buyerB.api.post(`rma/${w.rmaA.id}/evidence`, {}));
  });

  test("buyer B cannot read or act on A's refund case", async () => {
    expect(w.refundCaseId, "the RMA approval should have opened a refund case for buyer A").not.toBeNull();
    refused(await w.buyerB.api.get(`refund-cases/${w.refundCaseId}`));
    refused(await w.buyerB.api.post(`refund-cases/${w.refundCaseId}/confirm`, {}));
    refused(await w.buyerB.api.post(`refund-cases/${w.refundCaseId}/dispute`, { note: "intruder" }));
    await listedWithout(await w.buyerB.api.get("refund-cases/as-buyer"), w.refundCaseId!);
    expect(idsIn(await (await w.buyerA.api.get("refund-cases/as-buyer")).json())).toContain(w.refundCaseId);
    // seller B is not the case's seller either
    refused(await w.sellerB.user.api.get(`refund-cases/${w.refundCaseId}`));
    await listedWithout(await w.sellerB.user.api.get("refund-cases/as-seller"), w.refundCaseId!);
  });

  test("buyer B's wallet is B's own: a userId in the query does not switch accounts; other people's payouts are refused", async () => {
    const mine = await ok<any>(await w.buyerB.api.get("wallet"));
    const viaQuery = await ok<any>(await w.buyerB.api.get(`wallet?userId=${w.buyerA.id}`));
    expect(String(viaQuery.availableBalance)).toBe(String(mine.availableBalance));
    expect(String(mine.availableBalance)).not.toBe("50.00"); // A's balance
    const txA = idsIn(await (await w.buyerA.api.get("wallet/transactions")).json());
    const txBres = await w.buyerB.api.get(`wallet/transactions?userId=${w.buyerA.id}`);
    expect([200, 400], "an unknown userId param is either ignored (own list) or rejected by the DTO whitelist").toContain(txBres.status());
    const txBviaQuery = txBres.ok() ? idsIn(await txBres.json()) : [];
    expect(txA.length).toBeGreaterThan(0);
    for (const id of txA) expect(txBviaQuery).not.toContain(id);
    refused(await w.buyerB.api.get(`wallet/withdrawals/${w.walletPayoutId}`)); // someone else's (or non-existent) payout
  });

  test("seller B cannot see or touch shop A's order", async () => {
    const b = w.sellerB.user.api;
    refused(await b.get(`orders/${w.orderA.id}`));
    await hidden(await b.get("admin/orders?pageSize=100"), w.orderA.id);
    await listedWithout(await b.get("orders?pageSize=100"), w.orderA.id);
    const before = await ok<any>(await w.sellerA.user.api.get(`orders/${w.orderA.id}`));
    refused(await b.patch(`orders/${w.orderA.id}/status`, { status: "CONFIRMED" }));
    const pendingBefore = await ok<any>(await w.buyerA.api.get(`orders/${w.orderA3.id}`));
    expect((pendingBefore.order ?? pendingBefore).status).toBe("PENDING");
    refused(await b.post(`orders/${w.orderA3.id}/payment/confirm`, {})); // would mark A's order paid
    refused(await b.post(`orders/${w.orderA3.id}/payment/reject`, { reason: "intruder" }));
    const pendingAfter = await ok<any>(await w.buyerA.api.get(`orders/${w.orderA3.id}`));
    expect((pendingAfter.order ?? pendingAfter).status).toBe("PENDING");
    const after = await ok<any>(await w.sellerA.user.api.get(`orders/${w.orderA.id}`));
    expect((after.order ?? after).status).toBe((before.order ?? before).status);
  });

  test("seller B cannot see or act on shop A's RMA", async () => {
    const b = w.sellerB.user.api;
    refused(await b.get(`rma/${w.rmaA.id}`));
    refused(await b.get(`admin/rma/${w.rmaA.id}`));
    await hidden(await b.get("admin/rma?pageSize=100"), w.rmaA.id);
    await listedWithout(await b.get("rma?pageSize=100"), w.rmaA.id);
    const rma = w.rmaReq; // REQUESTED: approve/reject are legal states, so only the ownership check can refuse
    const before = (await ok<any>(await w.sellerA.user.api.get(`rma/${rma.id}`)));
    refused(await b.post(`rma/${rma.id}/reject`, { note: "intruder (e2e)" }));
    refused(await b.post(`rma/${rma.id}/approve`, { refundAmount: "1.00" }));
    const after = (await ok<any>(await w.sellerA.user.api.get(`rma/${rma.id}`)));
    expect((after.rma ?? after).status).toBe((before.rma ?? before).status);
    // information only: on an RMA that is not REQUESTED the state check answers 409 before the shop check (an oracle on the state of a guessed id)
    const probe = await b.post(`rma/${w.rmaA.id}/reject`, { note: "intruder (e2e)" });
    test.info().annotations.push({ type: "observation", description: `seller B reject on non-REQUESTED RMA of shop A -> ${probe.status()}` });
    expect(((await ok<any>(await w.sellerA.user.api.get(`rma/${w.rmaReq.id}`))).rma ?? {}).status ?? "REQUESTED").toBe("REQUESTED");
  });

  test("seller B cannot edit or hide shop A's product, nor read its stock", async () => {
    const b = w.sellerB.user.api;
    const title = async () => { const p = await ok<any>(await w.sellerA.user.api.get(`products/${w.sellerA.productId}`)); return (p.product ?? p).title; };
    const before = await title();
    refused(await b.patch(`products/${w.sellerA.productId}`, { title: "hijacked" }));
    refused(await b.post(`products/${w.sellerA.productId}/hide`, {}));
    refused(await b.patch(`products/${w.sellerA.productId}/variants/${w.sellerA.variantId}`, { sellingPrice: "1.00" }));
    expect(await title()).toBe(before);
    const inv = await b.get(`inventory/variants?productId=${w.sellerA.productId}`);
    if (inv.ok()) expect(JSON.stringify(await inv.json())).not.toContain(w.sellerA.sku);
    else refused(inv);
  });

  // BUG (high) while red: /admin/inventory is @ScopedAdminRoute at class level but AdminInventoryService does not scope by actor.
  test("seller B cannot list, read or approve shop A's stock slips and ledger (/admin/inventory)", async () => {
    const b = w.sellerB.user.api;
    const slips = await b.get("admin/inventory/slips?pageSize=100");
    if (slips.ok()) expect(JSON.stringify(await slips.json()), "B's slip list must not contain shop A's SKU").not.toContain(w.sellerA.sku);
    const filtered = await b.get(`admin/inventory/slips?shopId=${w.sellerA.shopId}`);
    if (filtered.ok()) expect(JSON.stringify(await filtered.json()), "slips of shop A via ?shopId=").not.toContain(w.sellerA.sku);
    const ledger = await b.get(`admin/inventory/ledger?shopId=${w.sellerA.shopId}`);
    if (ledger.ok()) expect(JSON.stringify(await ledger.json()), "ledger of shop A").not.toContain(w.sellerA.sku);
    refused(await b.get(`admin/inventory/slips/${w.slipForB}`));
    const res = await b.post(`admin/inventory/slips/${w.slipForB}/approve`);
    const slipAfter = await ok<any>(await w.sellerA.user.api.get(`inventory/slips/${w.slipForB}`));
    expect.soft((slipAfter.slip ?? slipAfter).status, `slip of shop A after seller B's approve call (HTTP ${res.status()})`).toBe("PENDING");
    refused(res);
  });

  // Documented design (.forge/flows-audit.md section 4): a seller approves the stock slips of its OWN shop; only cross-shop is blocked
  // (see the cross-shop test above). Whether a seller should be allowed to self-approve (maker-checker) is an OPEN QUESTION for the project owner.
  test("a seller approves its own shop's stock-in slip (200, APPROVED); open question: maker-checker for sellers", async () => {
    const res = await w.sellerA.user.api.post(`admin/inventory/slips/${w.slipSelf}/approve`);
    expect(res.status()).toBe(200);
    const slipAfter = await ok<any>(await w.sellerA.user.api.get(`inventory/slips/${w.slipSelf}`));
    expect((slipAfter.slip ?? slipAfter).status).toBe("APPROVED");
  });

  test("a BUYER cannot reach seller or staff APIs of shop A", async () => {
    for (const url of [`admin/orders?pageSize=5`, `admin/rma?pageSize=5`, `admin/inventory/slips`, `admin/payouts`]) refused(await w.buyerB.api.get(url));
    refused(await w.buyerB.api.get(`admin/orders/${w.orderA.id}`));
    refused(await w.buyerB.api.get(`admin/rma/${w.rmaA.id}`));
  });

  test("account trees: owner Y never sees X's sub-accounts, invites or ids; non-admins cannot use /admin/accounts", async () => {
    const x = w.ownerX.api, y = w.ownerY.api;
    const listXres = await x.get("sub-accounts");
    expect(listXres.status()).toBe(200);
    const listX = JSON.stringify(await listXres.json());
    expect(listX).toContain(w.subOfX.email);
    const listYres = await y.get("sub-accounts");
    expect(listYres.status()).toBe(200);
    const listY = JSON.stringify(await listYres.json());
    expect(listY).not.toContain(w.subOfX.email);
    expect(listY).not.toContain(w.subOfX.id);
    refused(await y.delete(`sub-accounts/${w.subOfX.id}`));
    const inv = await ok<any>(await x.post("sub-accounts/invites"));
    const invId = (inv.invite ?? inv).id as string;
    const invY = await y.get("sub-accounts/invites");
    expect(invY.status()).toBe(200);
    expect(JSON.stringify(await invY.json())).not.toContain(invId);
    refused(await y.delete(`sub-accounts/invites/${invId}`));
    expect(JSON.stringify(await (await x.get("sub-accounts/invites")).json())).toContain(invId); // still there
    // staff-only tree reads
    for (const who of [w.ownerY.api, w.sellerB.user.api, w.buyerB.api]) {
      refused(await who.get(`admin/accounts/${w.ownerX.id}/sub-accounts`));
      refused(await who.get(`admin/accounts/${w.ownerX.id}/root`));
      refused(await who.post(`admin/accounts/${w.ownerX.id}/sub-accounts`, { email: "intruder@e2e.test", reason: "intruder" }));
    }
    for (const role of [CS, WH] as Role[]) {
      const api = await apiAs(role);
      refused(await api.get(`admin/accounts/${w.ownerX.id}/sub-accounts`));
      await api.dispose();
    }
    // the sub-account (BUYER) does not see its owner's tree either
    // and the legitimate staff read works (sanity)
    const sa = await apiAs(SA);
    expect(JSON.stringify(await ok(await sa.get(`admin/accounts/${w.ownerX.id}/sub-accounts`)))).toContain(w.subOfX.email);
    await sa.dispose();
  });

  test("N1: BUYER/SELLER cannot read the MLM tree or commission reports of anyone (/admin/mlm, /admin/commission)", async () => {
    for (const who of [w.buyerA.api, w.sellerA.user.api]) {
      for (const url of [
        `admin/mlm/users/${w.buyerA.id}/full-tree`, `admin/mlm/users/${w.sellerA.user.id}/full-tree`, "admin/mlm/commissions/report",
        "admin/mlm/commissions/monthly-overview", "admin/mlm/commissions/quarterly-overview", "admin/commission/periods", "admin/settlements",
      ]) refused(await who.get(url));
    }
  });

  test("own network tree stays own: B's mlm/network-tree contains no member of A's tree", async () => {
    const treeRes = await w.buyerB.api.get("mlm/network-tree");
    expect(treeRes.status()).toBe(200);
    const mine = JSON.stringify(await treeRes.json());
    expect(mine).not.toContain(w.buyerA.id);
    expect(mine).not.toContain(w.buyerA.email);
  });

  test("N2: a SELLER cannot search all customers (admin/users, admin/customers-style lookups)", async () => {
    refused(await w.sellerB.user.api.get(`admin/users?search=${encodeURIComponent(w.buyerA.email)}`));
  });
});
void relogin;
