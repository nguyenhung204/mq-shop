import { test, expect, type Page } from "@playwright/test";
import { createUser, createSellerWithSku, placeOrder, deliverOrder, openRma, decimalToCents } from "../support/factory";
import { getRma } from "../support/ui";
import { ok } from "../support/api";
import { LOCALES, pageIn, watchRequests, saveResults, row, tr, type Locale, type ResultRow } from "../support/money-inputs";

/**
 * FLOW 14 - money inputs, SHOP cells (RMA refund, seller promotions, SKU price, price filter, stock/quantity). Wallet cells: 14-money-inputs.spec.ts.
 *
 * RMA REFUND AMOUNT (seller /seller/rma -> Approve dialog). Validator: lib/rma/refund-amount.ts (ASCII only, NOT locale aware).
 *  Order total 1005.00 (1000 unit + 5 shipping) => cap 1005.00. Messages: admin.rmaPage.approveModal.errors.{invalid,zero,exceeds}.
 *  valid:   100, 100.5, 100.50, "  250.75  " (trimmed), "100<NBSP>" (trim removes NBSP), "1005" (== cap, full refund), blank (= refund everything left)
 *  zero:    0, 0.00                                 -> errors.zero
 *  exceeds: 1005.01, 1000001, 999999999999.99       -> errors.exceeds
 *  invalid: -5, -0, +5, 1e3, abc, 12abc, .5, 5., 100.555, 0.001, 1 000, NT$100, $50, 100d, NaN, Infinity, fullwidth digits, zero-width space,
 *           13 digits, 1,234.50 (en) and 1.234,50 / 100,5 (vi)  -> errors.invalid
 *  CLASSIFICATION: the audit says RMA "kept the standard" and lists it as locale-formatted in TEST-GUIDE 8.1. In reality it only takes plain ASCII
 *  (1,234.50 / 1.234,50 / fullwidth / 100,5 are refused with the generic "enter 250 or 250.50" message). Different from the document but SAFE
 *  (refused, never mis-read): recorded as "khac tai lieu, an toan", not a bug.
 */
test.describe.configure({ timeout: 240_000 });

const approveUrl = /\/rma\/[^/]+\/approve$/;

type RmaVerdict = { kind: "ok"; canonical: string | null } | { kind: "invalid" | "zero" | "exceeds" };
const CAP = 100500n;
function rmaVerdict(raw: string): RmaVerdict {
  const t = raw.trim();
  if (t === "") return { kind: "ok", canonical: null };
  const m = /^(\d{1,12})(?:\.(\d{1,2}))?$/.exec(t);
  if (!m) return { kind: "invalid" };
  const cents = BigInt(m[1] + (m[2] ?? "").padEnd(2, "0"));
  if (cents === 0n) return { kind: "zero" };
  if (cents > CAP) return { kind: "exceeds" };
  return { kind: "ok", canonical: `${m[1].replace(/^0+(?=\d)/, "") || "0"}.${(m[2] ?? "").padEnd(2, "0")}` };
}

/** [typed value, label]. The vi-only separators are included for every language (the validator ignores the language). */
const RMA_VALUES: Array<[string, string]> = [
  ["100", "100"], ["100.5", "100.5"], ["100.50", "100.50"], ["  250.75  ", "padded"], ["100 ", "NBSP"], ["1005", "cap"],
  ["0", "0"], ["0.00", "0.00"], ["-5", "-5"], ["-0", "-0"], ["+5", "+5"], ["1e3", "1e3"], ["abc", "abc"], ["12abc", "12abc"], [".5", ".5"],
  ["5.", "5."], ["100.555", "100.555"], ["0.001", "0.001"], ["1 000", "space inside"], ["NT$100", "NT$100"], ["$50", "$50"], ["100đ", "100d"],
  ["NaN", "NaN"], ["Infinity", "Infinity"], ["１２３．４５", "fullwidth"], ["1​00", "zero-width"], ["1000000000000", "13 digits"],
  ["1,234.50", "1,234.50 (en format)"], ["1.234,50", "1.234,50 (vi format)"], ["100,5", "100,5 (vi decimal)"],
  ["1005.01", "cap+0.01"], ["1000001", "1000001"], ["999999999999.99", "max"],
];

