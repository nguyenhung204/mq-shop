import { test, expect, type Page } from "@playwright/test";
import { createUser, adjustWallet, walletOf, centsToDecimal } from "../support/factory";
import { sql } from "../support/db";
import {
  LOCALES, VALUES, expectMoney, rawFor, centsOf, moneyMsg, pageIn, watchRequests, setWalletPin, runInvalidValues, saveResults, row, tr,
  type Locale, type MoneyProfile, type ResultRow,
} from "../support/money-inputs";

/**
 * FLOW 14 - money inputs, WALLET cells (withdraw, P2P, admin wallet adjust). Other cells: 14c/14d specs, global cells: 14b serial.
 *
 * EXPECTATION MATRIX (from .forge/MONEY-INPUT-AUDIT.md + TEST-GUIDE 8; table lives in support/money-inputs.ts VALUES/expectMoney)
 *  Cell                      validator                    decimals  zero   negative  max                 error shown
 *  wallet withdraw           parseLocaleMoneyInput        2         NO     NO        999999999999.99     inline <p role=alert> under the field
 *  wallet P2P (amount)       parseLocaleMoneyInput        2         NO     NO        999999999999.99     inline <p role=alert>
 *  admin wallet adjust       parseLocaleMoneyInput        2         NO     YES       -1e6..1e6           inline <p role=alert>
 *
 *  Typed value -> verdict (en = zh-TW; vi swaps the separators):
 *   100, 100.5, 100.50, 1,234.50 (en) / 1.234,50 (vi), 1,234 (en) / 1.234 (vi), 007, "  123.45  ", fullwidth digits, zero-width space, NBSP -> valid
 *   0, 0.00 -> ZERO_NOT_ALLOWED;  -5, -0 -> NEGATIVE_NOT_ALLOWED (adjust: -5 valid, -0 ZERO_NOT_ALLOWED)
 *   +5, 1e3, abc, 12abc, .5, 5., NaN, Infinity, "1 000", NT$100, $50, 100d -> INVALID_CHARS;  blank spaces -> EMPTY;  "" -> native `required` (no request)
 *   100.555, 0.001 -> TOO_MANY_DECIMALS;  1234.50 in vi / 1234,50 in en, swapped separators, 1,23,4 -> AMBIGUOUS_FORMAT
 *   13 digits, 1000000000000.00 -> TOO_LARGE; adjust only: 1000001 -> ABOVE_MAX, -1000001 -> BELOW_MIN
 *  For every rejected value: exact message of the UI language (locale json by key), text kept in the field, zero API requests.
 *  For every accepted value: request body amount, Idempotency-Key header, stored cents in the DB, wallet balance delta.
 */

test.describe.configure({ timeout: 240_000 });

const WITHDRAW: MoneyProfile = { maxDec: 2, allowZero: false, allowNeg: false, max: 999999999999.99 };
const ADJUST: MoneyProfile = { maxDec: 2, allowZero: false, allowNeg: true, min: -1000000, max: 1000000 };

const PIN = "123456";
const st = (s: number) => (s === 200 || s === 201 ? "2xx" : String(s));

async function fillWithdrawStatic(page: Page, locale: Locale) {
  await page.getByLabel(tr(locale, "wallet.pin")).fill(PIN);
  await page.getByLabel(tr(locale, "wallet.bankName")).fill("E2E Bank");
  await page.getByLabel(tr(locale, "wallet.accountNumber")).fill("123456789");
  await page.getByLabel(tr(locale, "wallet.accountName"), { exact: true }).fill("E2E Holder");
}

