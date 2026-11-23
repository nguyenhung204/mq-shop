import { test, expect } from "@playwright/test";
import { apiAs, ok } from "../support/api";
import { sql } from "../support/db";
import { displayCents } from "../support/currency";
import { tr } from "../support/money-inputs";
import {
  INTL, REGIONS, addVariantToCart, attachProof, buyerInRegion, centsText, createVariantShop, dbRate, fillCheckoutAddress,
  fmtShown, rowValue, shownOf, toCents, uiAs, type VariantShop,
} from "../support/cart-ui";

/**
 * FLOW 19 - ordering THROUGH THE CART IN THE UI (product page -> cart -> checkout -> order page) for the display currencies of the
 * four business regions TW/VND... (TWD, VND, MYR, SGD). USD has no region (lib/i18n/regions.ts: "us is NOT a business region"), so
 * it cannot be chosen in the cart UI: USD is covered by the API in 05-order-currency.spec.ts and by the order-page test below.
 *
 * Product facts used (sources: handover-docs, checkout.service.ts read as the spec of record, flows-audit H-04):
 *  - shipping = flat 5.00 TWD per order; total = subtotal + shipping; all ledger amounts are TWD numeric(12,2).
 *  - display currency = currency of the account's region; display amount = round-half-up(TWD x rate) (TWD/VND 0 dp, MYR/SGD 2 dp).
 *  - the order stores the rate and fx_as_of that were current at checkout and display_total = round2(total x rate): that is what the
 *    buyer must pay (payableAmount) and it never moves afterwards.
 *  - promotions (MK-02..05) do NOT change the checkout price (flows-audit H-04; business-rules "out of MVP"; open finding, no owner decision recorded).
 *
 * Oracle: BigInt on the raw DB rows (fx_rates, orders, order_items), independent of lib/fx and of the backend money util.
 * Cart: two lines of ONE two-variant product (S 1234.00 TWD x1, M 2350.50 TWD x2) => subtotal 5935.00, shipping 5.00, total 5940.00 TWD.
 */
test.describe.configure({ timeout: 240_000 });
test.use({ actionTimeout: 20_000 }); // a wrong selector fails in 20 s, not at the test timeout

const QTY_S = 1;
const QTY_M = 2;

