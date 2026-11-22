import { expect, test } from "@playwright/test";
import { apiAs, ok } from "../support/api";
import { sql } from "../support/db";
import { createSellerWithSku, createUser, deliverOrder, getOrder, PNG, type TestSeller, type TestUser } from "../support/factory";
import { pageAs, settingOf } from "../support/admin-flows";
import { escalateIfStale } from "../support/orders-ctl";

/**
 * Flow 5 (parallel part, no global setting is written): order in a non-TWD display currency, locked FX shown to the buyer,
 * payment proof -> seller confirms -> DELIVERED, and the "needs handling" (Cần xử lý) label after 48 h.
 * The FX-change part (old orders keep their amount) is 05-order-currency.serial.spec.ts.
 *
 * Product facts used: displayTotal = round(total x rate x 100) / 100 with the rate/fxAsOf of GET /fx/rates at checkout time;
 * USD is only a display currency (no US region), so checkout is done through the API with displayCurrency for all four.
 */
const ADDRESS = { fullName: "E2E Buyer", phone: "0900000000", line1: "1 Test Road", city: "Taipei", country: "TW" };
const DECIMALS: Record<string, number> = { USD: 2, MYR: 2, SGD: 2, VND: 0 };
const UNIT_PRICE = "1234.00"; // total = 1234 + 5 shipping = 1239 TWD, no round-half ties with any seeded rate

/** Independent oracle: round-half-up of totalCents x rate (decimal text) -> display cents. */
export function displayCents(totalCents: bigint, rate: string): bigint {
  const [w, f = ""] = rate.split(".");
  const num = BigInt(w + f);
  const den = 10n ** BigInt(f.length);
  return (totalCents * num * 2n + den) / (den * 2n);
}
export const fmt = (cents: bigint, cur: string, locale = "en-US") =>
  new Intl.NumberFormat(locale, { style: "currency", currency: cur, minimumFractionDigits: DECIMALS[cur], maximumFractionDigits: DECIMALS[cur] }).format(
    Number(cents) / 100,
  );

async function fxNow(api: { get(u: string): Promise<any> }) {
  const r = await ok<any>(await api.get("fx/rates"));
  return { asOf: r.asOf as string, rates: r.rates as Record<string, number> };
}

async function checkoutPending(buyer: TestUser, seller: TestSeller, currency: string) {
  const fx = await fxNow(buyer.api);
  const order = await ok<any>(
    await buyer.api.post("orders/checkout", {
      items: [{ variantId: seller.variantId, quantity: 1 }],
      shippingAddress: ADDRESS,
      paymentMethod: "OFF_PLATFORM",
      displayCurrency: currency,
      ...(currency !== "TWD" ? { fxAsOf: fx.asOf } : {}),
    }),
  );
  return { order: order.order ?? order, fx };
}

async function uploadProofApi(buyer: TestUser, orderId: string) {
  await ok(
    await buyer.api.ctx.post(`orders/${orderId}/payment-proof`, {
      multipart: { proof: { name: "proof.png", mimeType: "image/png", buffer: PNG } },
      headers: { "idempotency-key": crypto.randomUUID() },
    }),
  );
}

