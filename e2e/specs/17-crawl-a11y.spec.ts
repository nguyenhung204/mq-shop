import { test, expect, type Browser, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import path from "node:path";
import { createSellerWithSku, createUser, deliverOrder, placeOrder, type TestSeller, type TestUser } from "../support/factory";
import { discoverIds, fillRoute, listAppRoutes, settleAfterGoto, trackInflight, viewerContext, waitQuiet, type RealIds, type Viewer } from "../support/perm-ui";

/**
 * FLOW 17 — crawl of every page in mq-shop/app (dynamic segments filled with real ids when the DB has them), menu links, axe.
 * Per route: no console error, no pageerror, no HTTP 5xx, page not blank.
 * Viewer: /admin/* = SUPER_ADMIN (admitted everywhere), /seller/* = factory seller with a shop, the rest = factory buyer with an order
 * (public pages as that signed-in buyer; header/footer links are also checked as a guest).
 *
 * CONSOLE ALLOWLIST (each entry says why):
 *  - "Failed to load resource ... status of 4xx": the browser logs every non-2xx API answer as a console error. 4xx are expected for
 *    ids that do not exist (routes whose id has no real row, see FALLBACK) and for role-limited side panels; they are written to
 *    e2e/.report-extra/crawl-4xx.jsonl for review instead of failing. 5xx are never allowed (checked on the response itself).
 *  - ResizeObserver loop notifications: benign browser message, not an application error.
 */
const REPORT_DIR = path.join(__dirname, "..", ".report-extra");
const CONSOLE_ALLOW: Array<{ re: RegExp; why: string }> = [
  { re: /Failed to load resource: the server responded with a status of 4\d\d/, why: "4xx logged by the browser; recorded in crawl-4xx.jsonl" },
  { re: /ResizeObserver loop/, why: "benign browser notification" },
];
/** Routes whose id has no real row to point at (no factory flow for it here): a 4xx for the lookup is expected. */
const FALLBACK = new Set(["/admin/payouts/[id]", "/admin/refund-cases/[id]", "/admin/transfers/[id]", "/seller/inventory/transfers/[id]", "/seller/wallet/withdrawals/[id]", "/wallet/withdrawals/[id]", "/dividend-credits/[id]", "/product/[slug]"]);

interface World { ids: RealIds; seller: TestSeller; buyer: TestUser; orderId: string }
let worldP: Promise<World> | null = null;
function world(): Promise<World> {
  worldP ??= (async () => {
    const ids = await discoverIds();
    const seller = await createSellerWithSku({ prefix: "crawlS" });
    const buyer = await createUser({ prefix: "crawlB" });
    const order = await placeOrder(buyer, seller, 1);
    await deliverOrder(seller, order.id);
    ids.values.order = order.id;
    ids.values.shop = seller.shopId;
    return { ids, seller, buyer, orderId: order.id };
  })();
  return worldP;
}

type Who = "ADMIN_SA" | "SELLER" | "BUYER";
const whoOf = (route: string): Who => (route.startsWith("/admin") || route.startsWith("/super-admin") ? "ADMIN_SA" : route.startsWith("/seller") ? "SELLER" : "BUYER");
async function ctxFor(browser: Browser, who: Who, w: World, vp = { width: 1280, height: 800 }) {
  if (who === "ADMIN_SA") return viewerContext(browser, "SUPER_ADMIN", vp);
  const user = who === "SELLER" ? w.seller.user : w.buyer;
  return viewerContext(browser, "GUEST", { ...vp, storageState: await user.api.ctx.storageState() });
}

const routes = listAppRoutes();

test.describe("crawl: every page", () => {
  for (const route of routes) {
    test(route, async ({ browser }) => {
      const w = await world();
      const url = fillRoute(route, w.ids).replace(/\[slug\]/, w.seller.productId);
      const { context, page } = await ctxFor(browser, whoOf(route), w);
      const errors: string[] = [];
      const fiveXX: string[] = [];
      const fourXX: string[] = [];
      page.on("console", (m) => {
        if (m.type() !== "error") return;
        const t = m.text();
        if (CONSOLE_ALLOW.some((a) => a.re.test(t))) { if (/status of 4/.test(t)) fourXX.push(`${route} :: ${m.location().url}`); return; }
        errors.push(t.slice(0, 300));
      });
      page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 300)}`));
      page.on("response", (r) => { if (r.status() >= 500) fiveXX.push(`${r.status()} ${r.request().method()} ${r.url()}`); });
      const inflight = trackInflight(page);
      const res = await page.goto(url, { waitUntil: "domcontentloaded" });
      expect(res?.status(), "document status").toBeLessThan(400);
      await settleAfterGoto(page);
      await waitQuiet(page, inflight);
      const body = (await page.locator("body").innerText()).trim();
      expect(body.length, "blank page").toBeGreaterThan(20);
      expect(body).not.toMatch(/Application error|This page couldn.t load/);
      if (fourXX.length) { fs.mkdirSync(REPORT_DIR, { recursive: true }); fs.appendFileSync(path.join(REPORT_DIR, "crawl-4xx.jsonl"), JSON.stringify({ route, fallbackId: FALLBACK.has(route), calls: [...new Set(fourXX)] }) + "\n"); }
      expect(fiveXX, "HTTP 5xx").toEqual([]);
      expect(errors, "console / page errors").toEqual([]);
      await context.close();
    });
  }
});

// ---------------------------------------------------------------------------------------------------------------
// Menu links: header, footer, admin sidebar, seller sidebar -> no 404 / 5xx
// ---------------------------------------------------------------------------------------------------------------
async function menuHrefs(page: Page, selector: string): Promise<string[]> {
  return page.locator(selector).evaluateAll((as) => [...new Set(as.map((a) => (a as HTMLAnchorElement).getAttribute("href") ?? ""))]
    .filter((h) => h.startsWith("/") && !h.startsWith("//")));
}
async function expectLinksAlive(page: Page, hrefs: string[], label: string) {
  expect(hrefs.length, `${label}: found links`).toBeGreaterThan(0);
  const dead: string[] = [];
  for (const h of hrefs) {
    const r = await page.request.get(h, { maxRedirects: 5 });
    if (r.status() >= 400) dead.push(`${h} -> ${r.status()}`);
  }
  expect(dead, `${label}: dead links`).toEqual([]);
}

test.describe("menu links", () => {
  test("storefront header + footer as guest", async ({ browser }) => {
    const { context, page } = await viewerContext(browser, "GUEST");
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await settleAfterGoto(page);
    await expectLinksAlive(page, await menuHrefs(page, "header a[href], footer a[href]"), "guest header/footer");
    await context.close();
  });
  test("storefront header + footer + user menu as buyer", async ({ browser }) => {
    const w = await world();
    const { context, page } = await ctxFor(browser, "BUYER", w);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await settleAfterGoto(page);
    await expectLinksAlive(page, await menuHrefs(page, "header a[href], footer a[href]"), "buyer header/footer");
    await context.close();
  });
  for (const role of ["SUPER_ADMIN", "ADMIN", "ACCOUNTANT", "CS", "WAREHOUSE"] as const) {
    test(`admin sidebar as ${role}`, async ({ browser }) => {
      const { context, page } = await viewerContext(browser, role);
      await page.goto("/admin", { waitUntil: "domcontentloaded" });
      await settleAfterGoto(page);
      await expectLinksAlive(page, await menuHrefs(page, "aside a[href]"), `${role} sidebar`);
      await context.close();
    });
  }
  test("seller sidebar", async ({ browser }) => {
    const w = await world();
    const { context, page } = await ctxFor(browser, "SELLER", w);
    await page.goto("/seller", { waitUntil: "domcontentloaded" });
    await settleAfterGoto(page);
    await expectLinksAlive(page, await menuHrefs(page, "aside a[href]"), "seller sidebar");
    await context.close();
  });
});

// ---------------------------------------------------------------------------------------------------------------
// axe: record only. Fails only for a critical violation that is not in the recorded baseline (e2e/support/axe-baseline.json).
// ---------------------------------------------------------------------------------------------------------------
const AXE_PAGES: Array<{ route: string; who: Who | "GUEST" }> = [
  { route: "/", who: "GUEST" }, { route: "/shop", who: "GUEST" }, { route: "/cart", who: "GUEST" }, { route: "/faqs", who: "GUEST" },
  { route: "/contact-us", who: "GUEST" }, { route: "/my-account", who: "GUEST" }, { route: "/my-account/register", who: "GUEST" },
  { route: "/account", who: "BUYER" }, { route: "/wallet", who: "BUYER" }, { route: "/orders", who: "BUYER" }, { route: "/orders/[id]", who: "BUYER" },
  { route: "/sub-accounts", who: "BUYER" }, { route: "/refunds", who: "BUYER" }, { route: "/checkout", who: "BUYER" },
  { route: "/seller", who: "SELLER" }, { route: "/seller/orders", who: "SELLER" }, { route: "/seller/rma", who: "SELLER" }, { route: "/seller/products", who: "SELLER" },
  { route: "/admin", who: "ADMIN_SA" }, { route: "/admin/orders", who: "ADMIN_SA" }, { route: "/admin/settings", who: "ADMIN_SA" },
  { route: "/admin/dividend/settlements", who: "ADMIN_SA" }, { route: "/admin/refund-cases", who: "ADMIN_SA" }, { route: "/admin/accounting-export", who: "ADMIN_SA" },
  { route: "/admin/shops", who: "ADMIN_SA" }, { route: "/admin/users", who: "ADMIN_SA" },
];
test("axe accessibility scan of the main pages (recorded in .report-extra/axe-summary.json)", async ({ browser }) => {
  test.setTimeout(300_000);
  const w = await world();
  const summary: Record<string, Array<{ id: string; impact: string | null | undefined; nodes: number }>> = {};
  for (const p of AXE_PAGES) {
    const { context, page } = p.who === "GUEST" ? await viewerContext(browser, "GUEST") : await ctxFor(browser, p.who, w);
    const inflight = trackInflight(page);
    await page.goto(fillRoute(p.route, w.ids), { waitUntil: "domcontentloaded" });
    await settleAfterGoto(page);
    await waitQuiet(page, inflight);
    const r = await new AxeBuilder({ page }).analyze();
    summary[p.route] = r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })).sort((a, b) => a.id.localeCompare(b.id));
    await context.close();
  }
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const totals: Record<string, number> = {};
  let nodes = 0;
  for (const v of Object.values(summary).flat()) { totals[v.impact ?? "none"] = (totals[v.impact ?? "none"] ?? 0) + 1; nodes += v.nodes; }
  fs.writeFileSync(path.join(REPORT_DIR, "axe-summary.json"), JSON.stringify({ pages: AXE_PAGES.length, violationsByImpact: totals, totalNodes: nodes, byPage: summary }, null, 2));
  console.log(`AXE: ${AXE_PAGES.length} pages, violations by impact ${JSON.stringify(totals)}, ${nodes} nodes -> e2e/.report-extra/axe-summary.json`);

  const baselineFile = path.join(__dirname, "..", "support", "axe-baseline.json");
  const baseline: string[] = fs.existsSync(baselineFile) ? JSON.parse(fs.readFileSync(baselineFile, "utf8")) : [];
  const critical = Object.entries(summary).flatMap(([route, vs]) => vs.filter((v) => v.impact === "critical").map((v) => `${route}|${v.id}`));
  expect(critical.filter((c) => !baseline.includes(c)), "critical axe violations not in the recorded baseline").toEqual([]);
});
