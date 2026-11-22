import { test, expect, type Page } from "@playwright/test";
import { ok } from "../support/api";
import { createSellerWithSku, createUser, placeOrder } from "../support/factory";
import { sql } from "../support/db";
import { cancelledPaidOrder, staffApi, uiPage as uiPageFor, walletFingerprint } from "../support/kit-flows-9-13";

/**
 * TEST-GUIDE flow 9 / C2-a, C2-c: refund cases of an order cancelled by admin after payment.
 * Every test builds its own shop/buyer/order and filters every read by its own shop or order code (the DB is shared).
 */
test.describe.configure({ timeout: 120_000 });

const caseRow = async (id: string) => (await sql<any>(`SELECT status, amount_cents::text AS amount_cents, is_partial FROM refund_cases WHERE id = $1`, [id]))[0];

async function clickInDialog(page: Page, name: string | RegExp) {
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name, exact: typeof name === "string" }).click();
  await expect(dialog).toBeHidden();
}

test("admin cancel of a paid order opens an OPEN case; seller marks paid in UI, buyer confirms in UI -> CLOSED; no wallet moves", async ({ browser }) => {
  const k = await cancelledPaidOrder();
  const referrer = await createUser({ prefix: "rcref" }); // bystander: must not move either
  const before = { buyer: await walletFingerprint(k.buyer), seller: await walletFingerprint(k.seller.user), ref: await walletFingerprint(referrer) };

  // 1. the case exists, OPEN, full refund of the order total, source CANCEL
  const c0 = await ok<any>(await k.buyer.api.get(`refund-cases/${k.caseId}`));
  expect(c0.status).toBe("OPEN");
  expect(c0.source).toBe("CANCEL");
  expect(c0.isPartial).toBe(false);
  expect(Number(c0.amount)).toBe(Number(k.order.total));
  expect(c0.orderId).toBe(k.order.id);
  const row0 = await caseRow(k.caseId); // SQL: DB truth
  expect(row0.status).toBe("OPEN");
  expect(row0.amount_cents).toBe(String(Math.round(Number(k.order.total) * 100)));

  // 2. seller: /seller/refunds -> Mark as paid (with a reference)
  const sUi = await uiPageFor(browser, k.seller.user);
  await sUi.page.goto("/seller/refunds");
  await expect(sUi.page.getByRole("link", { name: k.order.code })).toBeVisible();
  await expect(sUi.page.locator(".mq-badge", { hasText: "Open (waiting for the seller)" })).toBeVisible();
  await sUi.page.getByRole("button", { name: "Mark as paid", exact: true }).click();
  await sUi.page.getByRole("dialog").getByRole("textbox").first().fill("TRF-E2E-9");
  const markResp = sUi.page.waitForResponse((r) => r.url().endsWith(`/refund-cases/${k.caseId}/mark-paid`));
  await clickInDialog(sUi.page, "Mark as paid");
  expect((await markResp).status()).toBe(200);
  await expect(sUi.page.locator(".mq-badge", { hasText: "Marked as paid (waiting for the buyer)" })).toBeVisible();
  expect((await caseRow(k.caseId)).status).toBe("SELLER_MARKED_PAID");
  // the seller cannot confirm on the buyer's behalf
  const sellerConfirm = await k.seller.user.api.post(`refund-cases/${k.caseId}/confirm`, {});
  expect([403, 409]).toContain(sellerConfirm.status());
  await sUi.context.close();

  // 3. buyer: /refunds -> Confirm received -> CLOSED
  const bUi = await uiPageFor(browser, k.buyer);
  await bUi.page.goto("/refunds");
  await expect(bUi.page.locator(".mq-badge", { hasText: "Marked as paid (waiting for the buyer)" })).toBeVisible();
  await bUi.page.getByRole("button", { name: "Confirm received", exact: true }).click();
  const confirmResp = bUi.page.waitForResponse((r) => r.url().endsWith(`/refund-cases/${k.caseId}/confirm`));
  await clickInDialog(bUi.page, "Confirm received");
  expect((await confirmResp).status()).toBe(200);
  await expect(bUi.page.locator(".mq-badge", { hasText: /^Closed$/ })).toBeVisible();
  await bUi.context.close();
  expect((await caseRow(k.caseId)).status).toBe("CLOSED");

  // 4. history has CREATED -> SELLER_MARK_PAID -> BUYER_CONFIRM -> AUTO_CLOSE and the reference is kept
  const detail = await ok<any>(await k.buyer.api.get(`refund-cases/${k.caseId}`));
  expect(detail.events.map((e: any) => e.kind)).toEqual(["CREATED", "SELLER_MARK_PAID", "BUYER_CONFIRM", "AUTO_CLOSE"]);
  expect(detail.events[1].reference).toBe("TRF-E2E-9");

  // 5. the refund moves outside the system: no wallet balance and no wallet transaction changed for anybody
  expect(await walletFingerprint(k.buyer)).toEqual(before.buyer);
  expect(await walletFingerprint(k.seller.user)).toEqual(before.seller);
  expect(await walletFingerprint(referrer)).toEqual(before.ref);
});

