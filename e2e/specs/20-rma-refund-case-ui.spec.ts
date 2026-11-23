import { test, expect, type Page } from "@playwright/test";
import { ok } from "../support/api";
import { sql } from "../support/db";
import { PNG, createSellerWithSku, getOrder, uniq, walletOf, type TestSeller, type TestUser } from "../support/factory";
import { getRma } from "../support/ui";
import { checkoutPending } from "../support/currency";
import { centsText, buyerInRegion, toCents, uiAs } from "../support/cart-ui";
import { tr, type Locale } from "../support/money-inputs";
import { staffApi, uploadProof } from "../support/kit-flows-9-13";
import { deliverOrder } from "../support/factory";

/**
 * FLOW 20 - refund case that is BORN FROM AN RMA (not a cancel), on a REAL (non-MOCK) order with every document: checkout OFF_PLATFORM in
 * the region currency, buyer uploads the bill, seller confirms the payment, delivery, then the RMA workflow in the browser for the three
 * parties: buyer (opens the RMA, ships the return, confirms the refund), seller (approves, receives, accepts, uploads the transfer proof,
 * marks the refund sent) and admin (approves in the admin RMA page / reads the case and the RMA behind it).
 *
 * Rules (sources: refund-case-money.ts, rma/refund-amount.ts, handover C2-1, TEST-GUIDE 8/9):
 *  - a case is created when the RMA reaches REFUND_PENDING (return accepted); MOCK orders never get one (09/08 use MOCK or cancel);
 *  - case amount_cents = the refund in TWD hundredths; is_partial = refund < order total;
 *  - display amount = floor((refundCents x fx + scale/2) / scale) at the order's LOCKED fx (half up, integer math); a refund of the
 *    whole total is the stored display_total exactly;
 *  - the seller cannot mark a RMA case paid before the transfer proof exists; no wallet moves in any step (case money is off platform).
 * Oracle: BigInt from the raw orders / rma_requests / refund_cases rows. The UI text is compared with what the oracle says.
 */
test.describe.configure({ timeout: 300_000 });
test.use({ actionTimeout: 20_000 }); // a wrong selector fails in 20 s, not at the test timeout

const PROOF = { name: "refund-proof.png", mimeType: "image/png", buffer: PNG };

interface World { seller: TestSeller; buyer: TestUser; order: any; totalC: bigint; row: any }

/** OFF_PLATFORM order in the buyer's region currency: bill uploaded, payment confirmed, DELIVERED. */
async function deliveredOffPlatformOrder(region: string, cur: string, unitPrice: string): Promise<World> {
  const seller = await createSellerWithSku({ unitPrice, stock: 20, prefix: "rmaseller" });
  const buyer = await buyerInRegion(region, "rmabuyer");
  const { order } = await checkoutPending(buyer, seller, cur);
  await uploadProof(buyer, order.id);
  await ok(await seller.user.api.post(`orders/${order.id}/payment/confirm`, {}));
  await deliverOrder(seller, order.id);
  const [row] = await sql<any>(`SELECT total::text AS total, display_total::text AS display_total, fx_rate::text AS fx_rate, display_currency, payment_method, status, payment_proof_url FROM orders WHERE id = $1`, [order.id]);
  expect(row.payment_method).not.toBe("MOCK");
  expect(row.status).toBe("DELIVERED");
  expect(row.payment_proof_url).toBeTruthy();
  return { seller, buyer, order: await getOrder(buyer.api, order.id), totalC: toCents(row.total), row };
}

/** integer oracle: display cents of a refund at the locked fx (refund-case-money.displayCentsFor, written again from its doc comment) */
function displayOfRefund(refundC: bigint, totalC: bigint, displayTotal: string, fx: string): bigint {
  if (refundC === totalC) return toCents(displayTotal);
  const [w, f = ""] = fx.split(".");
  const scale = 10n ** BigInt(f.length);
  return (refundC * (BigInt(w) * scale + BigInt(f || "0")) + scale / 2n) / scale;
}

