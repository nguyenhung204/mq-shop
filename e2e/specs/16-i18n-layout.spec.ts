import { test, expect, type Browser } from "@playwright/test";
import type { RoleName } from "../support/env";
import { createSellerWithSku, createUser, deliverOrder, placeOrder, type TestSeller, type TestUser } from "../support/factory";
import { discoverIds, fillRoute, findRawKeys, overflowOf, settleAfterGoto, trackInflight, viewerContext, visibleTextOf, waitQuiet, type Lang, type RealIds, type Viewer } from "../support/perm-ui";

/**
 * FLOW 16 — i18n + layout of the pages added by C1-C5 (and wallet / checkout / order detail), in en, vi, zh-TW,
 * on a phone (390 px) and a desktop (1280 px).
 *
 * Checks per page/lang/viewport:
 *  1. the page rendered (guard opened, body has text, no "Application error");
 *  2. no raw translation key in the visible text or in placeholder/aria-label/title/alt:
 *     a token that IS a key of en/vi/zh-TW, or a lower-camel a.b.c token (>= 3 segments), see findRawKeys + RAW_KEY_ALLOWLIST in support/perm-ui.ts
 *     (emails and URLs are stripped first);
 *  3. layout: document.scrollWidth <= clientWidth, and no heading/button/link/input/table sticks out of the viewport
 *     unless a narrower scroll container clips it or it sits in an off-canvas drawer (overflowOf).
 *
 * Viewer per page: the role that is meant to use it (seed storage states); pages of a seller / buyer with data use factory accounts.
 */
interface PageSpec { route: string; who: Viewer | "SELLER_SHOP" | "BUYER_WORLD"; lang?: null }
const PAGES: PageSpec[] = [
  { route: "/admin/settings", who: "SUPER_ADMIN" },
  { route: "/admin/dividend/rates", who: "SUPER_ADMIN" },
  { route: "/admin/dividend/slots", who: "SUPER_ADMIN" },
  { route: "/admin/dividend/settlements", who: "ACCOUNTANT" },
  { route: "/admin/dividend/settlements/[quarter]", who: "ACCOUNTANT" },
  { route: "/admin/dividend/report", who: "ACCOUNTANT" },
  { route: "/admin/refund-cases", who: "ACCOUNTANT" },
  { route: "/admin/refund-cases/[id]", who: "ACCOUNTANT" },
  { route: "/admin/accounting-export", who: "ACCOUNTANT" },
  { route: "/admin/backups", who: "SUPER_ADMIN" },
  { route: "/admin/fx-rates", who: "SUPER_ADMIN" },
  { route: "/admin/accounts/[id]/sub-accounts", who: "SUPER_ADMIN" },
  { route: "/sub-accounts", who: "BUYER_WORLD" },
  { route: "/refunds", who: "BUYER_WORLD" },
  { route: "/seller/refunds", who: "SELLER_SHOP" },
  { route: "/seller/rma", who: "SELLER_SHOP" },
  { route: "/dividend-credits", who: "BUYER_WORLD" },
  { route: "/my-account/verify-otp", who: "GUEST" },
  { route: "/my-account/decline-sub-account", who: "GUEST" },
  { route: "/", who: "GUEST" },
  { route: "/wallet", who: "BUYER_WORLD" },
  { route: "/checkout", who: "BUYER_WORLD" },
  { route: "/orders/[id]", who: "BUYER_WORLD" },
];
const LANGS: Lang[] = ["en", "vi", "zh-TW"];
const VIEWPORTS = [{ name: "phone", width: 390, height: 844 }, { name: "desktop", width: 1280, height: 800 }];

interface World { ids: RealIds; seller: TestSeller; buyer: TestUser; orderId: string }
let worldP: Promise<World> | null = null;
/** One world per worker process: a shop seller, a buyer with a delivered order. Read-only for the tests. */
function world(): Promise<World> {
  worldP ??= (async () => {
    const ids = await discoverIds();
    const seller = await createSellerWithSku({ prefix: "i18nS" });
    const buyer = await createUser({ prefix: "i18nB" });
    const order = await placeOrder(buyer, seller, 1);
    await deliverOrder(seller, order.id);
    return { ids, seller, buyer, orderId: order.id };
  })();
  return worldP;
}

async function open(browser: Browser, spec: PageSpec, lang: Lang, vp: { width: number; height: number }) {
  const w = await world();
  const opts = { lang, width: vp.width, height: vp.height };
  if (spec.who === "SELLER_SHOP") return viewerContext(browser, "GUEST", { ...opts, storageState: await w.seller.user.api.ctx.storageState() });
  if (spec.who === "BUYER_WORLD") return viewerContext(browser, "GUEST", { ...opts, storageState: await w.buyer.api.ctx.storageState() });
  return viewerContext(browser, spec.who as RoleName | "GUEST", opts);
}

for (const spec of PAGES) {
  for (const lang of LANGS) {
    for (const vp of VIEWPORTS) {
      test(`${spec.route} [${lang}] ${vp.name} ${vp.width}px`, async ({ browser }) => {
        const w = await world();
        const ids: RealIds = { ...w.ids, values: { ...w.ids.values, order: w.orderId } };
        const url = fillRoute(spec.route, ids);
        const { context, page } = await open(browser, spec, lang, vp);
        const inflight = trackInflight(page);
        await page.goto(url, { waitUntil: "domcontentloaded" });
        await settleAfterGoto(page);
        await waitQuiet(page, inflight);

        const text = await visibleTextOf(page);
        expect(text.trim().length, "page is not blank").toBeGreaterThan(20);
        expect(text).not.toMatch(/Application error|This page couldn.t load/);
        expect(findRawKeys(text), `raw translation keys on ${url} [${lang}]`).toEqual([]);

        const ov = await overflowOf(page);
        expect(ov.scrollOverflow, `horizontal scroll on ${url} at ${vp.width}px`).toBeLessThanOrEqual(0);
        expect(ov.offenders, `elements outside the ${vp.width}px viewport on ${url}`).toEqual([]);
        await context.close();
      });
    }
  }
}

test("the region/language gate shows no raw keys and fits the phone (guest, nothing stored)", async ({ browser }) => {
  for (const vp of VIEWPORTS) {
    const { context, page } = await viewerContext(browser, "GUEST", { lang: null, region: null, width: vp.width, height: vp.height });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".mq-lang-gate")).toBeVisible();
    const text = await visibleTextOf(page);
    expect(findRawKeys(text)).toEqual([]);
    const ov = await overflowOf(page);
    expect(ov.scrollOverflow, `gate scroll at ${vp.width}px`).toBeLessThanOrEqual(0);
    expect(ov.offenders).toEqual([]);
    await context.close();
  }
});