// ---------------------------------------------------------------------------------------------------------------------
// WITHDRAW
// ---------------------------------------------------------------------------------------------------------------------
for (const locale of LOCALES) {
  test.describe(`withdraw [${locale}]`, () => {
    test(`rejected values: exact message, text kept, no API call`, async ({ browser }) => {
      const user = await createUser({ prefix: "wd-bad" });
      await setWalletPin(user, PIN);
      const { page, context } = await pageIn(browser, user, locale);
      const reqs = watchRequests(page, "POST", /\/wallet\/withdraw$/);
      await page.goto("/wallet/withdraw");
      const amount = page.getByLabel(tr(locale, "wallet.p2pAmount"));
      await expect(amount).toBeEnabled(); // wallet PIN known to the session
      await fillWithdrawStatic(page, locale);
      const submit = page.getByRole("button", { name: tr(locale, "wallet.withdrawSubmit") });
      await runInvalidValues({
        cell: "withdraw", locale, profile: WITHDRAW, page, input: amount, submit, alert: page.locator("form p[role=alert]"), reqs,
      });
      // empty: the browser's own `required` check blocks the submit (no inline message, no request)
      await amount.fill("");
      const n0 = reqs.count();
      await submit.click();
      expect(await amount.evaluate((el: HTMLInputElement) => el.validity.valueMissing)).toBe(true);
      expect(reqs.count()).toBe(n0);
      await context.close();
      expect((await sql("select count(*)::int c from payout_requests where user_id=$1", [user.id]))[0].c).toBe(0);
    });

    test(`accepted values are stored exactly (request, Idempotency-Key, DB cents, wallet)`, async ({ browser }) => {
      const user = await createUser({ prefix: "wd-ok" });
      await setWalletPin(user, PIN);
      await adjustWallet(user.id, "1000000.00", "e2e fund");
      const { page, context } = await pageIn(browser, user, locale);
      await page.goto("/wallet/withdraw");
      const amount = page.getByLabel(tr(locale, "wallet.p2pAmount"));
      await expect(amount).toBeEnabled();
      const submit = page.getByRole("button", { name: tr(locale, "wallet.withdrawSubmit") });
      const rows: ResultRow[] = [];
      for (const v of VALUES) {
        const exp = expectMoney(v, locale, WITHDRAW);
        if (!exp.ok) continue;
        const raw = rawFor(v, locale);
        const before = (await walletOf(user)).availableCents;
        await fillWithdrawStatic(page, locale);
        await amount.fill(raw);
        const resp = page.waitForResponse((r) => /\/wallet\/withdraw$/.test(r.url()) && r.request().method() === "POST");
        await submit.click();
        const r = await resp;
        const body = JSON.parse(r.request().postData() ?? "{}");
        const hdr = r.request().headers()["idempotency-key"];
        const after = (await walletOf(user)).availableCents;
        let actual: string;
        if (v.big || centsOf(exp.canonical) > before) {
          // larger than the test wallet: the request must still carry the exact amount and the server refuses (balance), nothing debited
          actual = `amount=${body.amount} status4xx=${r.status() >= 400 && r.status() < 500} debited=${before - after}`;
          if (!(r.status() >= 400 && r.status() < 500)) actual += ` [status ${r.status()} ${(await r.text()).slice(0, 160)}]`;
          row(rows, v.id, raw, `amount=${exp.value} status4xx=true debited=0`, actual);
          await page.reload();
          await expect(amount).toBeEnabled();
          continue;
        }
        const stored = await sql("select amount::text a from payout_requests where user_id=$1 order by created_at desc limit 1", [user.id]);
        actual = `status=${st(r.status())} amount=${body.amount} key=${!!hdr} stored=${stored[0] ? centsOf(stored[0].a) : "none"} debited=${before - after}`;
        row(rows, v.id, raw, `status=2xx amount=${exp.value} key=true stored=${centsOf(exp.canonical)} debited=${centsOf(exp.canonical)}`, actual);
        await expect(page.getByLabel(tr(locale, "wallet.pin"))).toHaveValue(""); // form cleared after success
      }
      saveResults("withdraw/valid", locale, rows);
      await context.close();
    });
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// P2P TRANSFER
// ---------------------------------------------------------------------------------------------------------------------
async function p2pToPreview(page: Page, locale: Locale, recipientEmail: string) {
  await page.getByLabel(tr(locale, "wallet.p2pEmail")).fill(recipientEmail);
  await page.getByRole("button", { name: tr(locale, "wallet.p2pLookup") }).click();
  await expect(page.getByLabel(tr(locale, "wallet.p2pAmount"))).toBeVisible();
  await page.getByLabel(tr(locale, "wallet.pin")).fill(PIN);
}

for (const locale of LOCALES) {
  test.describe(`P2P [${locale}]`, () => {
    test(`rejected values: exact message, text kept, no API call`, async ({ browser }) => {
      const sender = await createUser({ prefix: "p2p-bad" });
      const rcpt = await createUser({ prefix: "p2p-rcpt" });
      await setWalletPin(sender, PIN);
      await adjustWallet(sender.id, "1000.00", "e2e fund");
      const { page, context } = await pageIn(browser, sender, locale);
      const reqs = watchRequests(page, "POST", /\/wallet\/transfer$/);
      await page.goto("/wallet/p2p");
      await expect(page.getByLabel(tr(locale, "wallet.p2pEmail"))).toBeEnabled();
      await p2pToPreview(page, locale, rcpt.email);
      const amount = page.getByLabel(tr(locale, "wallet.p2pAmount"));
      const submit = page.getByRole("button", { name: tr(locale, "wallet.p2pConfirm") });
      await runInvalidValues({ cell: "p2p", locale, profile: WITHDRAW, page, input: amount, submit, alert: page.locator("form p[role=alert]"), reqs });
      await amount.fill("");
      const n0 = reqs.count();
      await submit.click();
      expect(await amount.evaluate((el: HTMLInputElement) => el.validity.valueMissing)).toBe(true);
      expect(reqs.count()).toBe(n0);
      await context.close();
      expect((await walletOf(sender)).availableCents).toBe(100000n);
      expect((await walletOf(rcpt)).availableCents).toBe(0n);
    });

    test(`accepted values: request, Idempotency-Key, sender debited and receiver credited by the exact cents`, async ({ browser }) => {
      const sender = await createUser({ prefix: "p2p-ok" });
      const rcpt = await createUser({ prefix: "p2p-rcpt" });
      await setWalletPin(sender, PIN);
      await adjustWallet(sender.id, "1000000.00", "e2e fund");
      const { page, context } = await pageIn(browser, sender, locale);
      await page.goto("/wallet/p2p");
      await expect(page.getByLabel(tr(locale, "wallet.p2pEmail"))).toBeEnabled();
      const rows: ResultRow[] = [];
      for (const v of VALUES) {
        const exp = expectMoney(v, locale, WITHDRAW);
        if (!exp.ok) continue;
        const raw = rawFor(v, locale);
        const s0 = (await walletOf(sender)).availableCents, r0 = (await walletOf(rcpt)).availableCents;
        await p2pToPreview(page, locale, rcpt.email);
        await page.getByLabel(tr(locale, "wallet.p2pAmount")).fill(raw);
        const resp = page.waitForResponse((r) => /\/wallet\/transfer$/.test(r.url()) && r.request().method() === "POST");
        await page.getByRole("button", { name: tr(locale, "wallet.p2pConfirm") }).click();
        const r = await resp;
        const body = JSON.parse(r.request().postData() ?? "{}");
        const s1 = (await walletOf(sender)).availableCents, r1 = (await walletOf(rcpt)).availableCents;
        if (v.big || centsOf(exp.canonical) > s0) {
          let actual = `amount=${body.amount} status4xx=${r.status() >= 400 && r.status() < 500} moved=${s0 - s1}/${r1 - r0}`;
          if (!(r.status() >= 400 && r.status() < 500)) actual += ` [status ${r.status()} ${(await r.text()).slice(0, 160)}]`;
          row(rows, v.id, raw, `amount=${exp.value} status4xx=true moved=0/0`, actual);
          await page.reload();
          await expect(page.getByLabel(tr(locale, "wallet.p2pEmail"))).toBeEnabled();
          continue;
        }
        const c = centsOf(exp.canonical);
        const actual = `status=${st(r.status())} amount=${body.amount} key=${!!r.request().headers()["idempotency-key"]} moved=${s0 - s1}/${r1 - r0}`;
        row(rows, v.id, raw, `status=2xx amount=${exp.value} key=true moved=${c}/${c}`, actual);
        await expect(page.getByLabel(tr(locale, "wallet.p2pEmail"))).toBeVisible(); // back to the lookup step
      }
      saveResults("p2p/valid", locale, rows);
      await context.close();
    });
  });
}

test("P2P double submit: two quick UI clicks and two API calls with one Idempotency-Key move the amount once", async ({ browser }) => {
  const sender = await createUser({ prefix: "p2p-dbl" });
  const rcpt = await createUser({ prefix: "p2p-dbl-r" });
  await setWalletPin(sender, PIN);
  await adjustWallet(sender.id, "500.00", "e2e fund");
  // 1. UI: double click on the confirm button
  const { page, context } = await pageIn(browser, sender, "en");
  const reqs = watchRequests(page, "POST", /\/wallet\/transfer$/);
  await page.goto("/wallet/p2p");
  await p2pToPreview(page, "en", rcpt.email);
  await page.getByLabel(tr("en", "wallet.p2pAmount")).fill("100.50");
  await page.getByRole("button", { name: tr("en", "wallet.p2pConfirm") }).dblclick();
  await expect(page.getByText(tr("en", "wallet.p2pSuccess"))).toBeVisible();
  const keys = new Set(reqs.all.map((r) => r.headers()["idempotency-key"]));
  expect(keys.size).toBe(1); // every request the UI made carried the same key
  expect((await walletOf(sender)).availableCents).toBe(50000n - 10050n);
  expect((await walletOf(rcpt)).availableCents).toBe(10050n);
  await context.close();
  // 2. API: two concurrent POSTs with the same key and body
  const key = crypto.randomUUID();
  const body = { email: rcpt.email, amount: "20.25", pin: PIN };
  const [a, b] = await Promise.all([
    sender.api.post("wallet/transfer", body, { "idempotency-key": key }),
    sender.api.post("wallet/transfer", body, { "idempotency-key": key }),
  ]);
  const sts = [a.status(), b.status()];
  expect(sts.every((s) => s === 200 || s === 201 || s === 409), `statuses ${sts} ${await a.text()} ${await b.text()}`).toBe(true);
  expect([a.status(), b.status()].some((s) => s === 200 || s === 201)).toBe(true);
  expect((await walletOf(sender)).availableCents).toBe(50000n - 10050n - 2025n);
  expect((await walletOf(rcpt)).availableCents).toBe(10050n + 2025n);
  const txs = await sql("select count(*)::int c from wallet_transactions where user_id=$1 and direction='OUT' and amount=20.25", [sender.id]);
  expect(txs[0].c).toBe(1);
});

// ---------------------------------------------------------------------------------------------------------------------
// ADMIN WALLET ADJUST (SUPER_ADMIN, signed, +-1e6)
// ---------------------------------------------------------------------------------------------------------------------
import { apiAs } from "../support/api";

async function pickUser(page: Page, locale: Locale, email: string) {
  await page.getByRole("button", { name: tr(locale, "admin.walletAdjust.user") }).click();
  await page.getByPlaceholder(tr(locale, "admin.walletAdjust.userPh")).last().fill(email);
  await page.getByRole("option", { name: new RegExp(email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).click();
}

for (const locale of LOCALES) {
  test.describe(`admin wallet adjust [${locale}]`, () => {
    test(`rejected values: exact message, text kept, no API call`, async ({ browser }) => {
      const target = await createUser({ prefix: "adj-bad" });
      const admin = await apiAs("SUPER_ADMIN");
      const { page, context } = await pageIn(browser, { api: admin }, locale);
      const reqs = watchRequests(page, "POST", /\/admin\/wallet\/adjust$/);
      await page.goto("/admin/wallet/adjust");
      await pickUser(page, locale, target.email);
      const amount = page.getByLabel(tr(locale, "admin.walletAdjust.amount"));
      const submit = page.getByRole("button", { name: tr(locale, "admin.walletAdjust.submit") });
      await runInvalidValues({ cell: "admin-adjust", locale, profile: ADJUST, page, input: amount, submit, alert: page.locator("form p[role=alert]"), reqs });
      await amount.fill("");
      const n0 = reqs.count();
      await submit.click();
      expect(await amount.evaluate((el: HTMLInputElement) => el.validity.valueMissing)).toBe(true);
      expect(reqs.count()).toBe(n0);
      await context.close();
      expect((await walletOf(target)).availableCents).toBe(0n);
    });

    test(`accepted values: request, DB cents, wallet delta (credit and debit)`, async ({ browser }) => {
      const target = await createUser({ prefix: "adj-ok" });
      await adjustWallet(target.id, "1000000.00", "e2e fund");
      await adjustWallet(target.id, "1000000.00", "e2e fund (2/2): the -1000000 debit needs the balance");
      const admin = await apiAs("SUPER_ADMIN");
      const { page, context } = await pageIn(browser, { api: admin }, locale);
      await page.goto("/admin/wallet/adjust");
      await pickUser(page, locale, target.email);
      const amount = page.getByLabel(tr(locale, "admin.walletAdjust.amount"));
      const rows: ResultRow[] = [];
      for (const v of VALUES) {
        const exp = expectMoney(v, locale, ADJUST);
        if (!exp.ok) continue;
        const raw = rawFor(v, locale);
        const w0 = (await walletOf(target)).availableCents;
        await amount.fill(raw);
        const resp = page.waitForResponse((r) => /\/admin\/wallet\/adjust$/.test(r.url()) && r.request().method() === "POST");
        await page.getByRole("button", { name: tr(locale, "admin.walletAdjust.submit") }).click();
        const r = await resp;
        const body = JSON.parse(r.request().postData() ?? "{}");
        const w1 = (await walletOf(target)).availableCents;
        const tx = await sql("select direction, amount::text a from wallet_transactions where user_id=$1 order by created_at desc, id desc limit 1", [target.id]);
        const c = centsOf(exp.canonical);
        const actual = `status=${st(r.status())} amount=${body.amount} key=${!!r.request().headers()["idempotency-key"]} delta=${w1 - w0} tx=${tx[0]?.direction}:${tx[0] ? centsOf(tx[0].a) : "none"}`;
        row(rows, v.id, raw, `status=2xx amount=${exp.value} key=true delta=${c} tx=${c < 0n ? "OUT" : "IN"}:${c < 0n ? -c : c}`, actual);
        await expect(amount).toHaveValue(""); // cleared after success
      }
      saveResults("admin-adjust/valid", locale, rows);
      await context.close();
      void centsToDecimal;
    });
  });
}
