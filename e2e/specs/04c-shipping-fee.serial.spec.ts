import { expect, test } from "@playwright/test";
import { ok } from "../support/api";
import { apiAs } from "../support/api";
import { pageAs, putSetting, settingOf } from "../support/admin-flows";
import { createSellerWithSku, createUser, placeOrder } from "../support/factory";

/**
 * Spec 11/11 s2.2: the shipping fee is a setting (shippingFeeTwd, default 5.00). SERIAL because it changes a global setting; the
 * original value is restored in `finally`. Checks the whole chain: UI edit -> setting -> quote -> order total -> old orders keep their fee.
 */
const KEY = "shippingFeeTwd";
const ADDRESS = { fullName: "E2E Buyer", phone: "0900000000", line1: "1 Test Road", city: "Taipei", country: "TW" };

test("SUPER_ADMIN changes the shipping fee in the UI: new quotes and orders use it, old orders keep theirs", async ({ browser }) => {
  test.setTimeout(180_000);
  const sa = await apiAs("SUPER_ADMIN");
  const orig = await settingOf(sa, KEY);
  const seller = await createSellerWithSku({ unitPrice: "100.00", prefix: "shipseller" });
  const buyer = await createUser({ prefix: "shipbuyer" });
  const items = [{ variantId: seller.variantId, quantity: 1 }];
  const { page, context } = await pageAs(browser, { api: sa });
  try {
    expect(orig.value).toBe(5); // default = the former flat fee (a previous run restores it)

    // order placed before the change keeps 5.00
    const before = await placeOrder(buyer, seller);
    expect(Number(before.shippingFee)).toBe(5);

    await page.goto("/admin/settings");
    const row = page.getByRole("row").filter({ hasText: "Shipping fee (TWD)" });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Edit" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Value", { exact: true }).fill("12.50");
    await dialog.getByLabel("Reason").fill("e2e shipping fee");
    const saved = page.waitForResponse((r) => r.request().method() === "PUT" && r.url().includes(`/admin/settings/${KEY}`));
    await dialog.getByRole("button", { name: "Save setting" }).click();
    expect((await saved).status()).toBe(200);
    await expect(row).toContainText("12.5");

    const quote = await ok<any>(await buyer.api.post("orders/shipping-quote", { items, shippingAddress: ADDRESS }));
    expect((quote.data ?? quote).shippingFee).toBe(12.5);

    const after = await placeOrder(buyer, seller);
    expect(Number(after.shippingFee)).toBe(12.5);
    expect(Number(after.total)).toBe(Number(after.subtotal) + 12.5);

    // the old order is not touched
    const old = await ok<any>(await buyer.api.get(`orders/${before.id}`));
    expect(Number((old.data ?? old).shippingFee)).toBe(5);
  } finally {
    await context.close();
    const now = await settingOf(sa, KEY);
    if (now.value !== orig.value) await putSetting(sa, KEY, orig.value, "e2e restore");
  }
  expect((await settingOf(sa, KEY)).value).toBe(orig.value);
});