test.describe("05 order currency", () => {
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  let seller: TestSeller;
  test.beforeAll(async () => { seller = await createSellerWithSku({ unitPrice: UNIT_PRICE, stock: 50, prefix: "ccyseller" }); });

  for (const currency of ["USD", "VND", "MYR", "SGD"] as const) {
    test(`${currency}: amount to pay is shown in ${currency} with the locked rate, through payment, proof and DELIVERED`, async ({ browser }) => {
      const buyer = await createUser({ prefix: `ccy${currency.toLowerCase()}` });
      const { order, fx } = await checkoutPending(buyer, seller, currency);
      const rate = String(fx.rates[currency]);
      const expectCents = displayCents(123_900n, rate);
      expect(order.status).toBe("PENDING");
      expect(order.total).toBe(1239);
      expect(order.currency).toBe("TWD");
      expect(order.payableCurrency).toBe(currency);
      expect(order.fxRateLocked).toBe(fx.rates[currency]);
      expect(BigInt(Math.round(order.payableAmount * 100))).toBe(expectCents);

      const { page, context } = await pageAs(browser, buyer);
      /** PENDING: the payment box with the locked rate; later states: the order total in the display currency. */
      const seenLater = async () => {
        await expect(page.getByText(fmt(expectCents, currency)).first()).toBeVisible();
        await expect(page.getByText("DELIVERED", { exact: false }).first()).toBeVisible();
      };
      const seen = async () => {
        const box = page.locator("[data-payable]");
        await expect(box).toContainText(fmt(expectCents, currency));
        await expect(box).toContainText(`1 TWD = ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(fx.rates[currency])} ${currency}`);
        await expect(box).toContainText("1,239"); // internal ledger amount stays TWD
      };
      try {
        await page.goto(`/orders/${order.id}`);
        await seen();
        // receipt: through the UI for USD, through the API for the others
        if (currency === "USD") {
          await page.locator("#payment-proof").setInputFiles({ name: "receipt.png", mimeType: "image/png", buffer: PNG });
          const up = page.waitForResponse((r) => r.url().includes(`/orders/${order.id}/payment-proof`) && r.request().method() === "POST");
          await page.getByRole("button", { name: "Upload proof" }).click();
          expect((await up).status()).toBe(200);
          await expect(page.getByText("Proof uploaded — waiting for the seller to confirm payment.")).toBeVisible();
        } else {
          await uploadProofApi(buyer, order.id);
        }
        const withProof = await getOrder(buyer.api, order.id);
        expect(withProof.paymentProofUrl).toBeTruthy();
        expect(withProof.status).toBe("PENDING");

        // seller confirms: UI for USD, API otherwise
        if (currency === "USD") {
          const s = await pageAs(browser, seller.user);
          try {
            await s.page.goto(`/orders/${order.id}`);
            const confirm = s.page.waitForResponse((r) => r.url().includes(`/orders/${order.id}/payment/confirm`) && r.request().method() === "POST");
            await s.page.getByRole("button", { name: "Confirm payment" }).click();
            expect((await confirm).status()).toBe(200);
          } finally {
            await s.context.close();
          }
        } else {
          await ok(await seller.user.api.post(`orders/${order.id}/payment/confirm`));
        }
        const paid = await getOrder(buyer.api, order.id);
        expect(paid.status).toBe("PAID");
        expect(paid.paidAt).toBeTruthy();

        await deliverOrder(seller, order.id);
        const done = await getOrder(buyer.api, order.id);
        expect(done.status).toBe("DELIVERED");
        // the amount to pay never moved while the order went through its states
        expect(done.payableAmount).toBe(order.payableAmount);
        expect(done.payableCurrency).toBe(currency);
        expect(done.fxRateLocked).toBe(order.fxRateLocked);
        await page.reload();
        await seenLater();
      } finally {
        await context.close();
      }
    });
  }

  test("TWD checkout needs no rate and shows TWD", async () => {
    const buyer = await createUser({ prefix: "ccytwd" });
    const { order } = await checkoutPending(buyer, seller, "TWD");
    expect(order.payableCurrency).toBe("TWD");
    expect(order.payableAmount).toBe(1239);
    expect(order.fxRateLocked).toBe(1); // TWD is locked at rate 1
  });

  test("a non-TWD checkout with a stale fxAsOf is refused (FX_RATE_CHANGED) and creates no order", async () => {
    const buyer = await createUser({ prefix: "ccystale" });
    const res = await buyer.api.post("orders/checkout", {
      items: [{ variantId: seller.variantId, quantity: 1 }],
      shippingAddress: ADDRESS,
      paymentMethod: "OFF_PLATFORM",
      displayCurrency: "USD",
      fxAsOf: "2020-01-01T00:00:00.000Z",
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
    const mine = await sql<{ n: string }>(`SELECT count(*)::text AS n FROM orders WHERE buyer_id = $1`, [buyer.id]);
    expect(mine[0].n).toBe("0");
  });
});

/* ------------------------------------------------------------------ needs handling (48 h) */

const LABELS = { en: "Needs handling", vi: "Cần xử lý", "zh-TW": "需處理" } as const;

test.describe("05 needs-handling label (48 h unhandled bill)", () => {
  test.describe.configure({ timeout: 180_000 });

  async function pendingWithProof(hoursAgo: number) {
    const sel = await createSellerWithSku({ unitPrice: "300.00", prefix: "nhseller" });
    const buyer = await createUser({ prefix: "nhbuyer" });
    const { order } = await checkoutPending(buyer, sel, "TWD");
    await uploadProofApi(buyer, order.id);
    // SQL: the 48 h clock starts at the first proof; there is no API to move it, so push the proof timestamps back.
    await sql(
      `UPDATE orders SET payment_first_proof_at = now() - make_interval(hours => $2), payment_proof_uploaded_at = now() - make_interval(hours => $2) WHERE id = $1`,
      [order.id, hoursAgo],
    );
    return { sel, buyer, order };
  }

  test("proofStaleAutoCancelDays is empty by default: no auto-cancel is configured (label only)", async () => {
    const s = await settingOf(await apiAs("SUPER_ADMIN"), "proofStaleAutoCancelDays");
    expect(s.value).toBeNull();
  });

  test("proof older than 48 h: the order is escalated and shows the label to the seller in en, vi and zh-TW (not to the buyer)", async ({ browser }) => {
    const { sel, buyer, order } = await pendingWithProof(49);
    // SERVICE: the hourly job (OrderExpiryJob -> findStaleProofPendingReview -> escalateStaleProof) has no HTTP route and no clock seam.
    expect((await escalateIfStale(order.id)).escalated).toBe(true);
    const after = await getOrder(buyer.api, order.id);
    expect(after.status).toBe("PENDING"); // nothing auto-cancelled (setting empty)
    expect(after.paymentEscalatedAt).toBeTruthy();
    for (const lang of ["en", "vi", "zh-TW"] as const) {
      const { page, context } = await pageAs(browser, sel.user, lang);
      try {
        await page.goto(`/orders/${order.id}`);
        await expect(page.getByText(LABELS[lang], { exact: true }).first()).toBeVisible();
      } finally {
        await context.close();
      }
    }
    const seller = await pageAs(browser, sel.user, "en");
    try {
      await seller.page.goto("/seller/orders");
      await expect(seller.page.locator(`a[href="/orders/${order.id}"]`).getByText("Needs handling")).toBeVisible();
    } finally {
      await seller.context.close();
    }
    const b = await pageAs(browser, buyer, "en");
    try {
      await b.page.goto(`/orders/${order.id}`);
      await expect(b.page.getByText(order.code).first()).toBeVisible();
      await expect(b.page.getByText("Needs handling", { exact: true })).toHaveCount(0);
    } finally {
      await b.context.close();
    }
  });

  test("proof 47 h old: not escalated, no label", async ({ browser }) => {
    const { sel, buyer, order } = await pendingWithProof(47);
    expect((await escalateIfStale(order.id)).escalated).toBe(false);
    expect((await getOrder(buyer.api, order.id)).paymentEscalatedAt).toBeNull();
    const { page, context } = await pageAs(browser, sel.user, "en");
    try {
      await page.goto(`/orders/${order.id}`);
      await expect(page.getByText(order.code).first()).toBeVisible();
      await expect(page.getByText("Needs handling", { exact: true })).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test("an order without any proof never gets the label", async () => {
    const sel = await createSellerWithSku({ unitPrice: "300.00", prefix: "nhseller" });
    const buyer = await createUser({ prefix: "nhbuyer" });
    const { order } = await checkoutPending(buyer, sel, "TWD");
    // SQL: created 49 h ago, still no bill
    await sql(`UPDATE orders SET created_at = now() - interval '49 hours' WHERE id = $1`, [order.id]);
    expect((await escalateIfStale(order.id)).escalated).toBe(false);
    expect((await getOrder(buyer.api, order.id)).paymentEscalatedAt).toBeNull();
  });
});
