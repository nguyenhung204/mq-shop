import { test, expect, type Browser } from "@playwright/test";
import { ok } from "../support/api";
import { deliverOrder, openRma } from "../support/factory";
import { caseOfOrder } from "../support/kit-flows-9-13";
import { uploadProof } from "../support/kit-flows-9-13";
import { addVariantToCart, buyerInRegion, createVariantShop, fillCheckoutAddress, uiAs, watchHealth, type VariantShop } from "../support/cart-ui";
import { fillRoute, findRawKeys, overflowOf, settleAfterGoto, trackInflight, viewerContext, visibleTextOf, waitQuiet, type Lang } from "../support/perm-ui";
import type { TestUser } from "../support/factory";

/**
 * FLOW 23 - the pages touched by flows 19-22, at 390 px (phone) and 1280 px (desktop) in en / vi / zh-TW:
 *  1. rendered (not blank, no "Application error");
 *  2. no raw translation key in the visible text / placeholder / aria-label / title / alt (support/perm-ui.findRawKeys);
 *  3. no horizontal page scroll and no heading/button/link/input sticking out of the viewport (overflowOf);
 *  4. NO console error, NO uncaught page error and NO HTTP 5xx from the app or the API (watchHealth); 4xx are listed in the test output
 *     (annotation) but allowed: a guest hitting an authenticated route legitimately gets 401.
 * Cart / checkout are opened with a real cart (two variants added through the product page) and the checkout also with the province chosen
 * and the bill attached (the state in which the summary and the place-order button are all on screen).
 */
test.describe.configure({ timeout: 120_000 });

interface World {
  shop: VariantShop;
  buyer: TestUser;
  orderA: string;
  orderB: string;
  rmaA: string;
  caseA: string;
  cartState: Awaited<ReturnType<import("@playwright/test").BrowserContext["storageState"]>>;
}
let worldP: Promise<World> | null = null;
async function world(browser: Browser): Promise<World> {
  worldP ??= (async () => {
    const shop = await createVariantShop(["1234.00", "2350.50"], 60);
    const buyer = await buyerInRegion("TW", "layoutbuyer");
    // two real orders of the buyer (OFF_PLATFORM, bill + confirm + delivered): A gets an RMA, B stays eligible for the RMA form
    const mk = async () => {
      const { order } = await checkoutPendingVariant(buyer, shop);
      await uploadProof(buyer, order.id);
      await ok(await shop.seller.user.api.post(`orders/${order.id}/payment/confirm`, {}));
      await deliverOrder(shop.seller, order.id);
      return order.id as string;
    };
    const orderA = await mk();
    const orderB = await mk();
    const rma = await openRma(buyer, orderA, "layout rma");
    // drive A's RMA to REFUND_PENDING through the API so a refund case (source RMA) exists for the admin case page
    const sellerApi = shop.seller.user.api;
    await ok(await sellerApi.post(`rma/${rma.id}/approve`, { refundAmount: "500.00" }));
    await ok(await buyer.api.post(`rma/${rma.id}/return-shipped`, { trackingCode: "TRK-LAYOUT", carrier: "E2E" }));
    await ok(await sellerApi.post(`rma/${rma.id}/return-received`, {}));
    await ok(await sellerApi.post(`rma/${rma.id}/accept-return`, {}));
    const caseA: string = (await caseOfOrder(buyer.api, orderA)).id;
    // a cart in a browser: add through the product page, keep cookies + localStorage as the storage state of every test
    const ui = await uiAs(browser, buyer, { lang: "en", region: "tw" });
    await addVariantToCart(ui.page, "en", shop.productId, shop.variants[1], 2);
    await addVariantToCart(ui.page, "en", shop.productId, shop.variants[0], 1);
    const cartState = await ui.context.storageState();
    await ui.context.close();
    return { shop, buyer, orderA, orderB, rmaA: rma.id, caseA, cartState };
  })();
  return worldP;
}
async function checkoutPendingVariant(buyer: TestUser, shop: VariantShop) {
  const res = await ok<any>(
    await buyer.api.post("orders/checkout", {
      items: [{ variantId: shop.variants[0].id, quantity: 1 }],
      shippingAddress: { fullName: "E2E Buyer", phone: "0900000000", line1: "1 Test Road", city: "Taipei", country: "TW" },
      paymentMethod: "OFF_PLATFORM",
    }),
  );
  return { order: res.order ?? res };
}

