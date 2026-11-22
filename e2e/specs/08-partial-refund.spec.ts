import { test, expect, type Page } from "@playwright/test";
import { apiAs, ok } from "../support/api";
import {
  adjustWallet, centsToDecimal, clawedBackCents, commissionRowsOfOrder, completeRmaAfterApproval, createCreditedReferralOrder,
  createSellerWithSku, decimalToCents, getOrder, openRma, walletOf, type ReferralSetup,
} from "../support/factory";
import { runReversalSweep } from "../support/backend-ctl";
import { getRma, uiPageFor } from "../support/ui";

/**
 * TEST-GUIDE flow 8 / C1-a + C1-b, scaled: the referral commission needs a subtotal >= 2000 TWD, so the example order is
 * 100000 (+5 shipping = 100005 total) instead of 1000; the referrer earns 10000 TWD = 310.00 points (see factory.createCreditedReferralOrder).
 * Expected clawback (integer hundredths): floor(C * cumulativeRefundCents / orderTotalCents), C = credited points in hundredths.
 */
test.describe.configure({ timeout: 180_000 });

const cents = (v: string | number) => decimalToCents(String(v));
const claw = (c: bigint, cumRefund: bigint, total: bigint) => (c * (cumRefund > total ? total : cumRefund)) / total;
const approveUrl = (rmaId: string) => new RegExp(`/rma/${rmaId}/approve$`);

/** Poll until the commission service has debited exactly `expected` hundredths for the order. */
async function expectClawed(orderId: string, expected: bigint) {
  await expect.poll(() => clawedBackCents(orderId), { message: "points clawed back", timeout: 15_000 }).toBe(expected);
}

async function sellerApproveInUi(page: Page, rmaId: string, amount: string | null) {
  await page.goto("/seller/rma");
  await page.getByRole("button", { name: "Approve", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/At most 100005\.00/)).toBeVisible(); // cap known (order loaded) before anything is typed
  const input = dialog.getByLabel("Refund amount (TWD, optional)");
  if (amount !== null) await input.fill(amount);
  const resp = page.waitForResponse((r) => approveUrl(rmaId).test(r.url()) && r.request().method() === "POST");
  await dialog.getByRole("button", { name: /Approve (partial|full) refund/ }).click();
  return resp;
}

async function setup(): Promise<ReferralSetup & { total: bigint }> {
  const s = await createCreditedReferralOrder();
  return { ...s, total: cents(s.order.total) };
}

