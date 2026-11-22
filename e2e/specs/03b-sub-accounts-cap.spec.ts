import { test, expect } from "@playwright/test";
import { anon, apiAs, ok } from "../support/api";
import { sql } from "../support/db";
import { createUser } from "../support/factory";
import { apiSameSession, inviteChild, ipContext, newEmail, userById } from "../support/identity";
import { latestOtp } from "../support/otp";
import { DEFAULT_PASSWORD } from "../support/env";

/**
 * Cap of 100 direct sub-accounts per account (setting maxSubAccountsPerAccount, default 100, not changed here).
 * The 100 children are made through one-time invite links (each with its own client IP: invite creation is 10/min/IP,
 * registration 3/min/IP). Invites are not counted by the per-actor creation budget, which would stop at 30/hour.
 */
test.describe.configure({ timeout: 300_000 });

test("the 101st sub-account is refused: UI shows 100 of 100 and blocks the form; API/invite/admin answer 409 SUB_ACCOUNT_LIMIT; DB counter = real count = 100", async ({ browser }) => {
  const owner = await createUser({ prefix: "cap-owner" });
  const BATCH = 10;
  for (let done = 0; done < 100; done += BATCH) {
    await Promise.all(Array.from({ length: BATCH }, (_, i) => inviteChild(owner, `cap-${done + i}`)));
  }

  // SQL: counter, real number of live children, check constraint
  expect((await userById(owner.id)).sub_account_count).toBe(100);
  expect((await sql(`SELECT count(*)::int AS n FROM users WHERE parent_account_id = $1 AND status <> 'DELETED'`, [owner.id]))[0].n).toBe(100);
  expect((await sql(`SELECT count(*)::int AS n FROM users WHERE root_account_id = $1 AND id <> $1`, [owner.id]))[0].n).toBe(100);

  // UI: the owner's page
  const { page, context } = await ipContext(browser, { from: owner });
  await page.goto("/sub-accounts");
  await expect(page.getByText("100 of 100")).toBeVisible();
  await expect(page.getByText("You have reached the maximum number of sub-accounts.")).toBeVisible();
  const form = page.locator("form[novalidate]").first();
  await form.locator("input[type=email]").fill(newEmail("cap-101"));
  await expect(form.locator("button[type=submit]")).toBeDisabled();
  await context.close();

  const ownerApi = await apiSameSession(owner);
  // owner API (the owner's creation budget is untouched: invites do not count)
  const email101 = newEmail("cap-101-api");
  const direct = await ownerApi.post("sub-accounts", { email: email101 });
  expect(direct.status()).toBe(409);
  expect(await direct.text()).toContain("SUB_ACCOUNT_LIMIT");
  // a 101st person with a valid invite: refused at the final step, the link stays usable
  const invite = await ok<any>(await ownerApi.post("sub-accounts/invites"));
  const email101b = newEmail("cap-101-inv");
  const reg = await anon();
  const start = await reg.post("auth/register", { email: email101b, inviteToken: invite.token });
  const verify = start.ok()
    ? await reg.post("auth/register/verify-otp", { email: email101b, otp: await latestOtp(email101b), password: DEFAULT_PASSWORD })
    : start;
  expect(verify.status()).toBe(409);
  expect(await verify.text()).toContain("SUB_ACCOUNT_LIMIT");
  expect((await sql(`SELECT status FROM sub_account_invites WHERE parent_id = $1 ORDER BY created_at DESC LIMIT 1`, [owner.id]))[0].status).toBe("PENDING");
  // staff on behalf of the account: same cap
  const adm = await (await apiAs("SUPER_ADMIN")).post(`admin/accounts/${owner.id}/sub-accounts`, { email: newEmail("cap-101-adm"), reason: "e2e cap check" });
  expect(adm.status()).toBe(409);
  expect(await adm.text()).toContain("SUB_ACCOUNT_LIMIT");

  // nothing leaked in
  expect((await userById(owner.id)).sub_account_count).toBe(100);
  expect((await sql(`SELECT count(*)::int AS n FROM users WHERE parent_account_id = $1 AND status <> 'DELETED'`, [owner.id]))[0].n).toBe(100);
  expect((await sql(`SELECT count(*)::int AS n FROM users WHERE lower(email) IN ($1,$2)`, [email101, email101b]))[0].n).toBe(0);
  const list = await (await ownerApi.get("sub-accounts?page=1&pageSize=5")).json();
  expect(list.meta).toMatchObject({ subAccountCount: 100, cap: 100 });
});
