import { test, expect } from "@playwright/test";
import { anon, apiAs, ok } from "../support/api";
import { sql } from "../support/db";
import { createUser } from "../support/factory";
import { apiSameSession, inviteChild, ipContext, newEmail, userById, userByEmail } from "../support/identity";
import { latestOtp } from "../support/otp";
import { DEFAULT_PASSWORD } from "../support/env";

/**
 * Flow 3: sub-accounts (C4). Current behaviour of the unconfirmed D-C4-10 (owner-created accounts wait for the person at the e-mail)
 * is tested as it is, not judged. Owner-created rows are PENDING_ACTIVATION; invite-registered and admin-created ones are ACTIVE.
 * Creation budget: each owner is a fresh user; the shared SUPER_ADMIN creates at most 1 sub-account per test run here.
 */
test.describe.configure({ timeout: 120_000 });

const form = (page: import("@playwright/test").Page) => page.locator("form[novalidate]").first();

test("owner creates a sub-account with a new e-mail in the UI: pending, counter 1 of 100, DB parent/root/referrer/count; an existing user's e-mail is refused", async ({ browser }) => {
  const owner = await createUser({ prefix: "own" });
  const other = await createUser({ prefix: "other" });
  const { page, context } = await ipContext(browser, { from: owner });
  await page.goto("/sub-accounts");
  await expect(page.getByText("0 of 100")).toBeVisible();

  const email = newEmail("sub-new");
  await form(page).locator("input[type=email]").fill(email);
  await form(page).locator("input:not([type=email])").first().fill("New Sub");
  const created = page.waitForResponse((r) => r.url().endsWith("/sub-accounts") && r.request().method() === "POST");
  await form(page).locator("button[type=submit]").click();
  expect((await created).status()).toBe(201);
  await expect(page.getByText("1 of 100")).toBeVisible();
  const row = page.locator("tr", { hasText: email });
  await expect(row).toBeVisible();
  await expect(row).toContainText(/pending|waiting/i);

  const sub = await userByEmail(email);
  expect(sub).toMatchObject({ status: "PENDING_ACTIVATION", parent_account_id: owner.id, root_account_id: owner.id, referrer_id: owner.id });
  expect((await userById(owner.id)).sub_account_count).toBe(1);
  expect((await sql(`SELECT count(*)::int AS n FROM users WHERE parent_account_id = $1 AND status <> 'DELETED'`, [owner.id]))[0].n).toBe(1);
  // a pending account cannot sign in (same answer as a wrong password)
  const raw = await (await anon()).post("auth/login", { email, password: DEFAULT_PASSWORD });
  expect(raw.status()).toBe(401);

  // e-mail of an existing person: refused with EMAIL_ALREADY_IN_USE, nothing created
  await form(page).locator("input[type=email]").fill(other.email);
  const dup = page.waitForResponse((r) => r.url().endsWith("/sub-accounts") && r.request().method() === "POST");
  await form(page).locator("button[type=submit]").click();
  const dupRes = await dup;
  expect(dupRes.status()).toBe(409);
  expect(await dupRes.text()).toContain("EMAIL_ALREADY_IN_USE");
  expect((await userById(owner.id)).sub_account_count).toBe(1);
  expect((await userById(other.id)).parent_account_id).toBeNull();
  await context.close();
});