test("buyer opens RMA in the UI; seller refunds 40000 then the remaining 60005 in the UI; clawback is proportional and never above C", async ({ browser }) => {
  const s = await setup();
  expect(s.creditedCents).toBe(31000n); // 310.00 points
  expect(s.total).toBe(10000500n);
  const orderId = s.order.id;

  // 1. buyer opens the RMA on the order's RMA page
  const buyerUi = await uiPageFor(browser, s.buyer);
  await buyerUi.page.goto(`/orders/${orderId}/rma`);
  await buyerUi.page.getByPlaceholder("Reason").fill("Item not as described (e2e)");
  await buyerUi.page.getByPlaceholder("Bank name").fill("E2E Bank");
  await buyerUi.page.getByPlaceholder("Account number").fill("99999999");
  await buyerUi.page.getByPlaceholder("Account name").fill("E2E Buyer");
  const created = buyerUi.page.waitForResponse((r) => r.url().endsWith(`/orders/${orderId}/rma`) && r.request().method() === "POST");
  await buyerUi.page.getByRole("button", { name: "Submit RMA" }).click();
  const createdBody = (await (await created).json()).data;
  const rma1Id: string = createdBody.id ?? createdBody.rma.id;
  await buyerUi.page.goto("/rma");
  await expect(buyerUi.page.locator(".mq-badge", { hasText: "Requested" }).first()).toBeVisible();
  expect((await getRma(s.buyer.api, rma1Id)).status).toBe("REQUESTED");
  await buyerUi.context.close();

  // 2. seller approves a PARTIAL refund of 40000 in /seller/rma
  const sellerUi = await uiPageFor(browser, s.referrer.user);
  const r1 = await sellerApproveInUi(sellerUi.page, rma1Id, "40000");
  expect(r1.status()).toBe(200);
  expect(JSON.parse(r1.request().postData() ?? "{}").refundAmount).toBe("40000.00");
  const rma1 = await getRma(s.referrer.user.api, rma1Id);
  expect(rma1.status).toBe("APPROVED");
  expect(cents(rma1.refundAmount)).toBe(4000000n);
  await sellerUi.context.close();

  await completeRmaAfterApproval(s.buyer, s.referrer.user.api, rma1Id);
  const exp1 = claw(s.creditedCents, 4000000n, s.total);
  await expectClawed(orderId, exp1);
  expect(exp1).toBe(12399n); // 123.99 points
  expect((await getOrder(s.buyer.api, orderId)).status).toBe("DELIVERED"); // partial refund: order stays DELIVERED
  expect((await walletOf(s.referrer.user)).availableCents).toBe(s.creditedCents - exp1);

  // 3. second RMA: refund the remaining 60005.00 (typed in the UI) => full refund
  const rma2 = await openRma(s.buyer, orderId, "second return (e2e)");
  const sellerUi2 = await uiPageFor(browser, s.referrer.user);
  const r2 = await sellerApproveInUi(sellerUi2.page, rma2.id, "60005");
  expect(r2.status()).toBe(200);
  await sellerUi2.context.close();
  await completeRmaAfterApproval(s.buyer, s.referrer.user.api, rma2.id);
  await expectClawed(orderId, s.creditedCents); // total clawback == C exactly, not above
  await expect.poll(async () => (await getOrder(s.buyer.api, orderId)).status).toBe("REFUNDED");
  expect((await walletOf(s.referrer.user)).availableCents).toBe(0n);
  const referral = (await commissionRowsOfOrder(orderId)).find((r) => r.type === "REFERRAL")!;
  expect(referral.status).toBe("VOID");
});

test("seller approve dialog rejects 0, negative, 3 decimals and above-total amounts inline without calling the API", async ({ browser }) => {
  const s = await setup();
  const rma = await openRma(s.buyer, s.order.id);
  const ui = await uiPageFor(browser, s.referrer.user);
  const approveCalls: string[] = [];
  ui.page.on("request", (r) => { if (/\/rma\/[^/]+\/approve$/.test(r.url())) approveCalls.push(r.url()); });
  await ui.page.goto("/seller/rma");
  await ui.page.getByRole("button", { name: "Approve", exact: true }).first().click();
  const dialog = ui.page.getByRole("dialog");
  await expect(dialog.getByText(/At most 100005\.00/)).toBeVisible(); // wait for the order total (the cap) to load
  const input = dialog.getByLabel("Refund amount (TWD, optional)");
  const submit = dialog.getByRole("button", { name: /Approve (partial|full) refund/ });
  const cases: Array<[string, RegExp]> = [
    ["0", /must be greater than 0/],
    ["-5", /Enter an amount like 250/],
    ["100.123", /Enter an amount like 250/],
    ["100005.01", /more than what is left/],
    ["abc", /Enter an amount like 250/],
  ];
  for (const [value, message] of cases) {
    await input.fill(value);
    await submit.click();
    await expect(dialog.getByRole("alert"), `input "${value}"`).toContainText(message);
  }
  expect(approveCalls).toEqual([]); // nothing reached the API
  expect((await getRma(s.referrer.user.api, rma.id)).status).toBe("REQUESTED");
  expect(await clawedBackCents(s.order.id)).toBe(0n);
  await ui.context.close();
});

