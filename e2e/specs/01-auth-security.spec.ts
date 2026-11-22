import { test, expect, request } from "@playwright/test";
import { anon, apiAs, ok, freshIp } from "../support/api";
import { createUser } from "../support/factory";
import { fillVerifyOtpUi, ipContext, newEmail, startRegistrationUi, userByEmail, wrongOtp } from "../support/identity";
import { latestOtp } from "../support/otp";
import { API } from "../support/env";

/**
 * Flow 1: registration and security (UI: /my-account/register, /my-account/verify-otp, /my-account).
 * Each test makes its own accounts; seed accounts are never used for failed logins.
 */

const PASSWORD = "E2ePassw0rd!";

async function loginRaw(email: string, password: string, ip: string) {
  const ctx = await request.newContext({ baseURL: API + "/", extraHTTPHeaders: { "x-forwarded-for": ip } });
  const res = await ctx.post("auth/login", { data: { email, password } });
  const out = { status: res.status(), body: await res.text() };
  await ctx.dispose();
  return out;
}

test.describe("registration (UI)", () => {
  test("register form has no password field; submitting goes to verify-otp (e-mail in the URL)", async ({ browser }) => {
    const { page } = await ipContext(browser);
    await page.goto("/my-account/register");
    await expect(page.locator("#reg-email")).toBeVisible();
    await expect(page.locator("#reg-name")).toBeVisible();
    await expect(page.locator("input[type=password]")).toHaveCount(0);
    await expect(page.getByLabel(/password/i)).toHaveCount(0);

    const email = newEmail("reg-nopw");
    const reqPromise = page.waitForRequest((r) => r.url().endsWith("/auth/register") && r.method() === "POST");
    await page.locator("#reg-name").fill("No Password");
    await page.locator("#reg-email").fill(email);
    await page.locator(".mq-auth-actions button[type=submit]").click();
    const body = (await reqPromise).postDataJSON();
    expect(Object.keys(body).sort()).not.toContain("password");
    expect(body.email).toBe(email);
    await page.waitForURL(/\/my-account\/verify-otp\?email=/);
    expect(new URL(page.url()).searchParams.get("email")).toBe(email);
    // the verify page is where the password is chosen
    await expect(page.locator("#otp-password")).toBeVisible();
    await expect(page.locator("#otp-password-confirm")).toBeVisible();
    // nothing exists until the code is proven
    expect(await userByEmail(email)).toBeUndefined();
  });

  test("wrong OTP shows an error and creates nothing; right OTP + password creates the account and signs in; the password works at /my-account", async ({ browser }) => {
    const email = newEmail("reg-flow");
    const { page, context } = await ipContext(browser);
    await startRegistrationUi(page, email, "Flow Person");
    const otp = await latestOtp(email);

    // wrong code
    await fillVerifyOtpUi(page, wrongOtp(otp), PASSWORD);
    await expect(page.locator(".mq-alert-error")).toBeVisible();
    await expect(page).toHaveURL(/\/my-account\/verify-otp/);
    expect(await userByEmail(email)).toBeUndefined(); // SQL: still no user after a wrong code

    // password mismatch is refused in the browser, no request, no account
    await page.locator("#otp-code").fill(otp);
    await page.locator("#otp-password-confirm").fill("different-Pass1");
    await page.locator(".mq-auth-actions button[type=submit]").first().click();
    await expect(page.locator(".mq-alert-error")).toBeVisible();
    expect(await userByEmail(email)).toBeUndefined();

    // right code + password
    await page.locator("#otp-password-confirm").fill(PASSWORD);
    await page.locator("#otp-password").fill(PASSWORD);
    const verified = page.waitForResponse((r) => r.url().endsWith("/auth/register/verify-otp") && r.request().method() === "POST");
    await page.locator(".mq-auth-actions button[type=submit]").first().click();
    expect((await verified).status()).toBe(201);
    await page.waitForURL((u) => !u.pathname.includes("verify-otp"));
    const row = await userByEmail(email);
    expect(row?.status).toBe("ACTIVE");

    // signed in: the My account hub greets the new user
    await page.goto("/my-account");
    await expect(page.getByRole("heading", { name: /^Welcome, / })).toBeVisible();

    // sign out, then sign in again with the password chosen at verify-otp (own IP -> own throttle bucket)
    await context.close();
    const second = await ipContext(browser);
    await second.page.goto("/my-account");
    await second.page.locator("#login-email").fill(email);
    await second.page.locator("#login-password").fill(PASSWORD);
    const login = second.page.waitForResponse((r) => r.url().endsWith("/auth/login") && r.request().method() === "POST");
    await second.page.locator(".mq-auth-actions button[type=submit]").click();
    expect((await login).status()).toBe(200);
    await expect.poll(() => new URL(second.page.url()).pathname).not.toBe("/my-account/login");
    await second.context.close();
  });

  test("registering someone else's e-mail without the OTP leaves no account; the attacker cannot sign in or pick the victim's password", async ({ browser }) => {
    const victim = newEmail("victim");
    const { page, context } = await ipContext(browser);
    await startRegistrationUi(page, victim, "Not The Owner");
    // attacker stops here (cannot read the mailbox). SQL: no user with that e-mail
    expect(await userByEmail(victim)).toBeUndefined();
    await context.close();

    // API: a guessed code is refused, still nothing; the e-mail does not log in
    const api = await anon();
    const real = await latestOtp(victim);
    const bad = await api.post("auth/register/verify-otp", { email: victim, otp: wrongOtp(real), password: "Attacker123!" });
    expect(bad.status()).toBeGreaterThanOrEqual(400);
    expect(bad.status()).toBeLessThan(500);
    expect(await userByEmail(victim)).toBeUndefined();
    expect((await loginRaw(victim, "Attacker123!", freshIp())).status).toBe(401);

    // the attacker also tries to smuggle a password into the first step
    const smuggle = await api.post("auth/register", { email: victim, fullName: "x", password: "Attacker123!" });
    expect(smuggle.status()).toBeLessThan(500);
    expect(await userByEmail(victim)).toBeUndefined();

    // the real owner proves the mailbox with the newest code and chooses his own password
    const code = await latestOtp(victim);
    await ok(await (await anon()).post("auth/register/verify-otp", { email: victim, otp: code, password: PASSWORD }), [200, 201]);
    expect((await userByEmail(victim))?.status).toBe("ACTIVE");
    expect((await loginRaw(victim, "Attacker123!", freshIp())).status).toBe(401);
    expect((await loginRaw(victim, PASSWORD, freshIp())).status).toBe(200);
  });
});