test("buyer may dispute 3 times; the 4th is refused 409 DISPUTE_LIMIT; UI hides the button, and a stale button shows the limit message", async ({ browser }) => {
  const k = await cancelledPaidOrder();
  const before = { buyer: await walletFingerprint(k.buyer), seller: await walletFingerprint(k.seller.user) };
  const markPaid = async () => ok(await k.seller.user.api.post(`refund-cases/${k.caseId}/mark-paid`, { reference: "T" }));
  const dispute = (n: number) => k.buyer.api.post(`refund-cases/${k.caseId}/dispute`, { note: `not received #${n}` });

  await markPaid();
  expect((await dispute(1)).status()).toBe(200);
  await markPaid();
  expect((await dispute(2)).status()).toBe(200);
  await markPaid();

  // UI loaded while 2 disputes are counted: the "Not received" button is offered
  const bUi = await uiPageFor(browser, k.buyer);
  await bUi.page.goto("/refunds");
  const notReceived = bUi.page.getByRole("button", { name: "Not received", exact: true });
  await expect(notReceived).toBeVisible();
  // meanwhile (another tab / device): 3rd dispute and the seller marks paid again
  expect((await dispute(3)).status()).toBe(200);
  await markPaid();

  // the stale button -> server says DISPUTE_LIMIT, the UI explains it (toast with the limit)
  await notReceived.click();
  await dialogFill(bUi.page, "4th report attempt");
  const resp = bUi.page.waitForResponse((r) => r.url().endsWith(`/refund-cases/${k.caseId}/dispute`));
  await bUi.page.getByRole("dialog").getByRole("button", { name: "Send report", exact: true }).click();
  const r4 = await resp;
  expect(r4.status()).toBe(409);
  const body4 = JSON.stringify(await r4.json());
  expect(body4).toContain("DISPUTE_LIMIT");
  await expect(bUi.page.getByText(/already reported this refund 3 times/)).toBeVisible();

  // direct API: same refusal with details.reason; state unchanged (still SELLER_MARKED_PAID, exactly 3 dispute events)
  const api4 = await dispute(4);
  expect(api4.status()).toBe(409);
  expect(JSON.stringify(await api4.json())).toContain("DISPUTE_LIMIT");
  expect((await caseRow(k.caseId)).status).toBe("SELLER_MARKED_PAID");
  const [{ n }] = await sql<{ n: string }>(`SELECT COUNT(*)::text AS n FROM refund_case_events WHERE case_id = $1 AND kind = 'BUYER_DISPUTE'`, [k.caseId]);
  expect(n).toBe("3");

  // after a refresh the API no longer offers DISPUTE, so the button is gone (CONFIRM is still there)
  await bUi.page.reload();
  await expect(bUi.page.getByRole("button", { name: "Confirm received", exact: true })).toBeVisible();
  await expect(bUi.page.getByRole("button", { name: "Not received", exact: true })).toHaveCount(0);
  await bUi.context.close();

  expect(await walletFingerprint(k.buyer)).toEqual(before.buyer);
  expect(await walletFingerprint(k.seller.user)).toEqual(before.seller);
});

async function dialogFill(page: Page, text: string) {
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("textbox").last().fill(text);
}

