import { expect, test } from "@playwright/test";
import { apiAs, ok } from "../support/api";
import { checkoutPending, displayCents, fmt, fxNow } from "../support/currency";
import { createSellerWithSku, createUser, getOrder } from "../support/factory";
import { errOf, pageAs } from "../support/admin-flows";

/**
 * Flow 5 (SERIAL): changing the display FX rates (UI /admin/fx-rates, its own page for ADMIN + SUPER_ADMIN) never changes an
 * existing order: its amount to pay and locked rate stay as they were. A new order uses the new rate. The original rates are
 * restored in `finally` (the rate table is versioned, so the restore adds a new "latest" row; history rows stay).
 */
test("an FX change does not move an old order; new orders use the new rate; rates restored", async ({ browser }) => {
  test.setTimeout(180_000);
  const sa = await apiAs("SUPER_ADMIN");
  const orig = (await ok<any>(await sa.get("admin/fx/rates"))).latest.rates as Record<string, number>;
  const restore = { MYR: orig.MYR, VND: orig.VND, SGD: orig.SGD, USD: orig.USD };
  const seller = await createSellerWithSku({ unitPrice: "1234.00", prefix: "fxseller" });
  const buyer = await createUser({ prefix: "fxbuyer" });
  const { page, context } = await pageAs(browser, buyer);
  const admin = await pageAs(browser, { api: sa });
  try {
    const { order: old, fx } = await checkoutPending(buyer, seller, "USD");
    const oldCents = displayCents(123_900n, String(fx.rates.USD));
    expect(BigInt(Math.round(old.payableAmount * 100))).toBe(oldCents);

    // ---- /admin/fx-rates is its own page for ADMIN + SUPER_ADMIN (no redirect since the RBAC alignment): the panel is edited there
    await admin.page.goto("/admin/fx-rates");
    await expect(admin.page).toHaveURL(/\/admin\/fx-rates$/);
    const newUsd = orig.USD === 0.05 ? "0.06" : "0.05";
    await admin.page.getByLabel("How much USD for 1 TWD").fill(newUsd);
    const saved = admin.page.waitForResponse((r) => r.url().includes("/admin/fx/rates") && r.request().method() === "PUT");
    await admin.page.getByRole("button", { name: "Save rates" }).click();
    expect((await saved).status()).toBe(200);
    const after = await fxNow(buyer.api);
    expect(after.rates.USD).toBe(Number(newUsd));
    expect(after.asOf).not.toBe(fx.asOf);

    // ---- the old order is untouched (API and UI)
    const same = await getOrder(buyer.api, old.id);
    expect(same.payableAmount).toBe(old.payableAmount);
    expect(same.fxRateLocked).toBe(fx.rates.USD);
    expect(same.fxAsOf).toBe(old.fxAsOf);
    expect(same.total).toBe(1239);
    await page.goto(`/orders/${old.id}`);
    const box = page.locator("[data-payable]");
    await expect(box).toContainText(fmt(oldCents, "USD"));
    await expect(box).toContainText(`1 TWD = ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(fx.rates.USD)} USD`);

    // ---- a checkout that still carries the old rate version is refused, a fresh one uses the new rate
    const stale = await buyer.api.post("orders/checkout", {
      items: [{ variantId: seller.variantId, quantity: 1 }],
      shippingAddress: { fullName: "E2E Buyer", phone: "0900000000", line1: "1 Test Road", city: "Taipei", country: "TW" },
      paymentMethod: "OFF_PLATFORM",
      displayCurrency: "USD",
      fxAsOf: fx.asOf,
    });
    expect((await errOf(stale)).status).toBeGreaterThanOrEqual(400);
    const { order: fresh } = await checkoutPending(buyer, seller, "USD");
    expect(fresh.fxRateLocked).toBe(Number(newUsd));
    expect(BigInt(Math.round(fresh.payableAmount * 100))).toBe(displayCents(123_900n, newUsd));
    expect(fresh.payableAmount).not.toBe(old.payableAmount);
  } finally {
    await context.close();
    await admin.context.close();
    const now = (await ok<any>(await sa.get("admin/fx/rates"))).latest.rates as Record<string, number>;
    if (now.USD !== orig.USD || now.MYR !== orig.MYR || now.SGD !== orig.SGD || now.VND !== orig.VND) {
      await ok(await sa.put("admin/fx/rates", { rates: restore, note: "e2e restore" }));
    }
  }
  expect((await fxNow(buyer.api)).rates.USD).toBe(orig.USD);
});