test("ACTUAL BEHAVIOUR: amount above what is still refundable (after an earlier partial refund) is refused: server 400 once, then inline with the remaining cap", async ({ browser }) => {
  const s = await setup();
  const rma1 = await openRma(s.buyer, s.order.id);
  await ok(await s.referrer.user.api.post(`rma/${rma1.id}/approve`, { refundAmount: "40000.00" }));
  await completeRmaAfterApproval(s.buyer, s.referrer.user.api, rma1.id);
  await expectClawed(s.order.id, claw(s.creditedCents, 4000000n, s.total));

  const rma2 = await openRma(s.buyer, s.order.id, "second");
  const ui = await uiPageFor(browser, s.referrer.user);
  const approveCalls: string[] = [];
  ui.page.on("request", (r) => { if (/\/rma\/[^/]+\/approve$/.test(r.url())) approveCalls.push(r.url()); });
  await ui.page.goto("/seller/rma");
  await ui.page.getByRole("button", { name: "Approve", exact: true }).first().click();
  const dialog = ui.page.getByRole("dialog");
  await expect(dialog.getByText(/At most 100005\.00/)).toBeVisible();
  const input = dialog.getByLabel("Refund amount (TWD, optional)");
  // 70000 <= order total but > the 60005.00 that is left: the dialog only knows the total, so the SERVER refuses first
  await input.fill("70000");
  const resp = ui.page.waitForResponse((r) => approveUrl(rma2.id).test(r.url()));
  await dialog.getByRole("button", { name: /Approve (partial|full) refund/ }).click();
  const r = await resp;
  expect(r.status()).toBe(400);
  expect(JSON.stringify(await r.json())).toContain("RMA_REFUND_AMOUNT_INVALID");
  await expect(dialog.getByText(/At most 60005\.00 is still refundable/)).toBeVisible(); // cap learnt from the error
  await dialog.getByRole("button", { name: /Approve (partial|full) refund/ }).click();
  await expect(dialog.getByRole("alert")).toContainText(/more than what is left/);
  expect(approveCalls).toHaveLength(1); // the second attempt never left the browser
  expect((await getRma(s.referrer.user.api, rma2.id)).status).toBe("REQUESTED");
  await ui.context.close();
});

for (const role of ["CS", "WAREHOUSE"] as const) {
  test(`${role}: approve with refundAmount => 400 RMA_REFUND_AMOUNT_INVALID; without it the full refund works (REFUNDED, 100% clawback)`, async () => {
    const s = await setup();
    const rma = await openRma(s.buyer, s.order.id);
    const staff = await apiAs(role);
    const bad = await staff.post(`rma/${rma.id}/approve`, { refundAmount: "100.00" });
    expect(bad.status()).toBe(400);
    expect(await bad.text()).toContain("RMA_REFUND_AMOUNT_INVALID");
    expect((await getRma(s.buyer.api, rma.id)).status).toBe("REQUESTED");
    expect(await clawedBackCents(s.order.id)).toBe(0n);

    await ok(await staff.post(`rma/${rma.id}/approve`, {}));
    const approved = await getRma(s.buyer.api, rma.id);
    expect(approved.status).toBe("APPROVED");
    expect(cents(approved.refundAmount)).toBe(s.total);
    await completeRmaAfterApproval(s.buyer, s.referrer.user.api, rma.id);
    await expectClawed(s.order.id, s.creditedCents);
    await expect.poll(async () => (await getOrder(s.buyer.api, s.order.id)).status).toBe("REFUNDED");
    expect((await walletOf(s.referrer.user)).availableCents).toBe(0n);
  });
}

test("seller of ANOTHER shop cannot approve (403), with or without an amount", async () => {
  const s = await setup();
  const rma = await openRma(s.buyer, s.order.id);
  const other = await createSellerWithSku({ prefix: "other" });
  for (const body of [{ refundAmount: "100.00" }, {}]) {
    const res = await other.user.api.post(`rma/${rma.id}/approve`, body);
    expect(res.status(), JSON.stringify(body)).toBe(403);
  }
  expect((await getRma(s.buyer.api, rma.id)).status).toBe("REQUESTED");
  expect((await getOrder(s.buyer.api, s.order.id)).status).toBe("DELIVERED");
});