async function caseOfRma(rmaId: string) {
  const [c] = await sql<any>(
    `SELECT id, status, source_type, amount_cents::text AS amount_cents, is_partial, display_currency, display_amount_cents::text AS display_amount_cents, fx_rate::text AS fx_rate, currency
       FROM refund_cases WHERE source_type = 'RMA' AND source_id = $1`,
    [rmaId],
  );
  return c;
}
async function walletPrint(u: { id: string; api: any }) {
  const w = await walletOf(u);
  const [r] = await sql<{ n: string }>(`SELECT COUNT(*)::text AS n FROM wallet_transactions WHERE user_id = $1`, [u.id]);
  return `${w.availableCents}|${r.n}`;
}
async function clickIn(page: Page, name: string) {
  await page.getByRole("button", { name, exact: true }).first().click({ timeout: 15_000 });
}
/** /seller/rma opens on the REQUESTED filter: pick the status the next step works on */
async function sellerFilter(page: Page, L: Locale, status: string) {
  await page.getByLabel(tr(L, "admin.common.filterStatus")).selectOption(status);
}
const RESP = { timeout: 15_000 };

test("VN (VND, UI vi): partial RMA refund, buyer + seller in the UI, case amounts = oracle, no wallet moves", async ({ browser }) => {
  const L: Locale = "vi";
  const w = await deliveredOffPlatformOrder("VN", "VND", "3000.00"); // total 3005.00 TWD
  expect(w.totalC).toBe(300500n);
  const before = { buyer: await walletPrint(w.buyer), seller: await walletPrint(w.seller.user) };
  const refundC = 100000n; // partial 1000.00 TWD
  const expDisplay = displayOfRefund(refundC, w.totalC, w.row.display_total, w.row.fx_rate);

  const b = await uiAs(browser, w.buyer, { lang: L, region: "vn" });
  const s = await uiAs(browser, w.seller.user, { lang: L, region: "vn" });
  try {
    // 1. buyer opens the RMA in the UI (reason + bank data)
    await b.page.goto(`/orders/${w.order.id}/rma`);
    await b.page.getByPlaceholder(tr(L, "orders.rma.reasonPlaceholder")).fill("Hàng lỗi (e2e)");
    await b.page.getByPlaceholder(tr(L, "orders.rma.bankName")).fill("E2E Bank");
    await b.page.getByPlaceholder(tr(L, "orders.rma.accountNumber")).fill("99999999");
    await b.page.getByPlaceholder(tr(L, "orders.rma.accountName")).fill("E2E Buyer");
    const created = b.page.waitForResponse((r) => r.url().endsWith(`/orders/${w.order.id}/rma`) && r.request().method() === "POST", RESP);
    await b.page.getByRole("button", { name: tr(L, "orders.rma.submitBtn") }).click();
    const cb = (await (await created).json()).data;
    const rmaId: string = cb.id ?? cb.rma.id;
    expect((await getRma(w.buyer.api, rmaId)).status).toBe("REQUESTED");
    expect(await caseOfRma(rmaId)).toBeUndefined(); // no case yet: nothing is owed until the return is accepted

    // 2. seller approves a partial refund in /seller/rma
    await s.page.goto("/seller/rma");
    await clickIn(s.page, tr(L, "seller.rmaPage.approve"));
    const dlg = s.page.getByRole("dialog");
    await dlg.getByLabel(tr(L, "admin.rmaPage.approveModal.amountLabel")).fill("1000");
    // the dialog tells the seller what the refund is in the buyer's display currency (locked fx, half-up): same number as the oracle
    await expect(dlg).toContainText(`${centsText(expDisplay)} VND`);
    const appr = s.page.waitForResponse((r) => r.url().endsWith(`/rma/${rmaId}/approve`) && r.request().method() === "POST", RESP);
    await dlg.getByRole("button", { name: tr(L, "admin.rmaPage.approveModal.confirmPartial"), exact: true }).click();
    expect((await appr).status()).toBe(200);
    const rma1 = await getRma(w.buyer.api, rmaId);
    expect(rma1.status).toBe("APPROVED");
    expect(toCents(rma1.refundAmount)).toBe(refundC);

    // 3. buyer ships the return in the order page
    await b.page.goto(`/orders/${w.order.id}`);
    await b.page.getByPlaceholder(tr(L, "orders.rma.trackingPlaceholder")).fill(uniq("TRK"));
    await b.page.getByPlaceholder(tr(L, "orders.rma.carrierPlaceholder")).fill("E2E");
    await clickIn(b.page, tr(L, "orders.rma.markShipped"));
    await expect.poll(async () => (await getRma(w.buyer.api, rmaId)).status).toBe("RETURN_SHIPPED");

    // 4. seller marks received, accepts the return (UI) => REFUND_PENDING and the case appears
    await s.page.goto("/seller/rma");
    await sellerFilter(s.page, L, "RETURN_SHIPPED");
    await clickIn(s.page, tr(L, "seller.rmaPage.markReceived"));
    await expect.poll(async () => (await getRma(w.buyer.api, rmaId)).status).toBe("RETURN_RECEIVED");
    await sellerFilter(s.page, L, "RETURN_RECEIVED");
    await clickIn(s.page, tr(L, "seller.rmaPage.acceptReturn"));
    await expect.poll(async () => (await getRma(w.buyer.api, rmaId)).status).toBe("REFUND_PENDING");

    const c0 = await caseOfRma(rmaId);
    expect(c0).toMatchObject({ status: "OPEN", source_type: "RMA", is_partial: true, currency: "TWD", display_currency: "VND" });
    expect(c0.amount_cents).toBe(String(refundC));
    expect(c0.display_amount_cents).toBe(String(expDisplay));
    expect(c0.fx_rate).toBe(w.row.fx_rate);

    // 5. the three roles see the same case: amounts in TWD and in the locked display currency
    await b.page.goto("/refunds");
    const bCard = b.page.locator("div.mq-card").filter({ hasText: w.order.code });
    await expect(bCard).toHaveCount(1);
    await expect(bCard).toContainText(`${centsText(refundC)} TWD`);
    await expect(bCard).toContainText(`${centsText(expDisplay)} VND`);
    await expect(bCard).toContainText(tr(L, "refundCases.status.OPEN"));
    await expect(bCard).toContainText(tr(L, "refundCases.kind.partial"));
    await expect(bCard).toContainText(tr(L, "refundCases.source.RMA"));
    await s.page.goto("/seller/refunds");
    const sCard = s.page.locator("div.mq-card").filter({ hasText: w.order.code });
    await expect(sCard).toContainText(`${centsText(refundC)} TWD`);
    await expect(sCard.getByText(tr(L, "refundCases.rma.hint"), { exact: false })).toBeVisible(); // proof first
    await expect(sCard.getByRole("button", { name: tr(L, "refundCases.action.MARK_PAID"), exact: true })).toHaveCount(0);
    const admin = await staffApi("ADMIN");
    const a = await uiAs(browser, { api: admin }, { lang: L, region: "vn" });
    try {
      await a.page.goto(`/admin/refund-cases/${c0.id}`);
      await expect(a.page.getByText(`${centsText(refundC)} TWD`).first()).toBeVisible();
      await expect(a.page.getByText(`${centsText(expDisplay)} VND`).first()).toBeVisible();
      await expect(a.page.getByText(tr(L, "refundCases.detail.proofNo"))).toBeVisible();
      // the API refuses to mark paid before the proof exists
      const early = await w.seller.user.api.post(`refund-cases/${c0.id}/mark-paid`, { reference: "TRF-EARLY" });
      expect(early.status()).toBeGreaterThanOrEqual(400);
      expect(early.status()).toBeLessThan(500);
      expect((await caseOfRma(rmaId)).status).toBe("OPEN");

      // 6. seller uploads the transfer proof, then marks the refund sent (order page)
      await s.page.goto(`/orders/${w.order.id}`);
      await s.page.locator("#refund-proof").setInputFiles(PROOF);
      await expect(s.page.getByRole("button", { name: tr(L, "seller.rmaPage.markRefundSent"), exact: true })).toBeEnabled();
      await clickIn(s.page, tr(L, "seller.rmaPage.markRefundSent"));
      await expect.poll(async () => (await getRma(w.buyer.api, rmaId)).status).toBe("REFUND_SENT");
      await expect.poll(async () => (await caseOfRma(rmaId)).status).toBe("SELLER_MARKED_PAID");
      await a.page.reload();
      await expect(a.page.getByText(tr(L, "refundCases.detail.proofYes"))).toBeVisible();

      // 7. buyer confirms receipt: from the case list (the RMA workflow carries it out) => case CLOSED, RMA COMPLETED
      await b.page.goto("/refunds");
      await expect(bCard).toContainText(tr(L, "refundCases.status.SELLER_MARKED_PAID"));
      const confirmResp = b.page.waitForResponse((r) => r.url().endsWith(`/refund-cases/${c0.id}/confirm`), RESP);
      await bCard.getByRole("button", { name: tr(L, "refundCases.action.CONFIRM"), exact: true }).click();
      await b.page.getByRole("dialog").getByRole("button", { name: tr(L, "refundCases.action.CONFIRM"), exact: true }).click();
      expect((await confirmResp).status()).toBe(200);
      await expect.poll(async () => (await caseOfRma(rmaId)).status).toBe("CLOSED");
      await expect.poll(async () => (await getRma(w.buyer.api, rmaId)).status).toBe("COMPLETED");
      await b.page.reload();
      await expect(bCard).toContainText(tr(L, "refundCases.status.CLOSED"));
      await expect(bCard.getByRole("button", { name: tr(L, "refundCases.action.CONFIRM"), exact: true })).toHaveCount(0);
      a.health.assertClean("admin pages");
    } finally {
      await a.context.close();
      await admin.dispose();
    }

    // 8. money truth: partial refund leaves the order DELIVERED, no wallet moved (the transfer is off platform), amounts unchanged
    const fin = await caseOfRma(rmaId);
    expect(fin.amount_cents).toBe(String(refundC));
    expect(fin.display_amount_cents).toBe(String(expDisplay));
    expect((await getOrder(w.buyer.api, w.order.id)).status).toBe("DELIVERED");
    expect(await walletPrint(w.buyer)).toBe(before.buyer);
    expect(await walletPrint(w.seller.user)).toBe(before.seller);
    b.health.assertClean("buyer pages");
    s.health.assertClean("seller pages");
  } finally {
    await b.context.close();
    await s.context.close();
  }
});

