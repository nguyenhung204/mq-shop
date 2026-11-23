import { test, expect } from "@playwright/test";
import { anon, ok } from "../support/api";
import { sql } from "../support/db";
import { createUser } from "../support/factory";
import { fillVerifyOtpUi, ipContext, newEmail, startRegistrationUi, userByEmail, userById, wrongOtp } from "../support/identity";
import { latestOtp } from "../support/otp";
import { watchHealth } from "../support/cart-ui";
import { runSubAccountExpirySweep } from "../support/backend-ctl-subexpiry";
import { findRawKeys, visibleTextOf } from "../support/perm-ui";
import { tr, type Locale } from "../support/money-inputs";
import { DEFAULT_PASSWORD } from "../support/env";

/**
 * FLOW 21 - flow 1 (register / log in / choose region) and flow 3 (sub-accounts) in the THREE UI languages, plus the 7-day rule of
 * an unconfirmed sub-account. 01/02/03 test the same behaviour with the English UI; this file checks what a person reads in vi and zh-TW
 * (exact dictionary text, no raw keys, no console errors, no 5xx) and the logic that was not covered: the 7-day expiry.
 *
 * Rules (sources: C4 handover, sub-accounts-core.service.ts doc comments, sub-account-claim-expiry.job.ts):
 *  - choosing a region card sets the UI language of that region (TW zh-TW, VN vi, MY/SG en) and registration sends that region;
 *  - an owner-created sub-account waits PENDING_ACTIVATION and holds one of the owner's 100 slots; it is released (e-mail anonymised, slot
 *    back) when it is withdrawn, declined or UNCLAIMED FOR 7 DAYS (hourly job: users.created_at < now() - 7 days);
 *  - 6 days 23 hours old is NOT released; 7 days + 1 hour is.
 * Time is pushed with SQL (`// SQL:`) because there is no clock seam; the hourly job runs through the helper process (backend-ctl-subexpiry.cjs).
 */
test.describe.configure({ timeout: 240_000 });
test.use({ actionTimeout: 20_000 }); // a wrong selector fails in 20 s, not at the test timeout

const PASSWORD = "E2ePassw0rd!";
const GATE: Record<Locale, { idx: number; id: string; code: string }> = {
  "zh-TW": { idx: 0, id: "tw", code: "TW" },
  en: { idx: 1, id: "my", code: "MY" },
  vi: { idx: 2, id: "vn", code: "VN" },
};
const LANGS: Locale[] = ["en", "vi", "zh-TW"];

async function noRawKeys(page: import("@playwright/test").Page, label: string) {
  const text = await visibleTextOf(page);
  expect(findRawKeys(text), `raw translation keys on ${label}`).toEqual([]);
}