test("claim: the person at the e-mail confirms through forgot-password in the UI, sets a password, becomes ACTIVE under the owner and can sign in", async ({ browser }) => {
  const owner = await createUser({ prefix: "own-claim" });
  const ownerApi = await apiSameSession(owner);
  const email = newEmail("claim");
  const sub = await ok<any>(await ownerApi.post("sub-accounts", { email, fullName: "Claimer" }));
  expect(sub.parentAccountId).toBe(owner.id);
  expect((await userByEmail(email))?.status).toBe("PENDING_ACTIVATION");

  const { page, context } = await ipContext(browser);
  await page.goto("/my-account/lost-password");
  await page.locator("#lost-email").fill(email);
  await page.locator(".mq-auth-actions button[type=submit]").click();
  await expect(page.locator("#reset-otp")).toBeVisible();
  await page.locator("#reset-otp").fill(await latestOtp(email));
  await page.locator("#reset-password").fill("Claimed-Pass1!");
  await page.locator(".mq-auth-actions button[type=submit]").click();
  await page.waitForURL(/\/my-account/);
  await expect.poll(async () => (await userByEmail(email))?.status).toBe("ACTIVE");
  expect(await userByEmail(email)).toMatchObject({ parent_account_id: owner.id, root_account_id: owner.id });

  const login = await (await anon()).post("auth/login", { email, password: "Claimed-Pass1!" });
  expect(login.status()).toBe(200);
  expect((await userById(owner.id)).sub_account_count).toBe(1);
  await context.close();
});

test("decline: the person at the e-mail refuses at /my-account/decline-sub-account; the reservation is gone and the owner's slot is back", async ({ browser }) => {
  const owner = await createUser({ prefix: "own-decl" });
  const ownerApi = await apiSameSession(owner);
  const email = newEmail("decline");
  const sub = await ok<any>(await ownerApi.post("sub-accounts", { email }));
  expect((await userById(owner.id)).sub_account_count).toBe(1);
  const code = await latestOtp(email);

  const { page, context } = await ipContext(browser);
  await page.goto(`/my-account/decline-sub-account?email=${encodeURIComponent(email)}`);
  await page.locator("#decline-code").fill("000000".replace(/0/g, code[0] === "0" ? "1" : "0"));
  await page.locator(".mq-auth-actions button[type=submit]").click();
  await expect(page.locator("[role=alert]")).toBeVisible(); // a wrong code is refused
  expect((await userById(sub.id)).status).toBe("PENDING_ACTIVATION");

  await page.locator("#decline-code").fill(code);
  const done = page.waitForResponse((r) => r.url().includes("/auth/sub-account/decline"));
  await page.locator(".mq-auth-actions button[type=submit]").click();
  expect((await done).status()).toBeLessThan(300);
  await expect(page.locator(".mq-alert-success")).toBeVisible();

  const after = await userById(sub.id);
  expect(after?.status === "PENDING_ACTIVATION").toBe(false);
  expect((await userById(owner.id)).sub_account_count).toBe(0);
  // the same e-mail cannot be logged into
  expect((await (await anon()).post("auth/login", { email, password: DEFAULT_PASSWORD })).status()).toBe(401);
  await context.close();
});

test("invite link works once: first person registers as a child in the UI, the second attempt with the same link is refused", async ({ browser }) => {
  const owner = await createUser({ prefix: "own-inv" });
  const o = await ipContext(browser, { from: owner });
  await o.page.goto("/sub-accounts");
  await o.page.getByRole("button", { name: "Create invite link" }).click();
  const link = await o.page.getByLabel("Invite link").inputValue();
  expect(link).toMatch(/\/register\?invite=/);
  await o.context.close();

  // first person
  const email = newEmail("invited");
  const first = await ipContext(browser);
  await first.page.goto(link); // /register redirects to /my-account/register
  await expect(first.page.locator("#reg-email")).toBeVisible();
  await expect(first.page.locator(".mq-alert-success")).toBeVisible(); // invite banner
  await first.page.locator("#reg-email").fill(email);
  await first.page.locator(".mq-auth-actions button[type=submit]").click();
  await first.page.waitForURL(/verify-otp/);
  await first.page.locator("#otp-code").fill(await latestOtp(email));
  await first.page.locator("#otp-password").fill("Invited-Pass1!");
  await first.page.locator("#otp-password-confirm").fill("Invited-Pass1!");
  await first.page.locator(".mq-auth-actions button[type=submit]").first().click();
  await first.page.waitForURL((u) => !u.pathname.includes("verify-otp"));
  expect(await userByEmail(email)).toMatchObject({ status: "ACTIVE", parent_account_id: owner.id, root_account_id: owner.id, referrer_id: owner.id });
  expect((await userById(owner.id)).sub_account_count).toBe(1);
  expect((await sql(`SELECT status FROM sub_account_invites WHERE parent_id = $1`, [owner.id])).map((r) => r.status)).toEqual(["USED"]);
  await first.context.close();

  // second person, same link
  const email2 = newEmail("invited2");
  const second = await ipContext(browser);
  await second.page.goto(link);
  await second.page.locator("#reg-email").fill(email2);
  await second.page.locator(".mq-auth-actions button[type=submit]").click();
  await expect(second.page.locator(".mq-alert-error")).toBeVisible();
  await expect(second.page).not.toHaveURL(/verify-otp/);
  expect(await userByEmail(email2)).toBeUndefined();
  expect((await userById(owner.id)).sub_account_count).toBe(1);
  // API: the used token is refused as well
  const bad = await (await anon()).post("auth/register", { email: email2, inviteToken: link.split("invite=")[1] });
  expect(bad.status()).toBe(400);
  expect(await bad.text()).toContain("SUB_ACCOUNT_INVITE_INVALID");
  await second.context.close();
});

