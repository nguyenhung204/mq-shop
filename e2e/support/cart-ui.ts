import type { Browser, BrowserContext, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { Api, apiAs, freshIp, ok } from "./api";
import { sql } from "./db";
import { WEB } from "./env";
import { createSellerWithSku, createUser, PNG, uniq, type TestSeller, type TestUser } from "./factory";
import { tr, type Locale } from "./money-inputs";

/**
 * Support for flows 19-23 (UI cart/checkout, RMA refund cases, identity in 3 languages, MLM/slot inputs, layout).
 * The oracles here are independent of the product code (BigInt on raw DB values, Intl only for the symbol/grouping of the language).
 */

export const INTL: Record<Locale, string> = { en: "en-US", vi: "vi-VN", "zh-TW": "zh-TW" };
/** TWD keeps cents (owner decision N2): 2 dp in the exact amount; fmtShown drops the .00 of a whole amount. */
export const DEC: Record<string, number> = { TWD: 2, VND: 0, MYR: 2, SGD: 2, USD: 2 };

export const REGIONS = [
  { id: "tw", code: "TW", cur: "TWD", lang: "zh-TW" as Locale },
  { id: "vn", code: "VN", cur: "VND", lang: "vi" as Locale },
  { id: "my", code: "MY", cur: "MYR", lang: "en" as Locale },
  { id: "sg", code: "SG", cur: "SGD", lang: "en" as Locale },
] as const;
export type RegionRow = (typeof REGIONS)[number];

/** integer hundredths of TWD from a decimal text (DB numeric(12,2) or typed price) */
export const toCents = (v: string | number): bigint => {
  const s = String(v).trim();
  const [w, f = ""] = s.split(".");
  return BigInt(w) * 100n + BigInt(f.padEnd(2, "0").slice(0, 2));
};
export const centsText = (c: bigint): string => `${c / 100n}.${String(c % 100n).padStart(2, "0")}`;

/**
 * Oracle: amount in `cur` of a TWD amount, as a decimal text with DEC[cur] decimals, round-half-up on the exact product
 * (twdCents x rate, rate = decimal text of the fx_rates row). Throws when the product is an exact tie at the display precision
 * (the product converts with floats, a tie is the only place where float and exact may differ: tests must not sit on one).
 */
export function displayAmount(twdCents: bigint, rate: string, cur: string): string {
  const d = BigInt(DEC[cur]);
  const [w, f = ""] = rate.split(".");
  const num = BigInt(w + f);
  const den = 10n ** BigInt(f.length);
  const n = twdCents * num * 10n ** d;
  const dn = 100n * den;
  if ((2n * n) % (2n * dn) === dn) throw new Error(`tie: ${twdCents} x ${rate} at ${cur}`);
  const scaled = (2n * n + dn) / (2n * dn);
  if (d === 0n) return String(scaled);
  const p = 10n ** d;
  return `${scaled / p}.${String(scaled % p).padStart(Number(d), "0")}`;
}

/** What the page shows for `amountText` (decimal text) in `cur` and `locale`. */
export function fmtShown(amountText: string, cur: string, locale: Locale): string {
  const wholeTwd = cur === "TWD" && /^-?\d+(?:\.0+)?$/.test(amountText);
  const nf = new Intl.NumberFormat(INTL[locale], { style: "currency", currency: cur, minimumFractionDigits: wholeTwd ? 0 : DEC[cur], maximumFractionDigits: DEC[cur] });
  return nf.format(amountText as unknown as number);
}
/** Shown text of a TWD amount (cents) in the currency of a region. */
export function shownOf(twdCents: bigint, cur: string, rate: string, locale: Locale): string {
  return fmtShown(displayAmount(twdCents, rate, cur), cur, locale);
}

/** SQL: latest rate row per quote currency (ground truth of the rates table, read only). */
export async function dbRate(cur: string, asOf?: Date | string): Promise<{ rate: string; effectiveAt: Date }> {
  const rows = asOf
    ? await sql<any>(`SELECT rate::text AS rate, effective_at FROM fx_rates WHERE base_currency='TWD' AND quote_currency=$1 AND effective_at = $2`, [cur, asOf])
    : await sql<any>(`SELECT rate::text AS rate, effective_at FROM fx_rates WHERE base_currency='TWD' AND quote_currency=$1 ORDER BY effective_at DESC LIMIT 1`, [cur]);
  const r = rows[0];
  if (!r) throw new Error(`no fx row for ${cur}`);
  return { rate: String(r.rate).replace(/0+$/, "").replace(/\.$/, ""), effectiveAt: r.effective_at };
}

/* ------------------------------------------------------------------ seller with a 2-variant product */

export interface Variant { id: string; sku: string; price: string; options: Record<string, string>; label: string }
export interface VariantShop { seller: TestSeller; productId: string; productTitle: string; variants: Variant[]; warehouseCode: string }

/**
 * Shop (seller) + ONE product with two SKUs of different prices (variant S 1234.00 TWD, M 2350.50 TWD by default), both stocked.
 * Built on createSellerWithSku (shop, warehouse, approvals); the two-SKU product is created through the same real API.
 */
export async function createVariantShop(prices: [string, string] = ["1234.00", "2350.50"], stock = 40, opts_: { countryCodes?: string[] } = {}): Promise<VariantShop> {
  const seller = await createSellerWithSku({ unitPrice: "1000.00", stock: 1, prefix: "cartseller" });
  const api = seller.user.api;
  const whs = await ok<any>(await api.get("inventory/warehouses"));
  const wh = (whs.items ?? whs)[0];
  const warehouseCode: string = wh.code;
  const sa = await apiAs("SUPER_ADMIN");
  const title = uniq("Tee");
  const skus = [uniq("SKUS").toUpperCase(), uniq("SKUM").toUpperCase()];
  const opts = [{ Size: "S" }, { Size: "M" }];
  const product = await ok<any>(
    await api.post("products", {
      title,
      description: "e2e two variants",
      categoryId: "cat-electronics",
      // observation: without countryCodes the product is listed as VN only and every non-VN buyer gets the cross-border warning modal (not tested here)
      countryCodes: opts_.countryCodes ?? ["TW", "VN", "MY", "SG"],
      variants: skus.map((sku, i) => ({ sku, sellingPrice: prices[i], options: opts[i] })),
    }),
  );
  const productId: string = product.id ?? product.product?.id;
  await ok(await sa.post(`admin/products/${productId}/approve`));
  const list = await ok<any>(await api.get(`inventory/variants?productId=${productId}`));
  const items: any[] = list.items ?? list;
  const variants: Variant[] = skus.map((sku, i) => ({
    id: items.find((v) => v.sku === sku).id,
    sku,
    price: prices[i],
    options: opts[i],
    label: Object.entries(opts[i]).map(([k, v]) => `${k}: ${v}`).join(" · "),
  }));
  const slip = await ok<any>(await api.post("inventory/slips", { type: "IN", warehouseCode, items: skus.map((sku) => ({ sku, quantity: stock })) }));
  await ok(await sa.post(`admin/inventory/slips/${slip.id ?? slip.slip?.id}/approve`));
  return { seller, productId, productTitle: title, variants, warehouseCode };
}

/** A buyer whose account region is `code` (PATCH users/me/region, the same call the UI makes). */
export async function buyerInRegion(code: string, prefix = "cartbuyer"): Promise<TestUser> {
  const u = await createUser({ prefix });
  await ok(await u.api.patch("users/me/region", { regionCode: code }));
  return u;
}

/* ------------------------------------------------------------------ browser */

/** Page of `who` (cookies copied) with UI language, stored region and viewport fixed, own client IP (throttler). */
export async function uiAs(
  browser: Browser,
  who: { api: Api },
  o: { lang?: Locale; region?: string | null; width?: number; height?: number } = {},
): Promise<{ page: Page; context: BrowserContext; health: Health }> {
  const storageState = await who.api.ctx.storageState();
  const context = await browser.newContext({
    storageState,
    baseURL: WEB,
    viewport: { width: o.width ?? 1280, height: o.height ?? 900 },
    extraHTTPHeaders: { "x-forwarded-for": freshIp() },
  });
  await context.addInitScript(([lang, region]) => {
    try { if (lang) localStorage.setItem("mq-lang", lang as string); if (region) localStorage.setItem("mq-region", region as string); } catch { /* ignore */ }
  }, [o.lang ?? "en", o.region ?? null]);
  const page = await context.newPage();
  return { page, context, health: watchHealth(page) };
}

export interface Health {
  /** console errors / uncaught page errors / HTTP >= 500 seen so far */
  problems: string[];
  /** every API response status >= 400 (4xx are allowed by design in some steps; test asserts on them) */
  clientErrors: string[];
  assertClean(label?: string): void;
}
/** Collects console errors, page errors and 5xx responses of the app and the API. */
export function watchHealth(page: Page): Health {
  const problems: string[] = [];
  const clientErrors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") problems.push(`console.error: ${m.text().slice(0, 300)}`); });
  page.on("pageerror", (e) => problems.push(`pageerror: ${String(e.message).slice(0, 300)}`));
  page.on("response", (r) => {
    const u = r.url();
    if (!(u.includes(":3005/") || u.includes(":3000/"))) return;
    if (r.status() >= 500) problems.push(`HTTP ${r.status()} ${r.request().method()} ${u}`);
    else if (r.status() >= 400) clientErrors.push(`HTTP ${r.status()} ${r.request().method()} ${u}`);
  });
  return {
    problems,
    clientErrors,
    assertClean(label = "page") {
      // Chrome logs every 4xx/aborted fetch as a console error: those are reported through clientErrors, so drop the generic line
      const real = problems.filter((p) => !/Failed to load resource: the server responded with a status of 4\d\d/.test(p));
      expect(real, `${label}: console errors / page errors / 5xx`).toEqual([]);
    },
  };
}

/* ------------------------------------------------------------------ PDP / cart / checkout steps */

/** On /product/<id>: pick the variant by its label, set the quantity, press Add to Cart. */
export async function addVariantToCart(page: Page, locale: Locale, productId: string, v: Variant, qty: number): Promise<void> {
  const count = () => page.evaluate(() => (JSON.parse(localStorage.getItem("mq-cart-v2") ?? "{}")?.state?.items ?? []).reduce((n: number, i: any) => n + i.quantity, 0) as number);
  await page.goto(`/product/${productId}`);
  const before = await count();
  await page.getByRole("button", { name: v.label, exact: true }).click();
  const q = page.getByRole("group", { name: tr(locale, "cart.quantity") }).getByRole("textbox");
  await q.fill(String(qty));
  await q.press("Enter");
  await expect(q).toHaveValue(String(qty));
  await page.getByRole("button", { name: tr(locale, "common.addToCart"), exact: true }).first().click(); // first = the product actions, the cards below are related products
  await expect.poll(count, { message: "cart store gained the quantity" }).toBe(before + qty);
}

/** Fills the checkout form (name is prefilled from the profile) with a real province pick; returns the chosen city text. */
export async function fillCheckoutAddress(page: Page, o: { phone?: string; line1?: string } = {}): Promise<{ city: string; line1: string; phone: string }> {
  const city = page.locator("#city");
  await expect(city).toBeVisible();
  // the province control is a <select> while the region data loads and may turn into plain text inputs (a country without data):
  // decide from the element as it is NOW, never from an earlier look
  let cityValue = "";
  await expect.poll(async () => {
    const st = await city.evaluate((e: any) => (e.tagName === "SELECT" ? (e.options.length > 1 ? "select" : "loading") : "input")).catch(() => "loading");
    if (st === "select") { await city.selectOption({ index: 1 }); cityValue = await city.evaluate((e: any) => e.options[e.selectedIndex].text).catch(() => ""); return cityValue ? "done" : "loading"; }
    if (st === "input") { await city.fill("Taipei"); cityValue = "Taipei"; return "done"; }
    return "loading";
  }, { message: "city control ready" }).toBe("done");
  const line1 = o.line1 ?? "1 Test Road";
  await page.locator("#line1").fill(line1);
  const phone = o.phone ?? "912345678";
  await page.locator("#phone").fill(phone);
  return { city: cityValue, line1, phone };
}

export async function attachProof(page: Page): Promise<void> {
  await page.locator("#checkout-payment-proof").setInputFiles({ name: "proof.png", mimeType: "image/png", buffer: PNG });
}

/** The value cell of a row of the checkout summary/cart bar, found by its label. */
export function rowValue(scope: ReturnType<Page["locator"]>, label: string) {
  return scope.getByText(label, { exact: true }).first().locator("xpath=..");
}

export { createUser };