for (const L of LANGS) {
  test(`flow 1 [${L}]: gate -> register -> verify (short / mismatch / wrong OTP messages) -> signed in -> wrong password -> log in`, async ({ browser }) => {
    const g = GATE[L];
    const email = newEmail(`i18n-${L.toLowerCase()}`);
    const first = await ipContext(browser, { lang: null }); // nothing stored: the gate is shown
    const health = watchHealth(first.page);
    await first.page.goto("/");
    const options = first.page.getByRole("option");
    await expect(options).toHaveCount(4);
    await options.nth(g.idx).click();
    await first.page.locator("button:has(svg.lucide-chevron-right)").click();
    await expect(options).toHaveCount(0);
    expect(await first.page.evaluate(() => localStorage.getItem("mq-lang"))).toBe(L);
    expect(await first.page.evaluate(() => localStorage.getItem("mq-region"))).toBe(g.id);

    // register form text in the language of the gate choice
    await first.page.goto("/my-account/register");
    await expect(first.page.locator("label[for=reg-name]")).toContainText(tr(L, "account.registerPage.fullName"));
    await expect(first.page.locator("label[for=reg-email]")).toContainText(tr(L, "account.emailAddress"));
    await expect(first.page.locator(".mq-auth-actions button[type=submit]")).toHaveText(tr(L, "account.register"));
    await noRawKeys(first.page, `/my-account/register [${L}]`);
    await startRegistrationUi(first.page, email, "I18n Person");
    await expect(first.page.locator("label[for=otp-code]")).toContainText(tr(L, "account.verifyOtp.otpCode"));
    await noRawKeys(first.page, `/my-account/verify-otp [${L}]`);
    const otp = await latestOtp(email);

    const alertText = async () => ((await first.page.locator(".mq-alert-error").first().innerText()) ?? "").trim();
    await fillVerifyOtpUi(first.page, otp, "short1", "short1");
    await expect(first.page.locator(".mq-alert-error").first()).toHaveText(tr(L, "account.messages.passwordTooShort"));
    await fillVerifyOtpUi(first.page, otp, PASSWORD, "different-Pass1");
    await expect.poll(alertText).toBe(tr(L, "account.messages.passwordMismatch"));
    await fillVerifyOtpUi(first.page, wrongOtp(otp), PASSWORD, PASSWORD);
    await expect.poll(alertText).toBe(tr(L, "toast.invalidOtp"));
    expect(await userByEmail(email)).toBeUndefined(); // SQL: nothing created by any refused attempt

    const verified = first.page.waitForResponse((r) => r.url().endsWith("/auth/register/verify-otp") && r.request().method() === "POST");
    await fillVerifyOtpUi(first.page, otp, PASSWORD, PASSWORD);
    expect((await verified).status()).toBe(201);
    await first.page.waitForURL((u) => !u.pathname.includes("verify-otp"));
    const created = await userByEmail(email);
    expect(created).toMatchObject({ status: "ACTIVE", region_code: g.code });
    health.assertClean(`flow 1 register [${L}]`);
    await first.context.close();

    // sign in again: wrong password reads as "invalid credentials" in this language, then the right one works
    const second = await ipContext(browser, { lang: L });
    const h2 = watchHealth(second.page);
    await second.page.addInitScript((r) => { try { localStorage.setItem("mq-region", r); } catch { /* ignore */ } }, g.id);
    await second.page.goto("/my-account");
    await second.page.locator("#login-email").fill(email);
    await second.page.locator("#login-password").fill("Wrong-pass-1");
    await second.page.locator(".mq-auth-actions button[type=submit]").click();
    await expect(second.page.locator(".mq-alert-error").first()).toHaveText(tr(L, "toast.invalidCredentials"));
    await noRawKeys(second.page, `/my-account login error [${L}]`);
    await second.page.locator("#login-password").fill(PASSWORD);
    const login = second.page.waitForResponse((r) => r.url().endsWith("/auth/login") && r.request().method() === "POST");
    await second.page.locator(".mq-auth-actions button[type=submit]").click();
    expect((await login).status()).toBe(200);
    await expect.poll(() => new URL(second.page.url()).pathname).not.toBe("/my-account/login");
    h2.assertClean(`flow 1 login [${L}]`);
    await second.context.close();
  });

  test(`flow 3 [${L}]: owner creates, sees the pending text, withdraws, re-creates; the person claims through "lost password"; another declines`, async ({ browser }) => {
    const owner = await createUser({ prefix: `own3-${L.toLowerCase()}` });
    const { page, context } = await ipContext(browser, { from: owner, lang: L });
    const health = watchHealth(page);
    const counter = (n: number) => tr(L, "subAccounts.nOfCap", { n: String(n), cap: "100" });
    const form = page.locator("form[novalidate]").first();
    const create = async (email: string) => {
      await form.locator("input[type=email]").fill(email);
      await form.locator("input:not([type=email])").first().fill("Sub Person");
      const done = page.waitForResponse((r) => r.url().endsWith("/sub-accounts") && r.request().method() === "POST");
      await form.locator("button[type=submit]").click();
      expect((await done).status()).toBe(201);
    };

    await page.goto("/sub-accounts");
    await expect(page.getByText(counter(0), { exact: true })).toBeVisible();
    await noRawKeys(page, `/sub-accounts [${L}]`);

    // create -> pending row in this language
    const e1 = newEmail("sub3a");
    await create(e1);
    await expect(page.getByText(counter(1), { exact: true })).toBeVisible();
    const row1 = page.locator("tr", { hasText: e1 });
    await expect(row1).toContainText(tr(L, "status.user.PENDING_ACTIVATION"));
    await expect(row1).toContainText(tr(L, "subAccounts.pendingHint", { days: "7" }));
    expect(await userByEmail(e1)).toMatchObject({ status: "PENDING_ACTIVATION", parent_account_id: owner.id });
    expect((await userById(owner.id)).sub_account_count).toBe(1);

    // withdraw (confirm dialog in this language): slot back, e-mail freed
    await row1.getByRole("button", { name: tr(L, "subAccounts.withdraw"), exact: true }).click();
    const dlg = page.getByRole("alertdialog");
    await expect(dlg).toContainText(tr(L, "subAccounts.withdrawConfirm.title"));
    await dlg.getByRole("button", { name: tr(L, "subAccounts.withdraw"), exact: true }).click();
    await expect(page.getByText(counter(0), { exact: true })).toBeVisible();
    await expect(page.locator("tr", { hasText: e1 })).toHaveCount(0);
    expect(await userByEmail(e1)).toBeUndefined(); // SQL: the e-mail was anonymised
    expect((await userById(owner.id)).sub_account_count).toBe(0);

    // create again, the person at that mailbox claims it through lost-password in this language
    const e2 = newEmail("sub3b");
    await create(e2);
    const person = await ipContext(browser, { lang: L });
    const hp = watchHealth(person.page);
    await person.page.goto("/my-account/lost-password");
    await expect(person.page.locator("label[for=lost-email]")).toContainText(tr(L, "account.emailAddress"));
    await person.page.locator("#lost-email").fill(e2);
    await person.page.locator(".mq-auth-actions button[type=submit]").click();
    await expect(person.page.locator("#reset-otp")).toBeVisible();
    await person.page.locator("#reset-otp").fill(await latestOtp(e2));
    await person.page.locator("#reset-password").fill("Claimed-Pass1!");
    await person.page.locator(".mq-auth-actions button[type=submit]").click();
    await person.page.waitForURL(/\/my-account/);
    await expect.poll(async () => (await userByEmail(e2))?.status).toBe("ACTIVE");
    await page.reload();
    await expect(page.locator("tr", { hasText: e2 })).toContainText(tr(L, "status.user.ACTIVE"));
    await expect(page.locator("tr", { hasText: e2 }).getByText(tr(L, "subAccounts.pendingHint", { days: "7" }))).toHaveCount(0);
    hp.assertClean(`claim [${L}]`);
    await person.context.close();

    // a third person declines in this language (wrong code is an error in this language, the right one frees the slot)
    const e3 = newEmail("sub3c");
    const ownerApi = owner.api;
    const sub3 = await ok<any>(await ownerApi.post("sub-accounts", { email: e3 }));
    const code = await latestOtp(e3);
    const dec = await ipContext(browser, { lang: L });
    const hd = watchHealth(dec.page);
    await dec.page.goto(`/my-account/decline-sub-account?email=${encodeURIComponent(e3)}`);
    await expect(dec.page.locator("label[for=decline-code]")).toContainText(tr(L, "subAccounts.decline.code"));
    await noRawKeys(dec.page, `/my-account/decline-sub-account [${L}]`);
    await dec.page.locator("#decline-code").fill(wrongOtp(code));
    await dec.page.locator(".mq-auth-actions button[type=submit]").click();
    await expect(dec.page.locator(".mq-alert-error")).toBeVisible();
    expect(((await dec.page.locator(".mq-alert-error").innerText()) ?? "").trim().length).toBeGreaterThan(0);
    await noRawKeys(dec.page, `decline error [${L}]`);
    await dec.page.locator("#decline-code").fill(code);
    await dec.page.locator(".mq-auth-actions button[type=submit]").click();
    await expect(dec.page.locator(".mq-alert-success")).toHaveText(tr(L, "subAccounts.decline.done"));
    expect((await userById(sub3.id))?.status).not.toBe("PENDING_ACTIVATION");
    expect((await userById(owner.id)).sub_account_count).toBe(1); // only the claimed e2 still counts
    hd.assertClean(`decline [${L}]`);
    await dec.context.close();
    health.assertClean(`/sub-accounts [${L}]`);
    await context.close();
  });
}