test("referrer wallet short of points: wallet never negative, shortfall recorded, collected by the retry sweep once points exist", async () => {
  const s = await setup();
  await adjustWallet(s.referrer.user.id, "-300.00", "e2e: leave 10.00 of 310.00 points"); // admin debit
  expect((await walletOf(s.referrer.user)).availableCents).toBe(1000n);

  const rma = await openRma(s.buyer, s.order.id);
  await ok(await s.referrer.user.api.post(`rma/${rma.id}/approve`, { refundAmount: "40000.00" }));
  await completeRmaAfterApproval(s.buyer, s.referrer.user.api, rma.id);
  const expected = claw(s.creditedCents, 4000000n, s.total); // 12399 > 1000 available

  // refund itself completed; the clawback is parked (whole step), nothing debited, wallet untouched and >= 0
  await expect.poll(async () => {
    const row = (await commissionRowsOfOrder(s.order.id)).find((r) => r.type === "REFERRAL")!;
    return row.meta?.reversalPending === true;
  }, { message: "shortfall recorded on the ledger row", timeout: 15_000 }).toBe(true);
  const parked = (await commissionRowsOfOrder(s.order.id)).find((r) => r.type === "REFERRAL")!;
  expect(parked.meta.reversalPendingReason).toBe("insufficient_available_balance");
  expect(await clawedBackCents(s.order.id)).toBe(0n);
  expect((await walletOf(s.referrer.user)).availableCents).toBe(1000n);
  expect((await getOrder(s.buyer.api, s.order.id)).status).toBe("DELIVERED");

  // points arrive; the sweep (hourly cron '17 * * * *', run once through the backend DI container) collects the shortfall
  await adjustWallet(s.referrer.user.id, "500.00", "e2e: top-up");
  await runReversalSweep();
  await expectClawed(s.order.id, expected);
  const after = (await walletOf(s.referrer.user)).availableCents;
  expect(after).toBe(1000n + 50000n - expected);
  expect(after).toBeGreaterThanOrEqual(0n);
  const row = (await commissionRowsOfOrder(s.order.id)).find((r) => r.type === "REFERRAL")!;
  expect(row.meta.reversalPending).toBeFalsy();
  expect(centsToDecimal(expected)).toBe("123.99");
});

// ---------------------------------------------------------------------------------------------------------------------
// Regression for a product bug found by this suite (BUG-1, fixed): the modal text contradicted the real clawback.
// ---------------------------------------------------------------------------------------------------------------------

test("BUG-1 regression: partial-refund note states that the commission is reduced, not \"not reversed\"", async ({ browser }) => {
  // Product text (en.json admin.rmaPage.approveModal.partialNote): "...the order stays delivered and commissions are not reversed."
  // Real behaviour (test 1): a partial refund claws back floor(C x refunded / total) points of the referral commission.
  const s = await setup();
  await openRma(s.buyer, s.order.id);
  const ui = await uiPageFor(browser, s.referrer.user);
  await ui.page.goto("/seller/rma");
  await ui.page.getByRole("button", { name: "Approve", exact: true }).first().click();
  const dialog = ui.page.getByRole("dialog");
  await expect(dialog.getByText(/At most 100005\.00/)).toBeVisible();
  await dialog.getByLabel("Refund amount (TWD, optional)").fill("40000");
  const note = dialog.getByRole("status");
  await expect(note).toContainText("Partial refund of 40000.00");
  await expect(note).not.toContainText(/not reversed/i);
  await expect(note).toContainText(/reduced in proportion/i);
  await ui.context.close();
});
