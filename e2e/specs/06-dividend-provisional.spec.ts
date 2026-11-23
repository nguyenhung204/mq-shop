import { expect, test } from "@playwright/test";
import { apiAs, ok } from "../support/api";
import { createSellerWithSku, createUser, deliverOrder, placeOrder } from "../support/factory";
import { pageAs } from "../support/admin-flows";

/**
 * Spec 11/11 s2.4 "thuong du kien": a delivered order still inside its 7-day return window shows up in the "Provisional" block of the
 * CURRENT quarter's report and never in the real totals. Only reads the report, so it runs in the parallel project.
 */
const quarterOf = (d: Date) => `${d.getFullYear()}Q${Math.floor(d.getMonth() / 3) + 1}`;

test("a delivered order inside the 7-day window is provisional: shown apart, real totals unchanged", async ({ browser }) => {
  test.setTimeout(180_000);
  const q = quarterOf(new Date());
  const sa = await apiAs("SUPER_ADMIN");
  const seller = await createSellerWithSku({ unitPrice: "1234.00", prefix: "provseller" });
  const buyer = await createUser({ prefix: "provbuyer" });
  const base = await ok<any>(await sa.get(`admin/dividend/quarters/${q}/report`));

  const order = await placeOrder(buyer, seller);
  await deliverOrder(seller, order.id);

  const rep = await ok<any>(await sa.get(`admin/dividend/quarters/${q}/report`));
  expect(rep.locked).toBe(false);
  // 1234.00 item, shipping not part of the base: at least this order is projected
  expect(rep.provisional.orderCount).toBeGreaterThanOrEqual(base.provisional.orderCount + 1);
  expect(rep.provisional.salesBaseCents).toBeGreaterThanOrEqual(base.provisional.salesBaseCents + 123_400);
  expect(rep.provisional.returnWindowDays).toBe(7);
  // the real figures did not move (the order is not eligible yet)
  expect(rep.totals.salesBaseCents).toBe(base.totals.salesBaseCents);
  expect(rep.totals.poolCents).toBe(base.totals.poolCents);

  const { page, context } = await pageAs(browser, { api: sa });
  try {
    await page.goto("/admin/dividend/report");
    await expect(page.locator('[data-row="provisional"]')).toContainText("Provisional, not final");
  } finally {
    await context.close();
  }
});