test("7-day rule: an unclaimed sub-account is released after 7 days (slot back, e-mail free, UI in en/vi/zh-TW); 6 days 23 h is kept", async ({ browser }) => {
  // three owners (one per language), each with a stale (7d 1h), a fresh-ish (6d 23h) and a claimed-later pending account
  const owners = await Promise.all(LANGS.map((L) => createUser({ prefix: `own7-${L.toLowerCase()}` })));
  const stale: string[] = [];
  const edge: string[] = [];
  for (let i = 0; i < LANGS.length; i++) {
    const es = newEmail("stale7");
    const ee = newEmail("edge7");
    const a = await ok<any>(await owners[i].api.post("sub-accounts", { email: es }));
    const b = await ok<any>(await owners[i].api.post("sub-accounts", { email: ee }));
    stale.push(a.id);
    edge.push(b.id);
    expect((await userById(owners[i].id)).sub_account_count).toBe(2);
    // SQL: no API / clock seam: push the creation time back (the hourly job reads users.created_at)
    await sql(`UPDATE users SET created_at = now() - interval '7 days 1 hour' WHERE id = $1`, [a.id]);
    await sql(`UPDATE users SET created_at = now() - interval '6 days 23 hours' WHERE id = $1`, [b.id]);
  }
  const staleEmails = await Promise.all(stale.map(async (id) => (await userById(id)).email as string));

  // before the sweep the aged reservations are still there (and still count against the owners' slots)
  expect((await userById(stale[0])).status).toBe("PENDING_ACTIVATION");

  // the running backend has the same job on an hourly cron: if it holds the advisory lock our sweep returns 0, so repeat until the rows are gone
  await expect.poll(async () => {
    await runSubAccountExpirySweep();
    return (await sql<{ n: number }>(`SELECT count(*)::int AS n FROM users WHERE id = ANY($1::uuid[]) AND status = 'PENDING_ACTIVATION'`, [stale]))[0].n;
  }, { message: "the stale reservations are released by the sweep", timeout: 90_000, intervals: [0] }).toBe(0);

  for (let i = 0; i < LANGS.length; i++) {
    const L = LANGS[i];
    // DB truth
    expect((await userById(stale[i]))?.status).not.toBe("PENDING_ACTIVATION");
    expect((await userById(edge[i]))?.status).toBe("PENDING_ACTIVATION");
    expect((await userById(owners[i].id)).sub_account_count).toBe(1);
    expect(await userByEmail(staleEmails[i])).toBeUndefined(); // e-mail anonymised = free
    // UI in this language: counter 1 of 100, only the edge row remains
    const { page, context } = await ipContext(browser, { from: owners[i], lang: L });
    const health = watchHealth(page);
    await page.goto("/sub-accounts");
    await expect(page.getByText(tr(L, "subAccounts.nOfCap", { n: "1", cap: "100" }), { exact: true })).toBeVisible();
    await expect(page.locator("tr", { hasText: staleEmails[i] })).toHaveCount(0);
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expect(page.locator("tbody tr").first()).toContainText(tr(L, "status.user.PENDING_ACTIVATION"));
    health.assertClean(`sub-accounts after expiry [${L}]`);
    await context.close();
    // the freed e-mail can be registered again right away
    const api = await anon();
    await ok(await api.post("auth/register", { email: staleEmails[i], fullName: "Back again" }));
    await ok(await api.post("auth/register/verify-otp", { email: staleEmails[i], otp: await latestOtp(staleEmails[i]), password: DEFAULT_PASSWORD }), [200, 201]);
    expect(await userByEmail(staleEmails[i])).toMatchObject({ status: "ACTIVE", parent_account_id: null });
  }
  // another sweep changes nothing: the released stay released, the 6d23h rows stay pending
  await runSubAccountExpirySweep();
  for (const id of edge) expect((await userById(id)).status).toBe("PENDING_ACTIVATION");
});