test("admin override needs a reason; buyer and seller only see 'Updated by support', staff see the real reason; no wallet moves", async ({ browser }) => {
  const k = await cancelledPaidOrder();
  const before = { buyer: await walletFingerprint(k.buyer), seller: await walletFingerprint(k.seller.user) };
  const secret = `INTERNAL-REASON-${Date.now().toString(36)}`;
  const admin = await staffApi("ADMIN");

  // API: reason missing / too short -> 400 and nothing changes
  for (const body of [{ toStatus: "CLOSED" }, { toStatus: "CLOSED", reason: "  " }, { toStatus: "CLOSED", reason: "ab" }]) {
    const res = await admin.post(`admin/refund-cases/${k.caseId}/override`, body);
    expect(res.status(), JSON.stringify(body)).toBe(400);
  }
  expect((await caseRow(k.caseId)).status).toBe("OPEN");
  // CS can read but not override
  const cs = await staffApi("CS");
  expect((await cs.get(`admin/refund-cases/${k.caseId}`)).status()).toBe(200);
  expect((await cs.post(`admin/refund-cases/${k.caseId}/override`, { toStatus: "CLOSED", reason: "cs tries it" })).status()).toBe(403);
  // buyer / seller cannot call the admin route
  expect((await k.buyer.api.post(`admin/refund-cases/${k.caseId}/override`, { toStatus: "CLOSED", reason: "buyer tries" })).status()).toBe(403);
  expect((await k.seller.user.api.post(`admin/refund-cases/${k.caseId}/override`, { toStatus: "CLOSED", reason: "seller tries" })).status()).toBe(403);

  // UI: the dialog refuses an empty reason (no request), then accepts the real one
  const aUi = await uiPageFor(browser, { api: admin });
  const overrideCalls: string[] = [];
  aUi.page.on("request", (r) => { if (r.url().endsWith("/override")) overrideCalls.push(r.url()); });
  await aUi.page.goto(`/admin/refund-cases/${k.caseId}`);
  await aUi.page.getByRole("button", { name: "Override status", exact: true }).click();
  const dialog = aUi.page.getByRole("dialog");
  await dialog.locator("select").selectOption("CLOSED");
  await dialog.getByRole("button", { name: "Apply override", exact: true }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  expect(overrideCalls).toEqual([]);
  await dialog.getByRole("textbox").fill(secret);
  const resp = aUi.page.waitForResponse((r) => r.url().endsWith(`/admin/refund-cases/${k.caseId}/override`));
  await dialog.getByRole("button", { name: "Apply override", exact: true }).click();
  expect((await resp).status()).toBe(200);
  await expect(aUi.page.getByText(secret)).toBeVisible(); // staff history shows the real reason
  await aUi.context.close();
  expect((await caseRow(k.caseId)).status).toBe("CLOSED");

  // staff API sees the reason; buyer/seller API bodies never contain it anywhere
  const staffDetail = await ok<any>(await admin.get(`admin/refund-cases/${k.caseId}`));
  const ov = staffDetail.events.find((e: any) => e.kind === "ADMIN_OVERRIDE");
  expect(ov.note).toBe(secret);
  for (const who of [k.buyer, k.seller.user]) {
    const detailRes = await who.api.get(`refund-cases/${k.caseId}`);
    const text = await detailRes.text();
    expect(text).not.toContain(secret);
    const evs = JSON.parse(text).data.events;
    expect(evs.find((e: any) => e.kind === "ADMIN_OVERRIDE").note).toBe("Updated by support");
    const listText = await (await who.api.get(which(who, k))).text();
    expect(listText).not.toContain(secret);
  }

  // parties' UI: history says "Updated by support", never the reason
  for (const [who, path] of [[k.buyer, "/refunds"], [k.seller.user, "/seller/refunds"]] as const) {
    const ui = await uiPageFor(browser, who);
    await ui.page.goto(path);
    await ui.page.getByRole("button", { name: "Show history", exact: true }).click();
    await expect(ui.page.getByText("Updated by support")).toBeVisible();
    await expect(ui.page.locator("body")).not.toContainText(secret);
    await ui.context.close();
  }

  expect(await walletFingerprint(k.buyer)).toEqual(before.buyer);
  expect(await walletFingerprint(k.seller.user)).toEqual(before.seller);
});

const which = (who: { id: string }, k: { buyer: { id: string } }) => (who.id === k.buyer.id ? "refund-cases/as-buyer" : "refund-cases/as-seller");

test("shop owner who is also the buyer cannot confirm (409 SELF_DEALING, no button, badge); only admin override closes it", async ({ browser }) => {
  const k = await cancelledPaidOrder({ selfDealing: true });
  const owner = k.seller.user;
  const before = await walletFingerprint(owner);
  await ok(await owner.api.post(`refund-cases/${k.caseId}/mark-paid`, { reference: "self" }));

  const res = await owner.api.post(`refund-cases/${k.caseId}/confirm`, {});
  expect(res.status()).toBe(409);
  expect(await res.text()).toContain("SELF_DEALING");
  expect((await caseRow(k.caseId)).status).toBe("SELLER_MARKED_PAID");

  const ui = await uiPageFor(browser, owner);
  await ui.page.goto("/refunds");
  await expect(ui.page.getByText("Same account on both sides").first()).toBeVisible();
  await expect(ui.page.getByRole("button", { name: "Confirm received", exact: true })).toHaveCount(0);
  await ui.context.close();

  const admin = await staffApi("ADMIN");
  await ok(await admin.post(`admin/refund-cases/${k.caseId}/override`, { toStatus: "BUYER_CONFIRMED", reason: "support settles self dealing" }));
  expect((await caseRow(k.caseId)).status).toBe("CLOSED");
  expect(await walletFingerprint(owner)).toEqual(before);
});

test("admin tracking list, filters and summary match the database (scoped to this shop)", async ({ browser }) => {
  // one shop, 3 cancelled orders with different outcomes + 1 partial case made by SQL-free means is not possible (partial = RMA), so full cases only
  const seller = await createSellerWithSku({ unitPrice: "1000.00", prefix: "rcflt" });
  const buyers = [await createUser({ prefix: "rcb1" }), await createUser({ prefix: "rcb2" }), await createUser({ prefix: "rcb3" })];
  const cases = [];
  for (const [i, b] of buyers.entries()) cases.push(await cancelledPaidOrder({ seller, buyer: b, quantity: i + 1 }));
  // c0 stays OPEN, c1 SELLER_MARKED_PAID, c2 CLOSED
  await ok(await seller.user.api.post(`refund-cases/${cases[1].caseId}/mark-paid`, {}));
  await ok(await seller.user.api.post(`refund-cases/${cases[2].caseId}/mark-paid`, {}));
  await ok(await buyers[2].api.post(`refund-cases/${cases[2].caseId}/confirm`, {}));

  // oracle: the database
  const rows = await sql<any>(`SELECT c.id, c.status, c.amount_cents::text AS cents, o.code FROM refund_cases c JOIN orders o ON o.id = c.order_id WHERE c.shop_id = $1`, [seller.shopId]);
  expect(rows).toHaveLength(3);
  const sumCents = (st?: string) => rows.filter((r) => !st || r.status === st).reduce((a, r) => a + BigInt(r.cents), 0n);
  const cent = (v: string) => BigInt(Math.round(Number(v.replace(/,/g, "")) * 100));

  const admin = await staffApi("ADMIN");
  const ui = await uiPageFor(browser, { api: admin });
  const page = ui.page;
  const caseRows = page.locator("table:has(th:text-is(\"Order\")) tbody tr");
  await page.goto("/admin/refund-cases");
  await page.getByLabel("Shop ID").fill(seller.shopId);
  const listResp = page.waitForResponse((r) => r.url().includes("/admin/refund-cases?") && r.url().includes(`shopId=${seller.shopId}`));
  await page.getByRole("button", { name: "Apply filters", exact: true }).click();
  await listResp;
  await expect(caseRows).toHaveCount(3);
  for (const r of rows) await expect(caseRows.filter({ hasText: r.code })).toHaveCount(1);

  // summary counters (UI) == DB
  const counter = (label: string) => page.locator(".mq-card", { has: page.locator("p", { hasText: new RegExp(`^${label}$`) }) }).locator("p").nth(1);
  await expect(counter("Total")).toHaveText("3");
  await expect(counter("Open")).toHaveText("1");
  await expect(counter("Waiting for buyer")).toHaveText("1");
  await expect(counter("Closed")).toHaveText("1");
  await expect(counter("Disputed")).toHaveText("0");
  // summary amounts via API for the same filter == DB sums
  const sum = await ok<any>(await admin.get(`admin/refund-cases/summary?shopId=${seller.shopId}`));
  expect(sum.counts).toMatchObject({ total: 3, open: 1, awaitingBuyer: 1, closed: 1, disputed: 0 });
  const twd = sum.amounts.find((a: any) => a.currency === "TWD");
  expect(cent(twd.total)).toBe(sumCents());
  expect(cent(twd.open)).toBe(sumCents("OPEN"));
  expect(cent(twd.awaitingBuyer)).toBe(sumCents("SELLER_MARKED_PAID"));
  expect(cent(twd.closed)).toBe(sumCents("CLOSED"));

  // status filter in the UI: only OPEN
  await page.getByLabel("Open (waiting for the seller)").check();
  await page.getByRole("button", { name: "Apply filters", exact: true }).click();
  await expect(caseRows).toHaveCount(1);
  await expect(caseRows).toContainText(cases[0].order.code);
  await expect(counter("Total")).toHaveText("1");
  // reset status, search by exact order code
  await page.getByLabel("Open (waiting for the seller)").uncheck();
  await page.getByLabel("Order code (exact)").fill(cases[2].order.code);
  await page.getByRole("button", { name: "Apply filters", exact: true }).click();
  await expect(caseRows).toHaveCount(1);
  await expect(caseRows).toContainText("Closed");
  await ui.context.close();

  // API filters vs DB: source, kind, status list, amount range, date window (Asia/Taipei today)
  const ids = async (qs: string) => (await ok<any[]>(await admin.get(`admin/refund-cases?shopId=${seller.shopId}&${qs}`))).map((c) => c.id).sort();
  const dbIds = (f: (r: any) => boolean) => rows.filter(f).map((r) => r.id).sort();
  expect(await ids("source=CANCEL")).toEqual(dbIds(() => true));
  expect(await ids("source=RMA")).toEqual([]);
  expect(await ids("kind=full")).toEqual(dbIds(() => true));
  expect(await ids("kind=partial")).toEqual([]);
  expect(await ids("status=OPEN,CLOSED")).toEqual(dbIds((r) => r.status !== "SELLER_MARKED_PAID"));
  const mid = BigInt(rows.map((r) => BigInt(r.cents)).sort((a, b) => (a < b ? -1 : 1))[1]);
  const midDec = `${mid / 100n}.${String(mid % 100n).padStart(2, "0")}`;
  expect(await ids(`minAmount=${midDec}`)).toEqual(dbIds((r) => BigInt(r.cents) >= mid));
  expect(await ids(`maxAmount=${midDec}`)).toEqual(dbIds((r) => BigInt(r.cents) <= mid));
  const today = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() + 8 * 3600_000 - 2 * 86_400_000).toISOString().slice(0, 10);
  expect(await ids(`from=${today}&to=${today}`)).toEqual(dbIds(() => true));
  expect(await ids(`from=${yesterday}&to=${yesterday}`)).toEqual([]);
  // invalid filters are refused
  expect((await admin.get(`admin/refund-cases?status=NOPE`)).status()).toBe(400);
  expect((await admin.get(`admin/refund-cases?from=2024-01-01&to=2026-01-01`)).status()).toBe(400); // > 366 days
});

test("a shop's own-routes list only its own cases; another buyer/seller gets 404 on a foreign case", async () => {
  const k = await cancelledPaidOrder();
  const stranger = await createUser({ prefix: "rcstr" });
  const otherSeller = await createSellerWithSku({ prefix: "rcoth" });
  expect((await stranger.api.get(`refund-cases/${k.caseId}`)).status()).toBe(404);
  expect((await otherSeller.user.api.get(`refund-cases/${k.caseId}`)).status()).toBe(404);
  expect((await otherSeller.user.api.post(`refund-cases/${k.caseId}/mark-paid`, {})).status()).toBe(404);
  expect((await stranger.api.post(`refund-cases/${k.caseId}/confirm`, {})).status()).toBe(404);
  const mine = await ok<any[]>(await otherSeller.user.api.get("refund-cases/as-seller"));
  expect(mine.map((c) => c.id)).not.toContain(k.caseId);
  // the buyer cannot mark paid; the seller cannot dispute
  expect((await k.buyer.api.post(`refund-cases/${k.caseId}/mark-paid`, {})).status()).toBe(403);
  expect((await k.seller.user.api.post(`refund-cases/${k.caseId}/dispute`, { note: "nope nope" })).status()).toBe(403);
  void placeOrder;
});