async function openDialog(page: Page, locale: Locale) {
  await page.goto("/seller/rma");
  await page.getByRole("button", { name: tr(locale, "seller.rmaPage.approve"), exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(tr(locale, "admin.rmaPage.approveModal.totalHint", { amount: "1005.00" }))).toBeVisible();
  return dialog;
}

for (const locale of LOCALES) {
  test(`RMA refund amount [${locale}]: rejected values show the exact message, keep the text and never call the API`, async ({ browser }) => {
    const seller = await createSellerWithSku({ unitPrice: "1000.00", prefix: "rma-bad" });
    const buyer = await createUser({ prefix: "rma-buyer" });
    const order = await placeOrder(buyer, seller);
    await deliverOrder(seller, order.id);
    const rma = await openRma(buyer, order.id);
    const { page, context } = await pageIn(browser, seller.user, locale);
    const reqs = watchRequests(page, "POST", approveUrl);
    const dialog = await openDialog(page, locale);
    const input = dialog.getByLabel(tr(locale, "admin.rmaPage.approveModal.amountLabel"));
    const submit = dialog.getByRole("button", { name: new RegExp(`${tr(locale, "admin.rmaPage.approveModal.confirmPartial")}|${tr(locale, "admin.rmaPage.approveModal.confirmFull")}`) });
    const rows: ResultRow[] = [];
    for (const [raw, label] of RMA_VALUES) {
      const v = rmaVerdict(raw);
      if (v.kind === "ok") continue;
      await input.fill(raw);
      const n0 = reqs.count();
      await submit.click();
      let msg = "(no message)";
      try { await dialog.getByRole("alert").first().waitFor({ state: "visible", timeout: 3000 }); msg = (await dialog.getByRole("alert").first().innerText()).trim(); } catch { /* none */ }
      const kept = (await input.inputValue()) === raw;
      row(rows, label, raw, `${tr(locale, `admin.rmaPage.approveModal.errors.${v.kind}`)} | kept=true | req=0`, `${msg} | kept=${kept} | req=${reqs.count() - n0}`, v.kind);
    }
    saveResults("rma/invalid", locale, rows);
    await context.close();
    expect((await getRma(seller.user.api, rma.id)).status).toBe("REQUESTED");
  });

  test(`RMA refund amount [${locale}]: accepted values are sent as 2-decimal strings and stored in cents`, async ({ browser }) => {
    const seller = await createSellerWithSku({ unitPrice: "1000.00", prefix: "rma-ok" });
    const buyer = await createUser({ prefix: "rma-buyer" });
    const { page, context } = await pageIn(browser, seller.user, locale);
    const rows: ResultRow[] = [];
    for (const [raw, label] of RMA_VALUES.filter(([r]) => { const v = rmaVerdict(r); return v.kind === "ok" && v.canonical !== null; })) {
      const v = rmaVerdict(raw) as Extract<RmaVerdict, { kind: "ok" }>;
      const order = await placeOrder(buyer, seller);
      await deliverOrder(seller, order.id);
      const rma = await openRma(buyer, order.id);
      const dialog = await openDialog(page, locale);
      await dialog.getByLabel(tr(locale, "admin.rmaPage.approveModal.amountLabel")).fill(raw);
      const resp = page.waitForResponse((r) => approveUrl.test(r.url()) && r.request().method() === "POST");
      await dialog.getByRole("button", { name: new RegExp(`${tr(locale, "admin.rmaPage.approveModal.confirmPartial")}|${tr(locale, "admin.rmaPage.approveModal.confirmFull")}`) }).click();
      const r = await resp;
      const body = JSON.parse(r.request().postData() ?? "{}");
      const stored = await getRma(seller.user.api, rma.id);
      row(rows, label, raw, `status=200 sent=${v.canonical} stored=${decimalToCents(v.canonical!)} status=APPROVED`, `status=${r.status()} sent=${body.refundAmount} stored=${decimalToCents(stored.refundAmount)} status=${stored.status}`);
    }
    saveResults("rma/valid", locale, rows);
    await context.close();
    void ok;
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// SELLER PROMOTIONS (discount % / fixed amount / budget). Errors appear in ONE banner (.mq-alert-error) at the top of the form, not under the field.
//  PERCENT discount : parseLocaleMoneyInput 2dp, >0, max 100  -> 100.5 = ABOVE_MAX(100)
//  FIXED discount   : 2dp, >0, max 9999999999.99 (numeric(12,2))  -> 10000000000.00 = ABOVE_MAX(9999999999.99)
//  budget (optional): 2dp, >0, max 999999999999.99 ; blank = no budget (valid)
//  Validation order in buildBody: name/dates/targets, then budget, then discount -> every other field is filled validly.
// ---------------------------------------------------------------------------------------------------------------------
import { sql } from "../support/db";
import { expectMoney, rawFor, centsOf, moneyMsg, VALUES, type MoneyProfile } from "../support/money-inputs";

const PROMO_PERCENT: MoneyProfile = { maxDec: 2, allowZero: false, allowNeg: false, max: 100 };
const PROMO_FIXED: MoneyProfile = { maxDec: 2, allowZero: false, allowNeg: false, max: 9999999999.99 };
const PROMO_BUDGET: MoneyProfile = { maxDec: 2, allowZero: false, allowNeg: false, max: 999999999999.99 };

async function openPromoForm(page: Page, locale: Locale, sku: string, type: "PERCENT" | "FIXED") {
  await page.goto("/seller/promotions");
  await page.getByRole("button", { name: tr(locale, "seller.promotions.newBtn") }).click();
  const form = page.locator("form").filter({ has: page.getByLabel(tr(locale, "seller.promotions.name"), { exact: true }) });
  await form.getByLabel(tr(locale, "seller.promotions.name"), { exact: true }).fill("E2E promo");
  await form.getByLabel(tr(locale, "seller.promotions.type")).selectOption(type);
  await form.getByLabel(tr(locale, "seller.promotions.start"), { exact: true }).fill("2027-03-01T10:00");
  await form.getByLabel(tr(locale, "seller.promotions.end"), { exact: true }).fill("2027-03-31T10:00");
  await form.getByRole("button", { name: tr(locale, "seller.promotions.addSku") }).click();
  await page.getByRole("option", { name: sku, exact: true }).click();
  return form;
}
const discountLabel = (locale: Locale, type: "PERCENT" | "FIXED") => tr(locale, type === "PERCENT" ? "seller.promotions.discountPct" : "seller.promotions.discountAmt");

for (const locale of LOCALES) {
  for (const [cellName, field, type, profile] of [
    ["promo-percent", "discount", "PERCENT", PROMO_PERCENT],
    ["promo-fixed", "discount", "FIXED", PROMO_FIXED],
    ["promo-budget", "budget", "PERCENT", PROMO_BUDGET],
  ] as const) {
    test(`promotion ${field} (${type}) [${locale}]: rejected values show the exact banner message, keep the text, no API call`, async ({ browser }) => {
      const seller = await createSellerWithSku({ prefix: "promo-bad" });
      const { page, context } = await pageIn(browser, seller.user, locale);
      const reqs = watchRequests(page, "POST", /\/promotions$/);
      const form = await openPromoForm(page, locale, seller.sku, type);
      const input = field === "budget" ? form.getByLabel(tr(locale, "seller.promotions.budget"), { exact: true }) : form.getByLabel(discountLabel(locale, type), { exact: true });
      if (field === "budget") await form.getByLabel(discountLabel(locale, type), { exact: true }).fill("10");
      const submit = form.getByRole("button", { name: tr(locale, "seller.promotions.submit") });
      const rows: ResultRow[] = [];
      for (const v of VALUES) {
        const exp = expectMoney(v, locale, profile);
        if (exp.ok) continue;
        if (field === "budget" && v.id === "blank spaces only") continue; // budget: blank = "no budget", valid
        if (field === "discount" && v.id === "blank spaces only") { /* required + non-empty text => parser EMPTY */ }
        const raw = rawFor(v, locale);
        await input.fill(raw);
        const n0 = reqs.count();
        await submit.click();
        let msg = "(no message)";
        try { await form.locator(".mq-alert-error").first().waitFor({ state: "visible", timeout: 3000 }); msg = (await form.locator(".mq-alert-error").first().innerText()).trim(); } catch { /* none */ }
        const kept = (await input.inputValue()) === raw;
        row(rows, v.id, raw, `${moneyMsg(locale, exp.code, { maxDecimals: 2, max: profile.max })} | kept=true | req=0`, `${msg} | kept=${kept} | req=${reqs.count() - n0}`, exp.code);
        await input.fill(""); // clears the banner state is not needed; the next fill replaces it
      }
      saveResults(`${cellName}/invalid`, locale, rows);
      await context.close();
      expect((await sql("select count(*)::int c from promotions where shop_id=$1", [seller.shopId]))[0].c).toBe(0);
    });
  }

  test(`promotion discount FIXED + budget [${locale}]: accepted values are sent canonical and stored exactly`, async ({ browser }) => {
    const seller = await createSellerWithSku({ prefix: "promo-ok" });
    const { page, context } = await pageIn(browser, seller.user, locale);
    const rows: ResultRow[] = [];
    for (const v of VALUES) {
      const exp = expectMoney(v, locale, PROMO_FIXED);
      const expB = expectMoney(v, locale, PROMO_BUDGET);
      if (!exp.ok || !expB.ok || v.big) continue;
      const raw = rawFor(v, locale);
      const form = await openPromoForm(page, locale, seller.sku, "FIXED");
      await form.getByLabel(discountLabel(locale, "FIXED"), { exact: true }).fill(raw);
      await form.getByLabel(tr(locale, "seller.promotions.budget"), { exact: true }).fill(raw);
      const resp = page.waitForResponse((r) => /\/promotions$/.test(r.url()) && r.request().method() === "POST");
      await form.getByRole("button", { name: tr(locale, "seller.promotions.submit") }).click();
      const r = await resp;
      const body = JSON.parse(r.request().postData() ?? "{}");
      const db = await sql("select discount_value::text d, budget::text b from promotions where shop_id=$1 order by created_at desc limit 1", [seller.shopId]);
      row(rows, v.id, raw, `status=2xx discount=${exp.canonical} budget=${exp.canonical} stored=${centsOf(exp.canonical)}/${centsOf(exp.canonical)}`,
        `status=${r.status() === 201 || r.status() === 200 ? "2xx" : r.status()} discount=${body.discountValue} budget=${body.budget} stored=${db[0] ? centsOf(db[0].d) : "none"}/${db[0]?.b ? centsOf(db[0].b) : "none"}`);
    }
    saveResults("promo-fixed-budget/valid", locale, rows);
    await context.close();
  });
}

test("promotion PERCENT 100 is the top of the range, 100.01 is refused (stored exactly)", async ({ browser }) => {
  const seller = await createSellerWithSku({ prefix: "promo-pct" });
  const { page, context } = await pageIn(browser, seller.user, "en");
  const form = await openPromoForm(page, "en", seller.sku, "PERCENT");
  await form.getByLabel(discountLabel("en", "PERCENT"), { exact: true }).fill("100.01");
  await form.getByRole("button", { name: tr("en", "seller.promotions.submit") }).click();
  await expect(form.locator(".mq-alert-error")).toHaveText(moneyMsg("en", "ABOVE_MAX", { max: 100 }));
  await form.getByLabel(discountLabel("en", "PERCENT"), { exact: true }).fill("100");
  const resp = page.waitForResponse((r) => /\/promotions$/.test(r.url()) && r.request().method() === "POST");
  await form.getByRole("button", { name: tr("en", "seller.promotions.submit") }).click();
  expect([200, 201]).toContain((await resp).status());
  expect(centsOf((await sql("select discount_value::text d from promotions where shop_id=$1", [seller.shopId]))[0].d)).toBe(10000n);
  await context.close();
});

// ---------------------------------------------------------------------------------------------------------------------
// CurrencyInput cells: SKU selling price (seller /seller/inventory "Add SKU") and storefront price filter (/shop).
//  Both use <CurrencyInput currency="TWD"> = 0 decimals, min 0 (no negatives), zero allowed, SKU max 9999999999.99. The error is shown on blur
//  under the field (role=alert) and the typed text must stay. Documented verdicts (TEST-GUIDE 8.1/8.2): "1.234" -> AMBIGUOUS_FORMAT on en/zh-TW,
//  100.5 / 100.555 / 0.001 -> decimals error, NT$100 / 12abc / abc / 1e3 / +5 -> invalid chars, "1 000" -> invalid, fullwidth 123.45 -> normalised then
//  TOO_MANY_DECIMALS, 1,234 (en) / 1.234 (vi) -> 1234.
//  KNOWN DEVIATION (BUG-2, see report): the field is a live MASK (lib/ui/currency.ts formatLiveCurrency strips every non-digit while typing), so these
//  values are silently rewritten instead of rejected (100.5 -> 1,005; 1e3 -> 13; NT$100 -> 100). Tests stay red on purpose.
// ---------------------------------------------------------------------------------------------------------------------
const CURRENCY0: MoneyProfile = { maxDec: 0, allowZero: true, allowNeg: false, max: 9999999999.99 };
const FILTER0: MoneyProfile = { maxDec: 0, allowZero: true, allowNeg: false };

/** Blur display the product should show for a canonical integer: grouped by the language. */
const blurDisplay = (canonical: string, locale: Locale) => canonical.replace(/\B(?=(\d{3})+(?!\d))/g, locale === "vi" ? "." : ",");

for (const locale of LOCALES) {
  test(`SKU selling price [${locale}]: rejected values show the exact message on blur, keep the text, no API call`, async ({ browser }) => {
    const seller = await createSellerWithSku({ prefix: "sku-bad" });
    const { page, context } = await pageIn(browser, seller.user, locale);
    const reqs = watchRequests(page, "POST", /\/inventory\/variants$/);
    const rows: ResultRow[] = [];
    let n = 0;
    for (const v of VALUES) {
      const exp = expectMoney(v, locale, CURRENCY0);
      if (exp.ok) continue;
      const raw = rawFor(v, locale);
      // a fresh form per value: when the product wrongly accepts a value the form closes and the SKU is really created
      await page.goto("/seller/inventory?tab=variants");
      await page.getByRole("button", { name: tr(locale, "seller.inventoryPage.addSku") }).click();
      const form = page.locator("form").filter({ has: page.getByLabel(tr(locale, "seller.inventoryPage.sellPrice")) });
      await form.locator("select").first().selectOption({ index: 1 });
      await form.getByPlaceholder(tr(locale, "seller.productsPage.sku")).fill(`SKUBAD-${locale}-${++n}`);
      const input = form.getByLabel(tr(locale, "seller.inventoryPage.sellPrice"));
      await input.fill(raw);
      const n0 = reqs.count();
      await input.blur();
      const shown = await input.inputValue();
      let msg = "(no message)";
      try { await form.locator("p[role=alert]").first().waitFor({ state: "visible", timeout: 1000 }); msg = (await form.locator("p[role=alert]").first().innerText()).trim(); } catch { /* none */ }
      await form.getByRole("button", { name: tr(locale, "seller.inventoryPage.createSku") }).click();
      await form.waitFor({ state: "hidden", timeout: 1500 }).catch(() => undefined); // an accepted submit closes the form; bounded wait before counting requests
      row(rows, v.id, raw, `${moneyMsg(locale, exp.code, { maxDecimals: 0, min: 0, max: 9999999999.99 })} | kept=true | req=0`, `${msg} | kept=${shown === raw}${shown === raw ? "" : ` (field became ${JSON.stringify(shown)})`} | req=${reqs.count() - n0}`, exp.code);
    }
    saveResults("sku-price/invalid", locale, rows);
    await context.close();
    expect((await sql("select count(*)::int c from inventory_variants where sku like 'SKUBAD-%' and product_id=$1", [seller.productId]))[0].c).toBe(0);
  });

  test(`SKU selling price [${locale}]: accepted values are shown grouped on blur and stored exactly`, async ({ browser }) => {
    const seller = await createSellerWithSku({ prefix: "sku-ok" });
    const { page, context } = await pageIn(browser, seller.user, locale);
    const rows: ResultRow[] = [];
    let n = 0;
    for (const v of VALUES) {
      const exp = expectMoney(v, locale, CURRENCY0);
      if (!exp.ok || v.big) continue;
      const raw = rawFor(v, locale);
      const sku = `SKUOK-${locale}-${++n}`;
      await page.goto("/seller/inventory?tab=variants");
      await page.getByRole("button", { name: tr(locale, "seller.inventoryPage.addSku") }).click();
      const form = page.locator("form").filter({ has: page.getByLabel(tr(locale, "seller.inventoryPage.sellPrice")) });
      await form.locator("select").first().selectOption({ index: 1 });
      await form.getByPlaceholder(tr(locale, "seller.productsPage.sku")).fill(sku);
      const input = form.getByLabel(tr(locale, "seller.inventoryPage.sellPrice"));
      await input.fill(raw);
      await input.blur();
      const shown = await input.inputValue();
      const resp = page.waitForResponse((r) => /\/inventory\/variants$/.test(r.url()) && r.request().method() === "POST", { timeout: 5000 }).catch(() => null);
      await form.getByRole("button", { name: tr(locale, "seller.inventoryPage.createSku") }).click();
      const r = await resp;
      const db = await sql("select selling_price::text p from inventory_variants where sku=$1 and product_id=$2", [sku, seller.productId]);
      row(rows, v.id, raw, `shown=${blurDisplay(exp.canonical, locale)} status=2xx stored=${exp.canonical}`,
        `shown=${shown} status=${r ? (r.status() === 200 || r.status() === 201 ? "2xx" : r.status()) : "no request"} stored=${db[0] ? Number(db[0].p) : "none"}`);
    }
    saveResults("sku-price/valid", locale, rows);
    await context.close();
  });

  test(`price filter [${locale}]: rejected values show the exact message on blur, keep the text and do not filter`, async ({ browser }) => {
    const buyer = await createUser({ prefix: "filter-bad" });
    const { page, context } = await pageIn(browser, buyer, locale);
    const listing = watchRequests(page, "GET", /minPrice=|maxPrice=/);
    await page.goto("/shop");
    const form = page.locator("form").filter({ has: page.getByPlaceholder(tr(locale, "storefront.minPrice")) });
    await expect(form.getByText("TWD", { exact: true })).toBeVisible(); // display currency pinned: TWD = 0 decimals
    const input = form.getByPlaceholder(tr(locale, "storefront.minPrice"));
    const rows: ResultRow[] = [];
    for (const v of VALUES) {
      const exp = expectMoney(v, locale, FILTER0);
      if (exp.ok) continue;
      const raw = rawFor(v, locale);
      await input.fill("");
      await input.fill(raw);
      const n0 = listing.count();
      await input.blur();
      await form.getByRole("button", { name: tr(locale, "storefront.applyPrice") }).click();
      let msg = "(no message)";
      try { await form.locator("p[role=alert]").first().waitFor({ state: "visible", timeout: 1500 }); msg = (await form.locator("p[role=alert]").first().innerText()).trim(); } catch { /* none */ }
      const shown = await input.inputValue();
      const urlFiltered = /minPrice=/.test(page.url());
      row(rows, v.id, raw, `${moneyMsg(locale, exp.code, { maxDecimals: 0, min: 0 })} | kept=true | filtered=false`, `${msg} | kept=${shown === raw}${shown === raw ? "" : ` (field became ${JSON.stringify(shown)})`} | filtered=${urlFiltered || listing.count() > n0}`, exp.code);
      if (urlFiltered) await page.goto("/shop");
    }
    saveResults("price-filter/invalid", locale, rows);
    await context.close();
  });

  test(`price filter [${locale}]: accepted values filter by the exact amount; min greater than max shows the range error`, async ({ browser }) => {
    const buyer = await createUser({ prefix: "filter-ok" });
    const { page, context } = await pageIn(browser, buyer, locale);
    const rows: ResultRow[] = [];
    for (const v of VALUES) {
      const exp = expectMoney(v, locale, FILTER0);
      if (!exp.ok || v.big) continue;
      const raw = rawFor(v, locale);
      await page.goto("/shop");
      const form = page.locator("form").filter({ has: page.getByPlaceholder(tr(locale, "storefront.minPrice")) });
      const input = form.getByPlaceholder(tr(locale, "storefront.minPrice"));
      await input.fill(raw);
      await input.blur();
      await form.getByRole("button", { name: tr(locale, "storefront.applyPrice") }).click();
      const expectedParam = exp.canonical === "0" ? null : exp.canonical;
      let actualParam: string | null = "(no navigation)";
      try { await expect.poll(() => new URL(page.url()).searchParams.get("minPrice"), { timeout: 3000 }).toBe(expectedParam); actualParam = expectedParam; } catch { actualParam = new URL(page.url()).searchParams.get("minPrice") ?? "(none)"; }
      row(rows, v.id, raw, `minPrice=${expectedParam}`, `minPrice=${actualParam}`);
    }
    // min > max
    await page.goto("/shop");
    const form = page.locator("form").filter({ has: page.getByPlaceholder(tr(locale, "storefront.minPrice")) });
    await form.getByPlaceholder(tr(locale, "storefront.minPrice")).fill("500");
    await form.getByPlaceholder(tr(locale, "storefront.maxPrice")).fill("100");
    await form.getByRole("button", { name: tr(locale, "storefront.applyPrice") }).click();
    await expect(form.locator("p[role=alert]")).toHaveText(tr(locale, "moneyInput.invalidRange"));
    expect(page.url()).not.toMatch(/minPrice=/);
    saveResults("price-filter/valid", locale, rows);
    await context.close();
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// STOCK QUANTITY (seller inventory slip line "Quantity"). parseLocaleIntInput: 0 decimals, 1..1,000,000, zero refused.
//  Every rejection shows ONE generic message (seller.inventoryPage.invalidQuantityError {sku}) in the form footer (not the moneyInput.* keys).
//  Accepted: 100, 1,234 (en) / 1.234 (vi), 007, padded, zero-width, NBSP, 1000000 (the max). Rejected: all decimals (100.5 ... 1.234 en = ambiguous),
//  0, negatives, +5, 1e3, text, currency symbols, blank, > 1,000,000 (1000001, 11/13 digits).
// ---------------------------------------------------------------------------------------------------------------------
const QTY: MoneyProfile = { maxDec: 0, allowZero: false, allowNeg: false, min: 1, max: 1000000 };

async function openSlipForm(page: Page, locale: Locale) {
  await page.goto("/seller/inventory?tab=slips");
  await page.getByRole("button", { name: tr(locale, "seller.inventoryPage.newSlip") }).click();
  const form = page.locator("form").filter({ has: page.getByLabel(tr(locale, "seller.inventoryPage.quantity")) });
  await form.getByLabel(tr(locale, "seller.transfers.selectWarehouse")).selectOption({ index: 1 });
  const skuSelect = form.locator("select").nth(2);
  await skuSelect.selectOption({ index: 1 });
  return form;
}

for (const locale of LOCALES) {
  test(`stock quantity (slip line) [${locale}]: rejected values show the invalid-quantity message, keep the text, no API call`, async ({ browser }) => {
    const seller = await createSellerWithSku({ prefix: "qty-bad" });
    const { page, context } = await pageIn(browser, seller.user, locale);
    const reqs = watchRequests(page, "POST", /\/inventory\/slips$/);
    const form = await openSlipForm(page, locale);
    const input = form.getByLabel(tr(locale, "seller.inventoryPage.quantity"));
    const rows: ResultRow[] = [];
    for (const v of VALUES) {
      const exp = expectMoney(v, locale, QTY);
      if (exp.ok) continue;
      const raw = rawFor(v, locale);
      await input.fill(raw);
      const n0 = reqs.count();
      await form.getByRole("button", { name: tr(locale, "seller.inventoryPage.createSlip") }).click();
      let msg = "(no message)";
      try { await form.locator("p.text-xs").first().waitFor({ state: "visible", timeout: 2000 }); msg = (await form.locator("p.text-xs").first().innerText()).trim(); } catch { /* none */ }
      row(rows, v.id, raw, `${tr(locale, "seller.inventoryPage.invalidQuantityError", { sku: seller.sku })} | kept=true | req=0`, `${msg} | kept=${(await input.inputValue()) === raw} | req=${reqs.count() - n0}`, exp.code);
    }
    saveResults("stock-qty/invalid", locale, rows);
    await input.fill("");
    const n0 = reqs.count();
    await form.getByRole("button", { name: tr(locale, "seller.inventoryPage.createSlip") }).click();
    expect(await input.evaluate((el: HTMLInputElement) => el.validity.valueMissing)).toBe(true); // empty: native required
    expect(reqs.count()).toBe(n0);
    await context.close();
    expect((await sql("select count(*)::int c from inventory_slips where shop_id=$1 and status='PENDING'", [seller.shopId]))[0].c).toBe(0);
  });

  test(`stock quantity (slip line) [${locale}]: accepted values are stored exactly`, async ({ browser }) => {
    const seller = await createSellerWithSku({ prefix: "qty-ok" });
    const { page, context } = await pageIn(browser, seller.user, locale);
    const rows: ResultRow[] = [];
    for (const v of VALUES) {
      const exp = expectMoney(v, locale, QTY);
      if (!exp.ok) continue;
      const raw = rawFor(v, locale);
      const form = await openSlipForm(page, locale);
      await form.getByLabel(tr(locale, "seller.inventoryPage.quantity")).fill(raw);
      const resp = page.waitForResponse((r) => /\/inventory\/slips$/.test(r.url()) && r.request().method() === "POST");
      await form.getByRole("button", { name: tr(locale, "seller.inventoryPage.createSlip") }).click();
      const r = await resp;
      const body = JSON.parse(r.request().postData() ?? "{}");
      const resBody = await r.json();
      const slipId = resBody.data?.id ?? resBody.data?.slip?.id;
      const db = slipId ? await sql("select quantity from inventory_slip_items where slip_id=$1", [slipId]) : [];
      row(rows, v.id, raw, `status=2xx sent=${exp.value} stored=${exp.value}`, `status=${r.status() === 200 || r.status() === 201 ? "2xx" : r.status()} sent=${body.items?.[0]?.quantity} stored=${db[0]?.quantity ?? "none"}`);
    }
    saveResults("stock-qty/valid", locale, rows);
    await context.close();
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// ORDER QUANTITY (product page QuantityStepper, stock 50). There is NO error UI: the field strips every non-digit and clamps to 1..stock
// (components/ui/QuantityStepper.tsx). Classification (against TEST-GUIDE 8.2 "every value is rejected with a message"): different from the document
// and NOT safe: the same non-digit stripping as BUG-2 turns 1.5 into 15 and 1e3 into 13 (a silent 10x quantity before checkout) => BUG-3, kept red
// (soft assertions: one red test per language, every deviating value listed). Invariant (integer in 1..stock) is asserted separately and passes.
// ---------------------------------------------------------------------------------------------------------------------
for (const locale of LOCALES) {
  test(`order quantity stepper [${locale}]: always an integer in 1..stock; clean integers kept; deviations recorded`, async ({ browser }) => {
    const seller = await createSellerWithSku({ prefix: "qty-step", stock: 50 });
    const buyer = await createUser({ prefix: "qty-buyer" });
    const { page, context } = await pageIn(browser, buyer, locale);
    const rows: ResultRow[] = [];
    for (const v of VALUES) {
      const raw = rawFor(v, locale);
      await page.goto(`/product/${seller.productId}`);
      const input = page.getByRole("group", { name: "Quantity" }).getByRole("textbox");
      await input.fill(raw);
      await input.blur();
      const shown = await input.inputValue();
      const n = Number(shown);
      expect.soft(Number.isInteger(n) && n >= 1 && n <= 50, `${v.id} typed ${JSON.stringify(raw)} -> ${shown}`).toBe(true);
      const exp = expectMoney(v, locale, { maxDec: 0, allowZero: false, allowNeg: false, min: 1, max: 50 });
      // documented verdict: rejected values leave the field untouched ("1"); accepted ones are kept
      const documented = exp.ok ? String(exp.value) : "1";
      const pass = shown === documented;
      // BUG-3: same mechanism as BUG-2 (non-digits stripped) => 1.5 becomes 15, 1e3 becomes 13: a silent 10x quantity. Red on purpose.
      expect.soft(shown, `${v.id} typed ${JSON.stringify(raw)}: documented verdict ${exp.ok ? "keep " + exp.value : "reject (field unchanged)"}`).toBe(documented);
      rows.push({ value: v.id, typed: raw, expected: documented, actual: shown, pass, note: pass ? undefined : "khac tai lieu, an toan (no error UI; coerced to digits and clamped to stock)" });
    }
    saveResults("order-qty-stepper", locale, rows);
    await context.close();
  });
}