test("7-day invite link: an invite past its 7 days is shown as expired and the registration with it is refused (SQL moves the expiry)", async ({ browser }) => {
  const owner = await createUser({ prefix: "own7inv" });
  const inv = await ok<any>(await owner.api.post("sub-accounts/invites"));
  const exp = new Date(inv.expiresAt).getTime();
  const days = (exp - Date.now()) / 86_400_000;
  expect(days).toBeGreaterThan(6.99);
  expect(days).toBeLessThanOrEqual(7.001);
  // SQL: no API to age an invite: make it expire one hour ago
  await sql(`UPDATE sub_account_invites SET expires_at = now() - interval '1 hour' WHERE id = $1`, [inv.id]);
  const list = await ok<any>(await owner.api.get("sub-accounts/invites"));
  const items: any[] = list.items ?? list;
  expect(items.find((x) => x.id === inv.id)?.status).toBe("EXPIRED");
  const reg = await (await anon()).post("auth/register", { email: newEmail("late"), fullName: "Late", inviteToken: inv.token });
  expect(reg.status()).toBeGreaterThanOrEqual(400);
  expect(reg.status()).toBeLessThan(500);
  for (const L of LANGS) {
    const { page, context } = await ipContext(browser, { from: owner, lang: L });
    await page.goto("/sub-accounts");
    await expect(page.locator("tbody tr").last()).toContainText(tr(L, "subAccounts.invites.status.EXPIRED"));
    await context.close();
  }
});