test("nested tree: admin page /admin/accounts/[id]/sub-accounts shows the exact tree; DB parent/root/referrer chain matches", async ({ browser }) => {
  const root = await createUser({ prefix: "tree-root" });
  const a = await inviteChild(root, "tree-a");
  const b = await inviteChild(root, "tree-b");
  const c = await inviteChild(a, "tree-c");
  const d = await inviteChild(a, "tree-d");
  const e = await inviteChild(c, "tree-e");
  // DB truth
  for (const [child, parent] of [[a, root], [b, root], [c, a], [d, a], [e, c]] as const) {
    expect(await userById(child.id), child.email).toMatchObject({ parent_account_id: parent.id, root_account_id: root.id, referrer_id: parent.id, status: "ACTIVE" });
  }
  expect(await Promise.all([root, a, b, c, d, e].map(async (u) => (await userById(u.id)).sub_account_count))).toEqual([2, 2, 0, 1, 0, 0]);

  const sa = await ipContext(browser, { from: { api: await apiAs("SUPER_ADMIN") } });
  await sa.page.goto(`/admin/accounts/${root.id}/sub-accounts`);
  const emails = [a, b, c, d, e].map((u) => u.email);
  for (const em of emails) await expect(sa.page.locator("tr", { hasText: em })).toBeVisible();
  await expect(sa.page.locator("tbody tr")).toHaveCount(5);
  const pad = async (em: string) => sa.page.locator("tr", { hasText: em }).locator("td").first().evaluate((el) => parseFloat(getComputedStyle(el).paddingLeft));
  const [pa, pb, pc, pd, pe] = await Promise.all(emails.map(pad));
  expect(pa).toBe(pb);
  expect(pc).toBe(pd);
  expect(pc).toBeGreaterThan(pa);
  expect(pe).toBeGreaterThan(pc);
  await expect(sa.page.getByText(root.email).first()).toBeVisible(); // root account is named
  // the API of the same page: a middle node lists only its own subtree, every item points to the right parent
  const tree = await ok<any>(await (await apiAs("SUPER_ADMIN")).get(`admin/accounts/${a.id}/sub-accounts`));
  expect(tree.items.map((i: any) => i.email).sort()).toEqual([c.email, d.email, e.email].sort());
  expect(Object.fromEntries(tree.items.map((i: any) => [i.email, i.parentAccountId]))).toEqual({ [c.email]: a.id, [d.email]: a.id, [e.email]: c.id });
  const rootInfo = await ok<any>(await (await apiAs("SUPER_ADMIN")).get(`admin/accounts/${e.id}/root`));
  expect(rootInfo.root.id).toBe(root.id);
  expect(rootInfo.depth).toBe(3);
  await sa.context.close();
});

