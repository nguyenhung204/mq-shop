import { request, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { Api, freshIp } from "./api";
import { API, WEB } from "./env";

/**
 * Browser context with its own client IP (the backend runs TRUST_PROXY=1; the browser talks to :3005 directly,
 * so the header on the context reaches the throttler). `lang` = value of localStorage `mq-lang` (null = leave unset,
 * which shows the language/region gate). `from` copies the cookies of an API session (logged-in browser).
 */
export async function ipContext(
  browser: Browser,
  opts: { lang?: "en" | "vi" | "zh-TW" | null; from?: { api: Api }; ip?: string } = {},
): Promise<{ context: BrowserContext; page: Page; ip: string }> {
  const ip = opts.ip ?? freshIp();
  const storageState = opts.from ? await opts.from.api.ctx.storageState() : undefined;
  const context = await browser.newContext({
    storageState,
    baseURL: WEB,
    viewport: { width: 1280, height: 800 },
    extraHTTPHeaders: { "x-forwarded-for": ip },
  });
  const lang = opts.lang === undefined ? "en" : opts.lang;
  if (lang) await context.addInitScript((l) => { try { localStorage.setItem("mq-lang", l); } catch { /* ignore */ } }, lang);
  return { context, page: await context.newPage(), ip };
}

/** Same cookies as `who.api`, but a fresh client IP (own throttle buckets). */
export async function apiSameSession(who: { api: Api }, ip: string = freshIp()): Promise<Api> {
  const storageState = await who.api.ctx.storageState();
  return new Api(await request.newContext({ baseURL: API + "/", storageState, extraHTTPHeaders: { "x-forwarded-for": ip } }));
}

import { sql } from "./db";
import { uniq } from "./factory";

/** Fresh e2e e-mail (never an existing account). */
export const newEmail = (prefix: string) => `${uniq(prefix)}@e2e.test`;

/** SQL: ground truth of one user row by e-mail (read only). */
export async function userByEmail(email: string): Promise<any | undefined> {
  return (await sql(
    `SELECT id, email, status, region_code, parent_account_id, root_account_id, sub_account_count, referrer_id FROM users WHERE lower(email) = lower($1)`,
    [email],
  ))[0];
}
export async function userById(id: string): Promise<any | undefined> {
  return (await sql(
    `SELECT id, email, status, region_code, parent_account_id, root_account_id, sub_account_count, referrer_id FROM users WHERE id = $1`,
    [id],
  ))[0];
}

/** A 6-digit code that is certainly not `otp` (deterministic). */
export const wrongOtp = (otp: string) => String((Number(otp) + 1) % 1_000_000).padStart(6, "0");

/** UI step 1 of registration at /my-account/register (e-mail + name only). Lands on /my-account/verify-otp. */
export async function startRegistrationUi(page: Page, email: string, fullName = "E2E Person"): Promise<void> {
  await page.goto("/my-account/register");
  await page.locator("#reg-name").fill(fullName);
  await page.locator("#reg-email").fill(email);
  await page.locator(".mq-auth-actions button[type=submit]").click();
  await page.waitForURL(/\/my-account\/verify-otp/);
}

/** UI step 2 at /my-account/verify-otp: code + password (+ confirmation). Does not wait for the redirect. */
export async function fillVerifyOtpUi(page: Page, otp: string, password: string, confirm = password): Promise<void> {
  await page.locator("#otp-code").fill(otp);
  await page.locator("#otp-password").fill(password);
  await page.locator("#otp-password-confirm").fill(confirm);
  await page.locator(".mq-auth-actions button[type=submit]").first().click();
}

import { anon, ok } from "./api";
import { DEFAULT_PASSWORD } from "./env";
import type { TestUser } from "./factory";

/**
 * Owner creates a one-time invite link (own session, fresh IP) and a new person registers with it through the API
 * (fresh IP, OTP from the backend log). The child is ACTIVE and has a session. Invite creations are not counted by the
 * per-actor creation budget (only POST /sub-accounts and the admin route are).
 */
export async function inviteChild(owner: { api: Api }, prefix = "child"): Promise<TestUser & { token: string }> {
  const ownerApi = await apiSameSession(owner);
  const invite = await ok<any>(await ownerApi.post("sub-accounts/invites"));
  await ownerApi.dispose();
  const email = newEmail(prefix);
  const api = await anon();
  await ok(await api.post("auth/register", { email, fullName: email.split("@")[0], inviteToken: invite.token }));
  await ok(await api.post("auth/register/verify-otp", { email, otp: await latestOtp(email), password: DEFAULT_PASSWORD }), [200, 201]);
  const me = await ok<any>(await api.get("users/me"));
  const u = me.user ?? me;
  return { id: u.id, email, password: DEFAULT_PASSWORD, referralCode: u.referralCode ?? null, api, token: invite.token };
}
import { latestOtp } from "./otp";
