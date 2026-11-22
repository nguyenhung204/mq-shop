import { test, expect } from "@playwright/test";
import { anon, apiLogin, ok } from "../support/api";
import { sql } from "../support/db";
import { createSellerWithSku, createUser, getOrder, placeOrder } from "../support/factory";
import { fillVerifyOtpUi, ipContext, newEmail, userByEmail } from "../support/identity";
import { latestOtp } from "../support/otp";

/**
 * Flow 2: business regions TW / VN / MY / SG. Gate cards are in the order tw, my, vn, sg (GATE_REGIONS);
 * choosing one also switches the UI language of that region (TW zh-TW, VN vi, MY/SG en).
 */
test.describe.configure({ timeout: 120_000 });

const REGIONS = [
  { id: "tw", code: "TW", locale: "zh-TW", index: 0 },
  { id: "my", code: "MY", locale: "en", index: 1 },
  { id: "vn", code: "VN", locale: "vi", index: 2 },
  { id: "sg", code: "SG", locale: "en", index: 3 },
] as const;

const store = (page: import("@playwright/test").Page, key: string) =>
  page.evaluate((k) => localStorage.getItem(k), key);

for (const r of REGIONS) {
  test(`home gate: choosing ${r.code} stores the region, sets language ${r.locale}, and registration sends regionCode ${r.code} (DB users.region_code)`, async ({ browser }) => {
    const { page, context } = await ipContext(browser, { lang: null }); // no mq-lang => the gate is shown
    await page.goto("/");
    const options = page.getByRole("option");
    await expect(options).toHaveCount(4);
    await options.nth(r.index).click();
    await expect(options.nth(r.index)).toHaveAttribute("aria-selected", "true");
    await page.locator("button:has(svg.lucide-chevron-right)").click();
    await expect(options).toHaveCount(0); // gate closed
    expect(await store(page, "mq-region")).toBe(r.id);
    expect(await store(page, "mq-lang")).toBe(r.locale);

    // anonymous registration carries the chosen region
    await page.goto("/my-account/register");
    const email = newEmail(`reg-${r.id}`);
    await page.locator("#reg-name").fill("Region Person");
    await page.locator("#reg-email").fill(email);
    const reg = page.waitForRequest((x) => x.url().endsWith("/auth/register") && x.method() === "POST");
    await page.locator(".mq-auth-actions button[type=submit]").click();
    expect((await reg).postDataJSON().regionCode).toBe(r.code);
    await page.waitForURL(/verify-otp/);
    await fillVerifyOtpUi(page, await latestOtp(email), "E2ePassw0rd!");
    await page.waitForURL((u) => !u.pathname.includes("verify-otp"));
    expect((await userByEmail(email))?.region_code).toBe(r.code); // SQL read
    const me = await ok<any>(await (await apiLogin(email, "E2ePassw0rd!")).get("users/me"));
    expect((me.user ?? me).regionCode).toBe(r.code);
    await context.close();
  });
}

test("API: only TW/VN/MY/SG are accepted; US and unknown codes are 400 REGION_INVALID; any case works", async () => {
  const api = await anon();
  for (const bad of ["US", "XX", "tw1", ""]) {
    const res = await api.post("auth/register", { email: newEmail("badreg"), regionCode: bad });
    expect(res.status(), `regionCode ${JSON.stringify(bad)}`).toBe(400);
  }
  const res = await api.post("auth/register", { email: newEmail("badreg"), regionCode: "US" });
  expect(await res.text()).toContain("REGION_INVALID");
  const user = await createUser({ prefix: "region-api" });
  const refused = await user.api.patch("users/me/region", { regionCode: "US" });
  expect(refused.status()).toBe(400);
  expect(await refused.text()).toContain("REGION_INVALID");
  const lower = await user.api.patch("users/me/region", { regionCode: "sg" });
  expect(lower.status()).toBe(200);
  expect((await userByEmail(user.email))?.region_code).toBe("SG");
});

test("an order keeps the region it was placed in when the account region changes (UI switch); a new order takes the new region; the DB trigger refuses a direct change", async ({ browser }) => {
  const seller = await createSellerWithSku({ stock: 20 });
  const buyer = await createUser({ prefix: "region-buyer" });
  expect((await userByEmail(buyer.email))?.region_code).toBe("TW");

  const order1 = await placeOrder(buyer, seller, 1);
  expect(order1.regionCode).toBe("TW");

  // the buyer switches the account region in the browser (header switcher -> modal -> Vietnam)
  const { page, context } = await ipContext(browser, { from: buyer });
  await page.goto("/");
  await page.getByRole("button", { name: "Switch Shopping Region" }).first().click();
  await page.getByRole("button", { name: /Vi.t Nam/ }).click();
  const patched = page.waitForResponse((x) => x.url().endsWith("/users/me/region") && x.request().method() === "PATCH");
  await page.getByRole("button", { name: "Confirm Region" }).click();
  expect((await patched).status()).toBe(200);
  await context.close();

  const me = await ok<any>(await buyer.api.get("users/me"));
  expect((me.user ?? me).regionCode).toBe("VN");
  expect((await userByEmail(buyer.email))?.region_code).toBe("VN");

  // the earlier order did not move: API and DB
  expect((await getOrder(buyer.api, order1.id)).regionCode).toBe("TW");
  expect((await sql(`SELECT region_code FROM orders WHERE id = $1`, [order1.id]))[0].region_code).toBe("TW");

  // an order placed now is stamped with the buyer's current region
  const order2 = await placeOrder(buyer, seller, 1);
  expect(order2.regionCode).toBe("VN");
  expect((await getOrder(buyer.api, order1.id)).regionCode).toBe("TW");

  // an explicit region on checkout wins over the account region (stamped once, forever)
  const order3 = await ok<any>(
    await buyer.api.post("orders/checkout", {
      items: [{ variantId: seller.variantId, quantity: 1 }],
      shippingAddress: { fullName: "E2E Buyer", phone: "0900000000", line1: "1 Test Road", city: "Taipei", country: "TW" },
      paymentMethod: "MOCK",
      regionCode: "sg",
    }),
  );
  expect((order3.order ?? order3.orders?.[0] ?? order3).regionCode).toBe("SG");

  // SQL: direct UPDATE of orders.region_code is rejected by trigger trg_orders_region_immutable (nothing changes)
  await expect(sql(`UPDATE orders SET region_code = 'SG' WHERE id = $1`, [order1.id])).rejects.toThrow(/region_code is immutable/);
  expect((await sql(`SELECT region_code FROM orders WHERE id = $1`, [order1.id]))[0].region_code).toBe("TW");
  // SQL: the trigger exists
  const trg = await sql(`SELECT tgname FROM pg_trigger WHERE tgname = 'trg_orders_region_immutable' AND NOT tgisinternal`);
  expect(trg).toHaveLength(1);
});
