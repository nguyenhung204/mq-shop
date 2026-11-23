import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { apiAs } from "../support/api";
import { claimQuarter, deliveredOrderIn, pageAs, seedSlots } from "../support/admin-flows";
import { checkoutPending } from "../support/currency";
import { createCreditedReferralOrder, createSellerWithSku, createUser, openRma } from "../support/factory";
import { pageIn, setWalletPin, tr } from "../support/money-inputs";

/**
 * Flow 18: full-page screenshots of the money-critical screens for the handover. Own data per test, fixed file names,
 * no pixel assertions (each test only waits for the numbers it photographs to be on screen).
 * Output: e2e/.report-extra/screenshots/NN-*.png (git-ignored).
 */
test.describe.configure({ timeout: 180_000 });

const DIR = path.join(__dirname, "..", ".report-extra", "screenshots");
async function shot(page: Page, name: string) {
  fs.mkdirSync(DIR, { recursive: true });
  await page.evaluate(() => document.fonts.ready); // pages poll (notifications), so "networkidle" never comes
  await page.screenshot({ path: path.join(DIR, name), fullPage: true });
}

test("01 seller partial-refund dialog with 40000 typed (en)", async ({ browser }) => {
  const s = await createCreditedReferralOrder();
  await openRma(s.buyer, s.order.id);
  const { page, context } = await pageAs(browser, s.referrer.user, "en");
  try {
    await page.goto("/seller/rma");
    await page.getByRole("button", { name: "Approve", exact: true }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(/At most 100005\.00/)).toBeVisible();
    await dialog.getByLabel("Refund amount (TWD, optional)").fill("40000");
    await expect(dialog.getByRole("status")).toContainText("Partial refund of 40000.00");
    await shot(page, "01-partial-refund-modal-en.png");
  } finally { await context.close(); }
});

test("02 dividend report of a locked quarter (SUPER_ADMIN)", async ({ browser }) => {
  const claim = await claimQuarter();
  let ctx: Awaited<ReturnType<typeof pageAs>> | null = null;
  try {
    const seller = await createSellerWithSku({ unitPrice: "14285.71", prefix: "shotdiv" });
    const buyer = await createUser({ prefix: "shotdivbuyer" });
    const holders = [await createUser({ prefix: "shotholder", fullName: "e2e screenshot holder 0" }), await createUser({ prefix: "shotholder", fullName: "e2e screenshot holder 1" })];
    claim.track({ userIds: holders.map((h) => h.id) });
    await seedSlots(claim.quarter, [{ userId: holders[0].id, versions: [3] }, { userId: holders[1].id, versions: [7] }]);
    await deliveredOrderIn(claim.quarter, claim, buyer, seller);
    ctx = await pageAs(browser, { api: await apiAs("SUPER_ADMIN") }, "en");
    await ctx.page.goto("/admin/dividend/report");
    await ctx.page.getByLabel("Quarter").selectOption(claim.quarter);
    await expect(ctx.page.getByText("Locked (read-only)")).toBeVisible();
    await expect(ctx.page.getByRole("row").filter({ hasText: holders[1].email })).toContainText("999 TWD");
    await shot(ctx.page, "02-dividend-report-locked-quarter-en.png");
  } finally {
    await ctx?.context.close();
    await claim.release();
  }
});

test("03 order detail with the amount to pay in USD and the locked rate", async ({ browser }) => {
  const seller = await createSellerWithSku({ unitPrice: "1234.00", prefix: "shotusd" });
  const buyer = await createUser({ prefix: "shotusdbuyer" });
  const { order, fx } = await checkoutPending(buyer, seller, "USD");
  const { page, context } = await pageAs(browser, buyer, "en");
  try {
    await page.goto(`/orders/${order.id}`);
    const box = page.locator("[data-payable]");
    await expect(box).toContainText("Amount to pay");
    await expect(box).toContainText(`1 TWD = ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(fx.rates.USD)} USD`);
    await shot(page, "03-order-amount-to-pay-usd-en.png");
  } finally { await context.close(); }
});

test("04 accounting export page", async ({ browser }) => {
  const { page, context } = await pageAs(browser, { api: await apiAs("SUPER_ADMIN") }, "en");
  try {
    await page.goto("/admin/accounting-export");
    await expect(page.getByRole("heading").first()).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Application error");
    await shot(page, "04-accounting-export-en.png");
  } finally { await context.close(); }
});

test("05 FX rates page in Vietnamese with prefilled formatted values", async ({ browser }) => {
  const { page, context } = await pageIn(browser, { api: await apiAs("SUPER_ADMIN") }, "vi");
  try {
    await page.goto("/admin/finance/configs");
    for (const code of ["MYR", "VND", "SGD", "USD"]) {
      const input = page.getByLabel(tr("vi", "admin.fx.quoteLabel", { code }));
      await expect(input).not.toHaveValue("");
      expect(await input.inputValue(), `${code} prefill uses the vi decimal comma`).not.toMatch(/\d\.\d/);
    }
    await shot(page, "05-fx-rates-vi.png");
  } finally { await context.close(); }
});

test("06 withdraw of 999999999999.99 shows the error", async ({ browser }) => {
  const user = await createUser({ prefix: "shotwd" });
  await setWalletPin(user, "123456");
  const { page, context } = await pageIn(browser, user, "en");
  try {
    await page.goto("/wallet/withdraw");
    const amount = page.getByLabel(tr("en", "wallet.p2pAmount"));
    await expect(amount).toBeEnabled();
    await page.getByLabel(tr("en", "wallet.pin")).fill("123456");
    await page.getByLabel(tr("en", "wallet.bankName")).fill("E2E Bank");
    await page.getByLabel(tr("en", "wallet.accountNumber")).fill("123456789");
    await page.getByLabel(tr("en", "wallet.accountName"), { exact: true }).fill("E2E Holder");
    await amount.fill("999999999999.99");
    const resp = page.waitForResponse((r) => /\/wallet\/withdraw$/.test(r.url()) && r.request().method() === "POST");
    await page.getByRole("button", { name: tr("en", "wallet.withdrawSubmit") }).click();
    expect((await resp).status()).toBeGreaterThanOrEqual(400);
    await expect(page.locator("[data-sonner-toast], form p[role=alert], [role=alert]").first()).toBeVisible();
    await shot(page, "06-withdraw-too-large-en.png");
  } finally { await context.close(); }
});