test.describe("login failures and lock", () => {
  test("wrong password in the UI is reported as invalid credentials (not as an expired session)", async ({ browser }) => {
    const user = await createUser({ prefix: "badpw" });
    const { page } = await ipContext(browser);
    await page.goto("/my-account");
    await page.locator("#login-email").fill(user.email);
    await page.locator("#login-password").fill("Wrong-pass-1");
    await page.locator(".mq-auth-actions button[type=submit]").click();
    const alert = page.locator(".mq-alert-error");
    await expect(alert).toBeVisible();
    await expect(alert).not.toContainText(/session expired/i);
    await expect(alert).toContainText(/invalid|incorrect|wrong/i);
  });

  test("API: 5 wrong passwords from one IP are 401, the 6th from that IP is 429 (per-IP throttle)", async () => {
    const user = await createUser({ prefix: "thr" });
    const ip = freshIp();
    for (let i = 0; i < 5; i++) expect((await loginRaw(user.email, "Wrong-pass-1", ip)).status).toBe(401);
    expect((await loginRaw(user.email, "Wrong-pass-1", ip)).status).toBe(429);
    // another IP is a different bucket: the right password still works (the throttle is not an account lock)
    expect((await loginRaw(user.email, user.password, freshIp())).status).toBe(200);
  });

  test("UI: 5 wrong passwords then a 6th attempt is refused with a visible error and no sign-in", async ({ browser }) => {
    const user = await createUser({ prefix: "uithr" });
    const { page } = await ipContext(browser);
    await page.goto("/my-account");
    for (let i = 0; i < 5; i++) {
      const r = page.waitForResponse((x) => x.url().endsWith("/auth/login"));
      await page.locator("#login-email").fill(user.email);
      await page.locator("#login-password").fill(`Wrong-pass-${i}`);
      await page.locator(".mq-auth-actions button[type=submit]").click();
      expect((await r).status()).toBe(401);
      await expect(page.locator(".mq-alert-error")).toBeVisible();
    }
    const sixth = page.waitForResponse((x) => x.url().endsWith("/auth/login"));
    await page.locator("#login-password").fill(user.password); // even the RIGHT password is refused now
    await page.locator(".mq-auth-actions button[type=submit]").click();
    expect((await sixth).status()).toBe(429);
    await expect(page.locator(".mq-alert-error")).toBeVisible();
    await expect(page).toHaveURL(/\/my-account$/);
    await expect(page.getByRole("heading", { name: /^Welcome, / })).toHaveCount(0);
  });

  // Owner decision 2026-11-22: NO per-account lockout after failed logins. Brute-force protection = per-IP throttle only (tests above).

  test("an account locked by an admin cannot sign in: API 403 ACCOUNT_LOCKED and a visible UI error; works again after unlock", async ({ browser }) => {
    const user = await createUser({ prefix: "adminlock" });
    const sa = await apiAs("SUPER_ADMIN");
    await ok(await sa.post(`admin/users/${user.id}/lock`));
    try {
      expect((await userByEmail(user.email))?.status).toBe("LOCKED");
      const raw = await loginRaw(user.email, user.password, freshIp());
      expect(raw.status).toBe(403);
      expect(raw.body).toContain("ACCOUNT_LOCKED");
      const { page } = await ipContext(browser);
      await page.goto("/my-account");
      await page.locator("#login-email").fill(user.email);
      await page.locator("#login-password").fill(user.password);
      await page.locator(".mq-auth-actions button[type=submit]").click();
      await expect(page.locator(".mq-alert-error")).toContainText(/lock/i);
      await expect(page.getByRole("heading", { name: /^Welcome, / })).toHaveCount(0);
    } finally {
      await ok(await sa.post(`admin/users/${user.id}/unlock`));
    }
    expect((await loginRaw(user.email, user.password, freshIp())).status).toBe(200);
  });
});