test("TW (TWD, UI zh-TW): full RMA refund approved by ADMIN in the UI; case = order total, display = stored total; buyer confirms; order REFUNDED", async ({ browser }) => {
  const L: Locale = "zh-TW";
  const w = await deliveredOffPlatformOrder("TW", "TWD", "1500.00"); // total 1505.00
  expect(w.totalC).toBe(150500n);
  const before = { buyer: await walletPrint(w.buyer), seller: await walletPrint(w.seller.user) };
  const admin = await staffApi("ADMIN");
  const b = await uiAs(browser, w.buyer, { lang: L, region: "tw" });
  const s = await uiAs(browser, w.seller.user, { lang: L, region: "tw" });
  const a = await uiAs(browser, { api: admin }, { lang: L, region: "tw" });
  try {
    const rma = await ok<any>(
      await w.buyer.api.post(`orders/${w.order.id}/rma`, { reason: "e2e full refund", bankInfo: { bankName: "E2E Bank", accountNumber: "99999999", accountName: "E2E Buyer" } }),
    );
    const rmaId: string = (rma.rma ?? rma).id;

    // admin approves in /admin/rma/[id] (no amount typed = the whole total)
    await a.page.goto(`/admin/rma/${rmaId}`);
    const appr = a.page.waitForResponse((r) => r.url().includes(`/rma/${rmaId}/`) && r.request().method() === "POST", RESP);
    await a.page.getByRole("button", { name: tr(L, "admin.common.approve"), exact: true }).first().click();
    const dlg = a.page.getByRole("dialog");
    await expect(dlg).toContainText("1505.00"); // the cap the dialog shows = the order total (oracle: 1500 + 5 shipping)
    await dlg.getByRole("button", { name: tr(L, "admin.rmaPage.approveModal.confirmFull"), exact: true }).click();
    expect((await appr).status()).toBeLessThan(300);
    await expect.poll(async () => (await getRma(w.buyer.api, rmaId)).status).toBe("APPROVED");

    // the rest of the workflow in the UI as buyer / seller
    await b.page.goto(`/orders/${w.order.id}`);
    await b.page.getByPlaceholder(tr(L, "orders.rma.trackingPlaceholder")).fill(uniq("TRK"));
    await clickIn(b.page, tr(L, "orders.rma.markShipped"));
    await expect.poll(async () => (await getRma(w.buyer.api, rmaId)).status).toBe("RETURN_SHIPPED");
    await s.page.goto("/seller/rma");
    await sellerFilter(s.page, L, "RETURN_SHIPPED");
    await clickIn(s.page, tr(L, "seller.rmaPage.markReceived"));
    await expect.poll(async () => (await getRma(w.buyer.api, rmaId)).status).toBe("RETURN_RECEIVED");
    await sellerFilter(s.page, L, "RETURN_RECEIVED");
    await clickIn(s.page, tr(L, "seller.rmaPage.acceptReturn"));
    await expect.poll(async () => (await getRma(w.buyer.api, rmaId)).status).toBe("REFUND_PENDING");

    const c0 = await caseOfRma(rmaId);
    expect(c0).toMatchObject({ status: "OPEN", is_partial: false, currency: "TWD", display_currency: "TWD" });
    expect(c0.amount_cents).toBe(String(w.totalC));
    expect(c0.display_amount_cents).toBe(String(toCents(w.row.display_total))); // whole total = the stored display total exactly

    await s.page.goto(`/orders/${w.order.id}`);
    await s.page.locator("#refund-proof").setInputFiles(PROOF);
    await expect(s.page.getByRole("button", { name: tr(L, "seller.rmaPage.markRefundSent"), exact: true })).toBeEnabled();
    await clickIn(s.page, tr(L, "seller.rmaPage.markRefundSent"));
    await expect.poll(async () => (await getRma(w.buyer.api, rmaId)).status).toBe("REFUND_SENT");

    // buyer confirms on the ORDER page (the other place the same step exists)
    await b.page.goto(`/orders/${w.order.id}`);
    await clickIn(b.page, tr(L, "orders.rma.confirmReceived"));
    await expect.poll(async () => (await getRma(w.buyer.api, rmaId)).status).toBe("COMPLETED");
    await expect.poll(async () => (await caseOfRma(rmaId)).status).toBe("CLOSED");
    await expect.poll(async () => (await getOrder(w.buyer.api, w.order.id)).status).toBe("REFUNDED");

    // admin reads the closed case: amounts and the RMA behind it
    await a.page.goto(`/admin/refund-cases/${c0.id}`);
    await expect(a.page.getByText(`${centsText(w.totalC)} TWD`).first()).toBeVisible();
    await expect(a.page.getByText(tr(L, "refundCases.status.CLOSED")).first()).toBeVisible();
    await expect(a.page.getByText(tr(L, "refundCases.kind.full")).first()).toBeVisible();
    expect(await walletPrint(w.buyer)).toBe(before.buyer);
    expect(await walletPrint(w.seller.user)).toBe(before.seller);
    for (const [n, h] of [["buyer", b.health], ["seller", s.health], ["admin", a.health]] as const) h.assertClean(`${n} pages`);
  } finally {
    await b.context.close();
    await s.context.close();
    await a.context.close();
    await admin.dispose();
  }
});