test.describe("19 cart -> checkout -> order (UI)", () => {
  test.describe.configure({ mode: "serial" });
  let shop: VariantShop;
  let promoId: string;

  test.beforeAll(async () => {
    shop = await createVariantShop(["1234.00", "2350.50"], 60);
    // an ACTIVE seller promotion on variant M (10% off): by spec it should lower the price, by H-04 the checkout ignores it
    const api = shop.seller.user.api;
    const promo = await ok<any>(
      await api.post("promotions", {
        name: "E2E 10% on M",
        type: "PERCENT",
        discountValue: "10",
        startAt: new Date(Date.now() - 86_400_000).toISOString(),
        endAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
        skus: [shop.variants[1].sku],
      }),
    );
    promoId = promo.id ?? promo.promotion?.id;
    const sa = await apiAs("SUPER_ADMIN");
    await ok(await sa.post(`admin/promotions/${promoId}/approve`));
  });

  for (const r of REGIONS) {
    test(`${r.code} (${r.cur}, UI ${r.lang}): PDP variants -> cart -> checkout -> order, every shown amount = oracle = DB`, async ({ browser }) => {
      const [S, M] = shop.variants;
      const buyer = await buyerInRegion(r.code, `cart${r.code.toLowerCase()}`);
      const { page, context, health } = await uiAs(browser, buyer, { lang: r.lang, region: r.id });
      try {
        const rate = await dbRate(r.cur);
        const rateText = r.cur === "TWD" ? "1" : rate.rate;
        const shown = (c: bigint) => shownOfSafe(c, r.cur, rateText, r.lang);
        const cS = toCents(S.price);
        const cM = toCents(M.price);
        const subC = cS * BigInt(QTY_S) + cM * BigInt(QTY_M);
        const shipC = 500n;
        const totC = subC + shipC;
        expect(centsText(subC)).toBe("5935.00");

        const stockBefore = await stockOf([S.id, M.id]);

        // 1. product page: the price of the selected variant is shown in the region currency, then add both variants
        await page.goto(`/product/${shop.productId}`);
        await page.getByRole("button", { name: M.label, exact: true }).click();
        await expect(page.getByRole("heading", { level: 1 }).first()).toContainText(shop.productTitle);
        await expect(page.locator("span.text-2xl").first()).toHaveText(shown(cM)); // promotion 10% on M is NOT applied (H-04)
        await page.getByRole("button", { name: S.label, exact: true }).click();
        await expect(page.locator("span.text-2xl").first()).toHaveText(shown(cS));
        await addVariantToCart(page, r.lang, shop.productId, M, QTY_M);
        await addVariantToCart(page, r.lang, shop.productId, S, QTY_S);

        // 2. cart: lines, selection, subtotal
        await page.goto("/cart");
        const lineM = page.locator("li").filter({ has: page.getByText("M", { exact: true }) }).filter({ hasText: shown(cM * BigInt(QTY_M)) });
        const lineS = page.locator("li").filter({ has: page.getByText("S", { exact: true }) }).filter({ hasText: shown(cS) });
        await expect(lineM).toHaveCount(1);
        await expect(lineS).toHaveCount(1);
        await expect(lineM).toContainText(shown(cM)); // unit price
        await expect(lineM.locator("input[aria-label]").last()).toHaveValue(String(QTY_M));
        const bar = page.locator("div.fixed.bottom-0");
        await expect(bar).toContainText(tr(r.lang, "cart.selectedCount", { count: String(QTY_S + QTY_M) }));
        await expect(bar).toContainText(shown(subC));
        // unselect the small one: count and subtotal follow
        await lineS.locator("input[type=checkbox]").uncheck();
        await expect(bar).toContainText(tr(r.lang, "cart.selectedCount", { count: String(QTY_M) }));
        await expect(bar).toContainText(shown(cM * BigInt(QTY_M)));
        await lineS.locator("input[type=checkbox]").check();
        await expect(bar).toContainText(tr(r.lang, "cart.selectedCount", { count: "3" }));
        await expect(bar).toContainText(shown(subC));
        await bar.getByRole("button", { name: `${tr(r.lang, "cart.checkout")} (3)` }).click();
        await page.waitForURL(/\/checkout/);

        // 3. checkout: summary before placing = oracle
        const addr = await fillCheckoutAddress(page);
        await attachProof(page);
        const aside = page.locator("aside");
        await expect(rowValue(aside, tr(r.lang, "cart.shipping"))).toContainText(shown(shipC), { timeout: 15_000 });
        await expect(rowValue(aside, tr(r.lang, "cart.subtotal"))).toContainText(shown(subC));
        await expect(rowValue(aside, tr(r.lang, "cart.total"))).toContainText(shown(totC));
        if (r.cur !== "TWD") await expect(aside).toContainText(r.cur); // "estimate in {currency}" note
        const submit = page.getByRole("button", { name: tr(r.lang, "checkout.placeOrder"), exact: true });
        await expect(submit).toBeEnabled();

        const created = page.waitForResponse((x) => x.url().endsWith("/orders/checkout") && x.request().method() === "POST");
        await submit.click();
        const res = await created;
        expect(res.status(), await res.text()).toBe(201);
        const body = (await res.json()).data;
        const orderId: string = (body.order ?? body).id;
        await expect(page.getByText(tr(r.lang, "checkout.thankYou"))).toBeVisible();

        // 4. DB truth vs oracle
        const [o] = await sql<any>(`SELECT * FROM orders WHERE id = $1`, [orderId]);
        expect(o.buyer_id).toBe(buyer.id);
        expect(o.shop_id).toBe(shop.seller.shopId);
        expect(o.subtotal).toBe(centsText(subC));
        expect(o.shipping_fee).toBe("5.00");
        expect(o.total).toBe(centsText(totC));
        expect(o.currency).toBe("TWD");
        expect(o.region_code).toBe(r.code);
        expect(o.payment_method).toBe("OFF_PLATFORM");
        expect(o.status).toBe("PENDING");
        expect(o.display_currency).toBe(r.cur);
        // locked rate = the rates row that was current (same instant as fx_as_of), not "today's"
        const locked = await dbRate(r.cur, o.fx_as_of);
        expect(toDecimal8(o.fx_rate)).toBe(toDecimal8(locked.rate));
        expect(o.display_total).toBe(centsText(displayCents(totC, locked.rate)));
        expect(o.payment_proof_url).toBeTruthy();
        const addrRow = JSON.parse(o.shipping_address);
        expect(addrRow).toMatchObject({ country: r.code, line1: addr.line1, city: addr.city });
        const items = await sql<any>(`SELECT variant_id, unit_price, quantity, line_total, sku FROM order_items WHERE order_id = $1 ORDER BY unit_price`, [orderId]);
        expect(items.map((i) => [i.variant_id, i.unit_price, i.quantity, i.line_total])).toEqual([
          [S.id, "1234.00", QTY_S, "1234.00"],
          [M.id, "2350.50", QTY_M, "4701.00"], // list price: the active 10% promotion on M did not reduce it (H-04)
        ]);
        // stock reserved
        const stockAfter = await stockOf([S.id, M.id]);
        expect(stockAfter[S.id].reserved - stockBefore[S.id].reserved).toBe(QTY_S);
        expect(stockAfter[M.id].reserved - stockBefore[M.id].reserved).toBe(QTY_M);
        expect(stockBefore[M.id].available - stockAfter[M.id].available).toBe(QTY_M);

        // 5. thank-you box and the order page show the amount to pay in the region currency with the locked rate
        const payableText = fmtShown(centsDecimalAt(o.display_total, r.cur), r.cur, r.lang);
        await expect(page.locator("[data-payable]")).toContainText(payableText);
        const cartAfter = await page.evaluate(() => (JSON.parse(localStorage.getItem("mq-cart-v2") ?? "{}")?.state?.items ?? []).length);
        expect(cartAfter).toBe(0);
        await page.goto(`/orders/${orderId}`);
        const box = page.locator("[data-payable]");
        await expect(box).toContainText(payableText);
        if (r.cur !== "TWD") {
          const lockedTxt = `1 TWD = ${new Intl.NumberFormat(INTL[r.lang], { maximumFractionDigits: 6 }).format(Number(locked.rate))} ${r.cur}`;
          await expect(box).toContainText(lockedTxt);
        }
        const api = await ok<any>(await buyer.api.get(`orders/${orderId}`));
        const ord = api.order ?? api;
        expect(ord.total).toBe(5940);
        expect(ord.payableCurrency).toBe(r.cur);
        expect(centsText(BigInt(Math.round(ord.payableAmount * 100)))).toBe(o.display_total);
        health.assertClean(`${r.code} cart flow`);
      } finally {
        await context.close();
      }
    });
  }

  test("an active promotion on a SKU does not change the checkout price (known issue H-04, recorded not judged)", async () => {
    test.info().annotations.push({
      type: "known-issue",
      description: "H-04 (flows-audit): promotions/vouchers never change the price at checkout; order_items.unit_price = variants.selling_price. business-rules.md calls it out of MVP; no owner decision recorded: OPEN finding, behaviour pinned as it is.",
    });
    const [p] = await sql<any>(`SELECT status, type, discount_value::text AS v FROM promotions WHERE id = $1`, [promoId]);
    expect(p).toMatchObject({ status: "ACTIVE", type: "PERCENT" });
    expect(p.v).toBe("10.00");
    const b = await buyerInRegion("TW", "promoapi");
    const o = await ok<any>(
      await b.api.post("orders/checkout", {
        items: [{ variantId: shop.variants[1].id, quantity: 1 }],
        shippingAddress: { fullName: "E2E", phone: "0900000000", line1: "1 Test Road", city: "Taipei", country: "TW" },
        paymentMethod: "OFF_PLATFORM",
      }),
    );
    const order = o.order ?? o;
    expect(order.total).toBe(2355.5); // 2350.50 + 5.00, no discount line
    const [row] = await sql<any>(`SELECT subtotal::text AS s, total::text AS t FROM orders WHERE id = $1`, [order.id]);
    expect([row.s, row.t]).toEqual(["2350.50", "2355.50"]);
  });

  test("TWD amount with cents (2350.50): product page, cart and 'amount to pay' show the exact ledger amount, not a rounded one", async ({ browser }) => {
    // Spec: ledger amounts are TWD numeric(12,2) and "the buyer pays displayTotal" (payable-amount.ts doc: 2 dp). A buyer told to pay a
    // rounded NT$2,356 for an order of 2355.50 would pay 0.50 more than the shop's ledger says.
    const M = shop.variants[1];
    const b = await buyerInRegion("TW", "twdcents");
    const o = await ok<any>(
      await b.api.post("orders/checkout", {
        items: [{ variantId: M.id, quantity: 1 }],
        shippingAddress: { fullName: "E2E", phone: "0900000000", line1: "1 Test Road", city: "Taipei", country: "TW" },
        paymentMethod: "OFF_PLATFORM",
      }),
    );
    const orderId: string = (o.order ?? o).id;
    const [row] = await sql<any>(`SELECT total::text AS t, display_total::text AS dt FROM orders WHERE id = $1`, [orderId]);
    expect([row.t, row.dt]).toEqual(["2355.50", "2355.50"]);
    const exact = (v: string) => new Intl.NumberFormat("zh-TW", { style: "currency", currency: "TWD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v as unknown as number);
    const { page, context } = await uiAs(browser, b, { lang: "zh-TW", region: "tw" });
    try {
      const seen: Record<string, string> = {};
      await page.goto(`/product/${shop.productId}`);
      await page.getByRole("button", { name: M.label, exact: true }).click();
      seen.pdp = (await page.locator("span.text-2xl").first().innerText()).trim();
      await page.goto(`/orders/${orderId}`);
      seen.payable = (await page.locator("[data-payable] strong").innerText()).trim();
      const wants = { pdp: exact("2350.50"), payable: exact("2355.50") };
      test.info().annotations.push({ type: "observed", description: JSON.stringify({ seen, wants, dbTotal: row.t }) });
      expect.soft(seen.pdp, "product page price of a 2350.50 TWD variant").toBe(wants.pdp);
      expect.soft(seen.payable, "amount to pay of a 2355.50 TWD order").toBe(wants.payable);
    } finally {
      await context.close();
    }
  });

  test("USD (no region, API only): the order page shows the amount in USD at the locked rate; the cart UI has no USD", async ({ browser }) => {
    const [S] = shop.variants;
    const buyer = await buyerInRegion("TW", "cartusd");
    const fx = await ok<any>(await buyer.api.get("fx/rates"));
    const res = await ok<any>(
      await buyer.api.post("orders/checkout", {
        items: [{ variantId: S.id, quantity: 1 }],
        shippingAddress: { fullName: "E2E", phone: "0900000000", line1: "1 Test Road", city: "Taipei", country: "TW" },
        paymentMethod: "OFF_PLATFORM",
        displayCurrency: "USD",
        fxAsOf: fx.asOf,
      }),
    );
    const orderId: string = (res.order ?? res).id;
    const [o] = await sql<any>(`SELECT total::text AS t, display_currency, fx_rate::text AS fx, fx_as_of, display_total::text AS dt FROM orders WHERE id = $1`, [orderId]);
    const usd = await dbRate("USD", o.fx_as_of);
    expect(o.t).toBe("1239.00");
    expect(o.display_currency).toBe("USD");
    expect(o.dt).toBe(centsText(displayCents(123_900n, usd.rate)));
    for (const lang of ["en", "vi", "zh-TW"] as const) {
      const { page, context, health } = await uiAs(browser, buyer, { lang, region: "tw" });
      try {
        await page.goto(`/orders/${orderId}`);
        await expect(page.locator("[data-payable]")).toContainText(fmtShown(o.dt, "USD", lang));
        await expect(page.locator("[data-payable]")).toContainText(`1 TWD = ${new Intl.NumberFormat(INTL[lang], { maximumFractionDigits: 6 }).format(Number(usd.rate))} USD`);
        health.assertClean(`USD order page ${lang}`);
      } finally {
        await context.close();
      }
    }
  });
});

/** TWD is shown with its cents when it has any (rate 1: exact, no tie); other currencies use the rate oracle. */
function shownOfSafe(c: bigint, cur: string, rate: string, lang: "en" | "vi" | "zh-TW"): string {
  return shownOf(c, cur, rate, lang);
}
const toDecimal8 = (v: string): string => {
  const [w, f = ""] = String(v).split(".");
  return `${w}.${f.padEnd(8, "0").slice(0, 8)}`;
};
/** DB display_total (2 dp text) as the decimal text at the precision of the currency, round-half-up (what the order page prints). */
function centsDecimalAt(twoDp: string, cur: string): string {
  const c = toCents(twoDp);
  if (cur === "VND") return String((c * 2n + 100n) / 200n);
  return twoDp;
}
async function stockOf(variantIds: string[]): Promise<Record<string, { available: number; reserved: number }>> {
  // SQL: read-only ground truth of the stock counters
  const rows = await sql<any>(`SELECT variant_id, sum(available_stock)::int AS a, sum(reserved_stock)::int AS r FROM warehouse_inventories WHERE variant_id = ANY($1::uuid[]) GROUP BY variant_id`, [variantIds]);
  return Object.fromEntries(rows.map((r) => [r.variant_id, { available: r.a, reserved: r.r }]));
}