type Who = "BUYER" | "BUYER_CART" | "SELLER" | "SUPER_ADMIN" | "GUEST";
interface PageSpec { route: string; who: Who; prepare?: "checkout-filled" }
const PAGES: PageSpec[] = [
  { route: "/product/[product]", who: "BUYER" },
  { route: "/cart", who: "BUYER_CART" },
  { route: "/checkout", who: "BUYER_CART" },
  { route: "/checkout", who: "BUYER_CART", prepare: "checkout-filled" },
  { route: "/orders/[orderA]", who: "BUYER" },
  { route: "/orders/[orderB]/rma", who: "BUYER" },
  { route: "/rma", who: "BUYER" },
  { route: "/refunds", who: "BUYER" },
  { route: "/seller/rma", who: "SELLER" },
  { route: "/seller/refunds", who: "SELLER" },
  { route: "/admin/rma/[rmaA]", who: "SUPER_ADMIN" },
  { route: "/admin/refund-cases/[caseA]", who: "SUPER_ADMIN" },
  { route: "/admin/mlm", who: "SUPER_ADMIN" },
  { route: "/admin/dividend/slots", who: "SUPER_ADMIN" },
  { route: "/my-account", who: "GUEST" },
  { route: "/my-account/register", who: "GUEST" },
  { route: "/my-account/verify-otp", who: "GUEST" },
  { route: "/my-account/decline-sub-account", who: "GUEST" },
  { route: "/my-account/lost-password", who: "GUEST" },
  { route: "/sub-accounts", who: "BUYER" },
];
const LANGS: Lang[] = ["en", "vi", "zh-TW"];
const VIEWPORTS = [{ name: "phone", width: 390, height: 844 }, { name: "desktop", width: 1280, height: 800 }];

for (const spec of PAGES) {
  for (const lang of LANGS) {
    for (const vp of VIEWPORTS) {
      const title = `${spec.route}${spec.prepare ? " (" + spec.prepare + ")" : ""} [${lang}] ${vp.name} ${vp.width}px`;
      test(title, async ({ browser }) => {
        const w = await world(browser);
        const ids = { product: w.shop.productId, orderA: w.orderA, orderB: w.orderB, rmaA: w.rmaA, caseA: w.caseA } as Record<string, string>;
        const url = spec.route.replace(/\[(\w+)\]/g, (_, k) => ids[k] ?? fillRoute(`[${k}]`, {} as never));
        const opts = { lang, width: vp.width, height: vp.height };
        let ctx;
        if (spec.who === "BUYER_CART") ctx = await viewerContext(browser, "GUEST", { ...opts, storageState: w.cartState });
        else if (spec.who === "BUYER") ctx = await viewerContext(browser, "GUEST", { ...opts, storageState: await w.buyer.api.ctx.storageState() });
        else if (spec.who === "SELLER") ctx = await viewerContext(browser, "GUEST", { ...opts, storageState: await w.shop.seller.user.api.ctx.storageState() });
        else ctx = await viewerContext(browser, spec.who === "GUEST" ? "GUEST" : spec.who, opts);
        const { context, page } = ctx;
        const health = watchHealth(page);
        const inflight = trackInflight(page);
        await page.goto(url, { waitUntil: "domcontentloaded" });
        await settleAfterGoto(page);
        if (spec.prepare === "checkout-filled") {
          await fillCheckoutAddress(page);
          await page.locator("#checkout-payment-proof").setInputFiles({ name: "p.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64") });
          await expect(page.locator("aside")).toContainText(/\d/);
        }
        await waitQuiet(page, inflight);

        const text = await visibleTextOf(page);
        expect(text.trim().length, "page is not blank").toBeGreaterThan(20);
        expect(text).not.toMatch(/Application error|This page couldn.t load/);
        expect(findRawKeys(text), `raw translation keys on ${url} [${lang}]`).toEqual([]);
        const ov = await overflowOf(page);
        expect(ov.scrollOverflow, `horizontal scroll on ${url} at ${vp.width}px`).toBeLessThanOrEqual(0);
        expect(ov.offenders, `elements outside the ${vp.width}px viewport on ${url}`).toEqual([]);
        if (health.clientErrors.length) test.info().annotations.push({ type: "4xx-seen", description: health.clientErrors.slice(0, 5).join(" | ") });
        health.assertClean(title);
        await context.close();
      });
    }
  }
}