test("admin creates a sub-account on behalf of an account in the UI (reason required): ACTIVE at once, under that account", async ({ browser }) => {
  const owner = await createUser({ prefix: "own-adm" });
  const sa = await ipContext(browser, { from: { api: await apiAs("SUPER_ADMIN") } });
  await sa.page.goto(`/admin/accounts/${owner.id}/sub-accounts`);
  const email = newEmail("by-admin");
  await form(sa.page).locator("input[type=email]").fill(email);
  // reason missing -> refused in the browser, nothing created
  await form(sa.page).locator("button[type=submit]").click();
  await expect(form(sa.page).locator("[role=alert]")).toBeVisible();
  expect(await userByEmail(email)).toBeUndefined();
  await form(sa.page).locator("textarea").fill("e2e: created on behalf of the account owner");
  const created = sa.page.waitForResponse((r) => r.url().endsWith(`/admin/accounts/${owner.id}/sub-accounts`) && r.request().method() === "POST");
  await form(sa.page).locator("button[type=submit]").click();
  expect((await created).status()).toBe(201);
  await expect(sa.page.locator("tr", { hasText: email })).toBeVisible();
  expect(await userByEmail(email)).toMatchObject({ status: "ACTIVE", parent_account_id: owner.id, root_account_id: owner.id, referrer_id: owner.id });
  expect((await userById(owner.id)).sub_account_count).toBe(1);
  await sa.context.close();
});

test("BUYER and SELLER cannot use /admin/*: pages redirect away, admin sub-account APIs answer 403, owners only see their own children", async ({ browser }) => {
  const victim = await createUser({ prefix: "own-authz" });
  const child = await inviteChild(victim, "authz-child");
  for (const role of ["BUYER", "SELLER"] as const) {
    const who = { api: await apiAs(role) };
    const { page, context } = await ipContext(browser, { from: who });
    for (const path of [`/admin/accounts/${victim.id}/sub-accounts`, "/admin"]) {
      await page.goto(path);
      await expect.poll(() => new URL(page.url()).pathname, { message: `${role} on ${path}` }).not.toMatch(/^\/admin/);
    }
    await page.goto(`/admin/accounts/${victim.id}/sub-accounts`);
    await expect(page.getByText(child.email)).toHaveCount(0);
    await context.close();
    const api = await apiSameSession(who);
    expect((await api.get(`admin/accounts/${victim.id}/sub-accounts`)).status()).toBe(403);
    expect((await api.get(`admin/accounts/${victim.id}/root`)).status()).toBe(403);
    expect((await api.post(`admin/accounts/${victim.id}/sub-accounts`, { email: newEmail("nope"), reason: "e2e attempt" })).status()).toBe(403);
    // own list never contains another owner's child
    const mine = await ok<any>(await api.get("sub-accounts"));
    expect(JSON.stringify(mine)).not.toContain(child.email);
  }
  // SQL: nothing was created by the refused calls
  expect((await userById(victim.id)).sub_account_count).toBe(1);
});

test("DB guards: chk_users_sub_account_count refuses a negative counter; parent/root of an existing account cannot be rewritten", async () => {
  const owner = await createUser({ prefix: "own-db" });
  const child = await inviteChild(owner, "db-child");
  const other = await createUser({ prefix: "own-db2" });
  // SQL: direct UPDATEs that must be refused by the database (nothing changes)
  const def = await sql(`SELECT pg_get_constraintdef(oid) AS d FROM pg_constraint WHERE conname = 'chk_users_sub_account_count'`);
  expect(def[0].d).toContain("sub_account_count >= 0");
  await expect(sql(`UPDATE users SET sub_account_count = -1 WHERE id = $1`, [owner.id])).rejects.toThrow(/chk_users_sub_account_count/);
  await expect(sql(`UPDATE users SET parent_account_id = $1 WHERE id = $2`, [other.id, child.id])).rejects.toThrow();
  await expect(sql(`UPDATE users SET root_account_id = $1 WHERE id = $2`, [other.id, child.id])).rejects.toThrow();
  expect(await userById(child.id)).toMatchObject({ parent_account_id: owner.id, root_account_id: owner.id });
  expect((await userById(owner.id)).sub_account_count).toBe(1);
});
