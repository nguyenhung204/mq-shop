import { test, expect, type Page } from "@playwright/test";
import { apiAs, ok } from "../support/api";
import { sql } from "../support/db";
import {
  LOCALES, VALUES, expectMoney, rawFor, centsOf, moneyMsg, pageIn, watchRequests, saveResults, row, tr,
  type Locale, type MoneyProfile, type ResultRow,
} from "../support/money-inputs";

/**
 * FLOW 14b - money inputs that write GLOBAL configuration. SERIAL ONLY (runs in the `serial` project after the parallel one; never in parallel
 * with other agents). Written and type-checked; not executed by the builder unless the lead says so.
 *
 * Cells and expectations (same value table as 14-money-inputs.spec.ts):
 *  FX rate (/admin/finance/configs, "How much {code} for 1 TWD"): parseLocaleMoneyInput 8dp, >0, max 10 (MYR/SGD/USD) and 100000 (VND);
 *      inline <p role=alert> under the field. Rejected values -> exact message, text kept, no PUT.
 *      Prefilled values must be acceptable in every language (they are shown by the product itself) -> checked WITHOUT a DB write (PUT is fulfilled by the test).
 *      Accepted values are written for real (VND) and the old rates are restored in `finally`.
 *  Finance config (/admin/finance/configs create form): platform fee % and global fund % 0..100 2dp zero allowed; point value 8dp >0 max 100.
 *      Error in ONE banner (.mq-alert-error). Accepted values create a PENDING_APPROVAL config (never approved) which is rejected in `finally`.
 *  Dividend rate % (/admin/dividend/rates): validator parsePercentToBps = plain ASCII 0..100, 2 decimals, NOT locale aware; zero allowed.
 *      Messages admin.dividend.rates.errors.ratePercent.{required,invalid}. Rates are append-only (no delete), so accepted values are NOT written:
 *      the POST is fulfilled by the test and only its payload is asserted (DB storage not verified, see report).
 *  CLASSIFICATION: dividend % takes only ASCII (1,234.50 / fullwidth / 100,5 are refused with the generic message) = "khac tai lieu, an toan".
 */
test.describe.configure({ timeout: 300_000 }); // the `serial` project already runs 1 worker, fullyParallel=false; no mode:"serial" so one failure cannot skip the rest

const FX_MYR: MoneyProfile = { maxDec: 8, allowZero: false, allowNeg: false, max: 10 };
const FX_VND: MoneyProfile = { maxDec: 8, allowZero: false, allowNeg: false, max: 100000 };
const FEE: MoneyProfile = { maxDec: 2, allowZero: true, allowNeg: false, min: 0, max: 100 };
const POINT: MoneyProfile = { maxDec: 8, allowZero: false, allowNeg: false, max: 100 };

// ---------------------------------------------------------------------------------------------------------------------
// FX
// ---------------------------------------------------------------------------------------------------------------------
const fxLabel = (locale: Locale, code: string) => tr(locale, "admin.fx.quoteLabel", { code });
const alertOf = (page: Page, locale: Locale, code: string) => page.getByLabel(fxLabel(locale, code)).locator("xpath=ancestor::label").locator("p[role=alert]");

async function currentFx(): Promise<Record<string, number>> {
  const sa = await apiAs("SUPER_ADMIN");
  const res = await ok<any>(await sa.get("admin/fx/rates"));
  const r = res.latest.rates;
  return { MYR: Number(r.MYR), VND: Number(r.VND), SGD: Number(r.SGD), USD: Number(r.USD) };
}

