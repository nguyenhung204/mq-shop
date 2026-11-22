import { expect, test } from "@playwright/test";
import { apiAs, ok } from "../support/api";
import { sql } from "../support/db";
import { commissionRowsOfOrder, createCreditedReferralOrder, createSellerWithSku, createUser, getOrder, placeOrder, walletOf } from "../support/factory";
import { errOf, expectDbRejects, pageAs } from "../support/admin-flows";

/**
 * Flow 10: SUPER_ADMIN edits the payment date of an order (/orders/[id], PATCH admin/orders/:id/paid-at).
 * Nothing global changes: the dividend lock is only READ (dividendEditWindowDays unset => every past quarter is locked),
 * so these tests run in the parallel project. Dates assume the stack clock is in 2026Q4 (2026Q3 is then locked, 2026Q4 open).
 */
const Q3 = "2026-08-10T10:00:00+08:00"; // locked quarter
const Q4_EARLY = "2026-10-02T09:00:00+08:00"; // created_at backdate inside the open quarter
const Q4_EDIT = "2026-10-10T10:00:00+08:00";
const REASON = "Customer paid on 10 Oct, bank slip shows it";

async function paidOrder() {
  const seller = await createSellerWithSku({ unitPrice: "500.00", prefix: "paidat" });
  const buyer = await createUser({ prefix: "paidatbuyer" });
  const order = await placeOrder(buyer, seller);
  return { seller, buyer, order };
}

/** SQL: a paid order cannot be created in the past, and paidAt may not precede created_at: backdate both columns. */
async function backdate(orderId: string, createdAt: string, paidAt?: string) {
  await sql(`UPDATE orders SET created_at = $2, paid_at = COALESCE($3::timestamptz, paid_at) WHERE id = $1`, [orderId, createdAt, paidAt ?? null]);
}

const paidAtOf = async (orderId: string) =>
  (await sql<{ p: string }>(`SELECT paid_at::text AS p FROM orders WHERE id = $1`, [orderId]))[0].p;
const historyCount = async (orderId: string) =>
  Number((await sql<{ n: string }>(`SELECT count(*)::text AS n FROM order_paid_at_history WHERE order_id = $1`, [orderId]))[0].n);