for (const locale of LOCALES) {
  test(`FX rate MYR [${locale}]: rejected values show the exact message, keep the text, no PUT`, async ({ browser }) => {
    const sa = await apiAs("SUPER_ADMIN");
    const { page, context } = await pageIn(browser, { api: sa }, locale);
    const reqs = watchRequests(page, "PUT", /\/admin\/fx\/rates$/);
    await page.goto("/admin/finance/configs");
    const input = page.getByLabel(fxLabel(locale, "MYR"));
    await expect(input).toBeVisible();
    // the prefilled sibling quotes may themselves be rejected in vi; make them valid so only MYR is under test
    await page.getByLabel(fxLabel(locale, "VND")).fill("4");
    await page.getByLabel(fxLabel(locale, "SGD")).fill("4");
    await page.getByLabel(fxLabel(locale, "USD")).fill("5");
    const submit = page.getByRole("button", { name: tr(locale, "admin.fx.save") });
    const rows: ResultRow[] = [];
    for (const v of VALUES) {
      const exp = expectMoney(v, locale, FX_MYR);
      if (exp.ok) continue;
      const raw = rawFor(v, locale);
      await input.fill(raw);
      const n0 = reqs.count();
      await submit.click();
      let msg = "(no message)";
      try { await alertOf(page, locale, "MYR").first().waitFor({ state: "visible", timeout: 3000 }); msg = (await alertOf(page, locale, "MYR").first().innerText()).trim(); } catch { /* none */ }
      row(rows, v.id, raw, `${moneyMsg(locale, exp.code, { maxDecimals: 8, max: 10 })} | kept=true | req=0`, `${msg} | kept=${(await input.inputValue()) === raw} | req=${reqs.count() - n0}`, exp.code);
    }
    saveResults("fx-rate/invalid", locale, rows);
    await context.close();
  });

  test(`FX rates [${locale}]: the values the page prefills are accepted in this language (no write: PUT fulfilled by the test)`, async ({ browser }) => {
    const sa = await apiAs("SUPER_ADMIN");
    const { page, context } = await pageIn(browser, { api: sa }, locale);
    let sent: any = null;
    await page.route(/\/admin\/fx\/rates$/, async (route) => {
      if (route.request().method() !== "PUT") return route.continue();
      sent = JSON.parse(route.request().postData() ?? "{}");
      const latest = await ok<any>(await sa.get("admin/fx/rates"));
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: latest.latest }) });
    });
    await page.goto("/admin/finance/configs");
    await expect(page.getByLabel(fxLabel(locale, "MYR"))).not.toHaveValue("");
    await page.getByRole("button", { name: tr(locale, "admin.fx.save") }).click();
    const detail = async () => JSON.stringify(await Promise.all(["MYR", "VND", "SGD", "USD"].map(async (c) => [c, await page.getByLabel(fxLabel(locale, c)).inputValue(), await alertOf(page, locale, c).allInnerTexts()])));
    await expect(page.locator("p[role=alert]"), `no field may complain about the product's own prefilled rate; [code, prefilled, alerts] = ${await detail()}`).toHaveCount(0);
    await expect.poll(() => sent).not.toBeNull();
    await context.close();
  });

  test(`FX rate VND [${locale}]: accepted values are stored exactly; old rates restored`, async ({ browser }) => {
    const before = await currentFx();
    const sa = await apiAs("SUPER_ADMIN");
    const { page, context } = await pageIn(browser, { api: sa }, locale);
    const rows: ResultRow[] = [];
    try {
      await page.goto("/admin/finance/configs");
      for (const v of VALUES) {
        const exp = expectMoney(v, locale, FX_VND);
        if (!exp.ok) continue;
        const raw = rawFor(v, locale);
        await page.goto("/admin/finance/configs");
        await page.getByLabel(fxLabel(locale, "MYR")).fill("3");
        await page.getByLabel(fxLabel(locale, "SGD")).fill("4");
        await page.getByLabel(fxLabel(locale, "USD")).fill("5");
        await page.getByLabel(fxLabel(locale, "VND")).fill(raw);
        const resp = page.waitForResponse((r) => /\/admin\/fx\/rates$/.test(r.url()) && r.request().method() === "PUT");
        await page.getByRole("button", { name: tr(locale, "admin.fx.save") }).click();
        const r = await resp;
        const body = JSON.parse(r.request().postData() ?? "{}");
        const db = await sql("select rate::text r from fx_rates where quote_currency='VND' order by created_at desc, id desc limit 1");
        row(rows, v.id, raw, `status=2xx sent=${exp.value} stored=${exp.value}`, `status=${r.status() === 200 || r.status() === 201 ? "2xx" : r.status()} sent=${body.rates?.VND} stored=${db[0] ? Number(db[0].r) : "none"}`);
      }
    } finally {
      await ok(await sa.put("admin/fx/rates", { rates: before, note: "e2e restore after flow 14b" }));
      saveResults("fx-rate/valid", locale, rows);
      await context.close();
    }
    expect(await currentFx()).toEqual(before);
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// FINANCE CONFIG (platform fee %, global fund %, point value)
// ---------------------------------------------------------------------------------------------------------------------
const FIELD_LABELS = (locale: Locale) => ({
  fee: `${tr(locale, "admin.financeConfigs.platformFee")} (%)`,
  commission: `${tr(locale, "admin.financeConfigs.commission")} (%)`,
  point: tr(locale, "admin.financeConfigs.pointUsdValuePrefix"), // label also wraps unit + hint text: matched as substring (see getByLabel calls)
});

for (const locale of LOCALES) {
  for (const [field, profile] of [["fee", FEE], ["commission", FEE], ["point", POINT]] as const) {
    test(`finance config ${field} [${locale}]: rejected values show the exact banner message, keep the text, no POST`, async ({ browser }) => {
      const sa = await apiAs("SUPER_ADMIN");
      const { page, context } = await pageIn(browser, { api: sa }, locale);
      const reqs = watchRequests(page, "POST", /\/admin\/finance\/configs$/);
      await page.goto("/admin/finance/configs");
      const labels = FIELD_LABELS(locale);
      const form = page.locator("form").filter({ has: page.getByLabel(labels.fee, { exact: true }) });
      // the first field that fails is the one reported (fee, then commission, then point): fill the others validly
      await form.getByLabel(labels.fee, { exact: true }).fill(locale === "vi" ? "1" : "1");
      await form.getByLabel(labels.commission, { exact: true }).fill("1");
      await form.getByLabel(labels.point).fill("1");
      const input = field === "point" ? form.getByLabel(labels.point) : form.getByLabel(labels[field], { exact: true });
      const rows: ResultRow[] = [];
      for (const v of VALUES) {
        const exp = expectMoney(v, locale, profile);
        if (exp.ok) continue;
        const raw = rawFor(v, locale);
        await input.fill(raw);
        const n0 = reqs.count();
        await form.getByRole("button", { name: tr(locale, "admin.financeConfigs.submitBtn") }).click();
        let msg = "(no message)";
        try { await form.locator(".mq-alert-error").first().waitFor({ state: "visible", timeout: 3000 }); msg = (await form.locator(".mq-alert-error").first().innerText()).trim(); } catch { /* none */ }
        row(rows, v.id, raw, `${moneyMsg(locale, exp.code, { maxDecimals: profile.maxDec, min: profile.min, max: profile.max })} | kept=true | req=0`, `${msg} | kept=${(await input.inputValue()) === raw} | req=${reqs.count() - n0}`, exp.code);
      }
      saveResults(`finance-config-${field}/invalid`, locale, rows);
      await context.close();
    });
  }

  test(`finance config [${locale}]: accepted fee values are sent canonical and stored exactly (PENDING configs rejected afterwards)`, async ({ browser }) => {
    const sa = await apiAs("SUPER_ADMIN");
    const { page, context } = await pageIn(browser, { api: sa }, locale);
    const rows: ResultRow[] = [];
    const created: string[] = [];
    try {
      for (const v of VALUES) {
        const exp = expectMoney(v, locale, FEE);
        if (!exp.ok) continue;
        const raw = rawFor(v, locale);
        await page.goto("/admin/finance/configs");
        const labels = FIELD_LABELS(locale);
        const form = page.locator("form").filter({ has: page.getByLabel(labels.fee, { exact: true }) });
        await form.getByLabel(labels.fee, { exact: true }).fill(raw);
        await form.getByLabel(labels.commission, { exact: true }).fill(raw);
        await form.getByLabel(labels.point).fill("1");
        const resp = page.waitForResponse((r) => /\/admin\/finance\/configs$/.test(r.url()) && r.request().method() === "POST");
        await form.getByRole("button", { name: tr(locale, "admin.financeConfigs.submitBtn") }).click();
        const r = await resp;
        const body = JSON.parse(r.request().postData() ?? "{}");
        const json = await r.json().catch(() => ({}));
        const id: string | undefined = json.data?.id ?? json.data?.config?.id;
        const db = id ? await sql("select platform_fee_percent::text f, commission_percent::text c, status from finance_configs where id=$1", [id]) : [];
        if (id) { created.push(id); await ok(await sa.post(`admin/finance/configs/${id}/reject`, { reason: "e2e flow 14b cleanup" })); created.pop(); } // reject right away (never approved)
        row(rows, v.id, raw, `status=2xx sent=${exp.canonical}/${exp.canonical} stored=${centsOf(exp.canonical)}/${centsOf(exp.canonical)} PENDING_APPROVAL`,
          `status=${r.status() === 200 || r.status() === 201 ? "2xx" : r.status()} sent=${body.platformFeePercent}/${body.commissionPercent} stored=${db[0] ? centsOf(db[0].f) : "none"}/${db[0] ? centsOf(db[0].c) : "none"} ${db[0]?.status}`);
      }
    } finally {
      for (const id of created) await sa.post(`admin/finance/configs/${id}/reject`, { reason: "e2e flow 14b cleanup" }); // only leftovers of a failed iteration
      saveResults("finance-config/valid", locale, rows);
      await context.close();
    }
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// DIVIDEND RATE %  (ASCII only, 0..100, 2 decimals; append-only table => POST fulfilled by the test, payload asserted)
// ---------------------------------------------------------------------------------------------------------------------
function divVerdict(raw: string): { kind: "ok"; value: number } | { kind: "required" | "invalid" } {
  const t = raw.trim();
  if (t === "") return { kind: "required" };
  const m = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(t);
  if (!m) return { kind: "invalid" };
  const bps = Number(m[1] + (m[2] ?? "").padEnd(2, "0"));
  return bps <= 10000 ? { kind: "ok", value: Number(`${Number(m[1])}.${(m[2] ?? "").padEnd(2, "0")}`) } : { kind: "invalid" };
}
const DIV_EXTRA = ["100", "100.00", "100.01", "0", "0.00", "99.99", "12.5"];

for (const locale of LOCALES) {
  test(`dividend rate % [${locale}]: verdict per value (invalid -> exact message, text kept, no POST; valid -> payload only)`, async ({ browser }) => {
    const sa = await apiAs("SUPER_ADMIN");
    const { page, context } = await pageIn(browser, { api: sa }, locale);
    const posts: any[] = [];
    await page.route(/\/admin\/dividend\/rates$/, async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      posts.push(JSON.parse(route.request().postData() ?? "{}"));
      return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ data: { id: "00000000-0000-0000-0000-000000000000", seq: 0, rateBps: 0, effectiveDate: "2027-01-01", reason: "x" } }) });
    });
    await page.goto("/admin/dividend/rates");
    const input = page.getByLabel(tr(locale, "admin.dividend.rates.ratePercent"), { exact: true });
    const date = page.getByLabel(tr(locale, "admin.dividend.rates.effectiveDate"), { exact: true });
    const reason = page.getByLabel(tr(locale, "admin.common.reason"), { exact: true });
    const submit = page.getByRole("button", { name: tr(locale, "admin.dividend.rates.submit") });
    const rows: ResultRow[] = [];
    const typed = [...VALUES.map((v) => [v.id, rawFor(v, locale)] as const), ...DIV_EXTRA.map((x) => [x, x] as const)];
    for (const [label, raw] of typed) {
      const v = divVerdict(raw);
      await date.fill("2027-01-01");
      await reason.fill("e2e rate input check");
      await input.fill(raw);
      const n0 = posts.length;
      await submit.click();
      if (v.kind === "ok") {
        await expect.poll(() => posts.length).toBe(n0 + 1);
        row(rows, label, raw, `payload ratePercent=${v.value}`, `payload ratePercent=${posts[n0]?.ratePercent}`);
        await expect(input).toHaveValue(""); // success clears the form asynchronously: wait, otherwise the next fill() is wiped
      } else {
        let msg = "(no message)";
        try { await page.locator("ul[role=alert] li").first().waitFor({ state: "visible", timeout: 3000 }); msg = (await page.locator("ul[role=alert] li").first().innerText()).trim(); } catch { /* none */ }
        row(rows, label, raw, `${tr(locale, `admin.dividend.rates.errors.ratePercent.${v.kind}`)} | kept=true | posts=0`, `${msg} | kept=${(await input.inputValue()) === raw} | posts=${posts.length - n0}`, v.kind);
        // an invalid attempt keeps the form; a valid one cleared it
      }
    }
    saveResults("dividend-rate", locale, rows);
    await context.close();
    expect((await sql("select count(*)::int c from dividend_rates where reason='e2e rate input check'"))[0].c).toBe(0);
  });
}