test.describe("10 paid-at edit", () => {
  test.describe.configure({ timeout: 180_000 }); // factory setup is slow when other agents load the shared backend

  test("API: a calendar-impossible date (30 Feb) is refused with 400 and nothing changes", async () => {
    const { order } = await paidOrder();
    await backdate(order.id, Q4_EARLY);
    const before = await paidAtOf(order.id);
    const sa = await apiAs("SUPER_ADMIN");
    for (const bad of ["2026-02-30T10:00:00+08:00", "2026-04-31T10:00:00+08:00", "2026-13-01T10:00:00+08:00"]) {
      const e = await errOf(await sa.patch(`admin/orders/${order.id}/paid-at`, { paidAt: bad, reason: REASON }));
      expect(e.status, bad).toBe(400);
    }
    expect(await paidAtOf(order.id)).toBe(before);
    expect(await historyCount(order.id)).toBe(0);
  });

  test("API: touching a locked quarter is refused with 409 DIVIDEND_QUARTER_LOCKED", async () => {
    const { order } = await paidOrder();
    await backdate(order.id, "2026-07-05T09:00:00+08:00");
    const before = await paidAtOf(order.id); // now (2026Q4)
    const sa = await apiAs("SUPER_ADMIN");
    // moving INTO the locked quarter
    const into = await errOf(await sa.patch(`admin/orders/${order.id}/paid-at`, { paidAt: Q3, reason: REASON }));
    expect(into.status).toBe(409);
    expect(into.code).toBe("DIVIDEND_QUARTER_LOCKED");
    // moving OUT of the locked quarter
    await sql(`UPDATE orders SET paid_at = $2 WHERE id = $1`, [order.id, Q3]); // SQL: place the order inside the locked quarter
    const out = await errOf(await sa.patch(`admin/orders/${order.id}/paid-at`, { paidAt: Q4_EDIT, reason: REASON }));
    expect(out.status).toBe(409);
    expect(out.code).toBe("DIVIDEND_QUARTER_LOCKED");
    expect(new Date(await paidAtOf(order.id)).getTime()).toBe(new Date(Q3).getTime());
    expect(before).toBeTruthy();
    expect(await historyCount(order.id)).toBe(0);
  });

  test("API: ADMIN and CS get 403 on the edit; ADMIN may read the history, CS may not", async () => {
    const { order } = await paidOrder();
    await backdate(order.id, Q4_EARLY);
    const before = await paidAtOf(order.id);
    for (const role of ["ADMIN", "CS"] as const) {
      const api = await apiAs(role);
      const e = await errOf(await api.patch(`admin/orders/${order.id}/paid-at`, { paidAt: Q4_EDIT, reason: REASON }));
      expect(e.status, role).toBe(403);
    }
    expect((await (await apiAs("ADMIN")).get(`admin/orders/${order.id}/paid-at-history`)).status()).toBe(200);
    expect((await (await apiAs("CS")).get(`admin/orders/${order.id}/paid-at-history`)).status()).toBe(403);
    expect(await paidAtOf(order.id)).toBe(before);
  });

  test("API: valid edits write newest-first history; history is append-only (API and DB trigger)", async () => {
    const { order } = await paidOrder();
    await backdate(order.id, Q4_EARLY);
    const sa = await apiAs("SUPER_ADMIN");
    const r1 = await ok<any>(await sa.patch(`admin/orders/${order.id}/paid-at`, { paidAt: Q4_EDIT, reason: REASON }));
    expect(r1.changed).toBe(true);
    expect(r1.touchesSalesEligibility).toBe(false);
    const second = "2026-10-12T11:30:00+08:00";
    await ok(await sa.patch(`admin/orders/${order.id}/paid-at`, { paidAt: second, reason: "second correction" }));
    const hist = (await ok<any>(await sa.get(`admin/orders/${order.id}/paid-at-history`))).items as any[];
    expect(hist.length).toBe(2);
    expect(hist[0].reason).toBe("second correction");
    expect(new Date(hist[0].newPaidAt).getTime()).toBe(new Date(second).getTime());
    expect(new Date(hist[0].oldPaidAt).getTime()).toBe(new Date(Q4_EDIT).getTime());
    expect(hist[1].reason).toBe(REASON);
    // no edit/delete routes on the history
    for (const m of ["put", "patch"] as const) {
      expect([404, 405], m).toContain((await sa[m](`admin/orders/${order.id}/paid-at-history/${hist[0].id}`, { reason: "x" })).status());
    }
    expect([404, 405]).toContain((await sa.delete(`admin/orders/${order.id}/paid-at-history/${hist[0].id}`)).status());
    // DB trigger
    expect(await expectDbRejects(`UPDATE order_paid_at_history SET reason = 'tampered' WHERE id = $1`, [hist[0].id])).toMatch(/append-only/);
    expect(await expectDbRejects(`DELETE FROM order_paid_at_history WHERE id = $1`, [hist[0].id])).toMatch(/append-only/);
    expect(await historyCount(order.id)).toBe(2);
  });

  test("API: commissions and the wallet do not change when the payment date is edited", async () => {
    const s = await createCreditedReferralOrder();
    await backdate(s.order.id, Q4_EARLY);
    const snap = async () => ({
      rows: (await commissionRowsOfOrder(s.order.id)).map((r) => `${r.id}|${r.status}|${r.type}|${r.payout_amount}|${JSON.stringify(r.meta)}`),
      wallet: (await walletOf(s.referrer.user)).raw,
      order: await sql(`SELECT sales_eligible_at, delivered_at, status, total FROM orders WHERE id = $1`, [s.order.id]),
    });
    const before = await snap();
    expect(before.rows.length).toBeGreaterThan(0);
    const sa = await apiAs("SUPER_ADMIN");
    const r = await ok<any>(await sa.patch(`admin/orders/${s.order.id}/paid-at`, { paidAt: Q4_EDIT, reason: REASON }));
    expect(r.changed).toBe(true);
    expect(await snap()).toEqual(before);
    expect(new Date((await getOrder(s.buyer.api, s.order.id)).paidAt).getTime()).toBe(new Date(Q4_EDIT).getTime());
  });

  test("UI: SUPER_ADMIN edits the date and sees a new history row; a locked quarter is refused in the UI", async ({ browser }) => {
    const { order } = await paidOrder();
    await backdate(order.id, "2026-07-05T09:00:00+08:00", Q4_EARLY);
    const sa = await apiAs("SUPER_ADMIN");
    const { page, context } = await pageAs(browser, { api: sa });
    try {
      await page.goto(`/orders/${order.id}`);
      const panel = page.getByRole("region", { name: "Payment date" });
      await expect(panel).toBeVisible();
      await expect(panel.getByText("No edits yet.")).toBeVisible();
      // refused: would move the order into the locked 2026Q3
      await panel.getByLabel("New payment date and time (GMT+8)").fill("2026-08-10T10:00");
      await panel.getByLabel("Reason").fill(REASON);
      const refused = page.waitForResponse((r) => r.url().includes("/paid-at") && r.request().method() === "PATCH");
      await panel.getByRole("button", { name: "Save payment date" }).click();
      expect((await refused).status()).toBe(409);
      expect(await historyCount(order.id)).toBe(0);
      // accepted
      await panel.getByLabel("New payment date and time (GMT+8)").fill("2026-10-10T10:00");
      const done = page.waitForResponse((r) => r.url().includes("/paid-at") && r.request().method() === "PATCH");
      await panel.getByRole("button", { name: "Save payment date" }).click();
      expect((await done).status()).toBe(200);
      await expect(panel.getByText(REASON)).toBeVisible();
      expect(await historyCount(order.id)).toBe(1);
      // history rows carry no edit/delete controls
      await expect(panel.getByRole("button", { name: /delete|remove|edit/i })).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test("UI: ADMIN sees the date and history but no edit form; CS sees no payment-date editor", async ({ browser }) => {
    const { order } = await paidOrder();
    await backdate(order.id, Q4_EARLY);
    await ok(await (await apiAs("SUPER_ADMIN")).patch(`admin/orders/${order.id}/paid-at`, { paidAt: Q4_EDIT, reason: REASON }));
    const admin = await pageAs(browser, { api: await apiAs("ADMIN") });
    try {
      await admin.page.goto(`/orders/${order.id}`);
      const panel = admin.page.getByRole("region", { name: "Payment date" });
      await expect(panel).toBeVisible();
      await expect(panel.getByText(REASON)).toBeVisible();
      await expect(panel.getByRole("button", { name: "Save payment date" })).toHaveCount(0);
      await expect(panel.getByLabel("New payment date and time (GMT+8)")).toHaveCount(0);
    } finally {
      await admin.context.close();
    }
    const cs = await pageAs(browser, { api: await apiAs("CS") });
    try {
      const loaded = cs.page.waitForResponse((r) => r.request().method() === "GET" && new RegExp(`/orders/${order.id}$`).test(r.url()));
      await cs.page.goto(`/orders/${order.id}`);
      const res = await loaded;
      if (res.status() === 200) await expect(cs.page.getByText(order.code).first()).toBeVisible();
      await expect(cs.page.getByRole("button", { name: "Save payment date" })).toHaveCount(0);
      await expect(cs.page.getByLabel("New payment date and time (GMT+8)")).toHaveCount(0);
    } finally {
      await cs.context.close();
    }
  });
});
