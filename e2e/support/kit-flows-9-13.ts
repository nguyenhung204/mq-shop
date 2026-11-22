import { expect } from "@playwright/test";
import { Api, apiLogin, ok } from "./api";
import { ROLES, type RoleName } from "./env";
import { PNG, createSellerWithSku, createUser, decimalToCents, walletOf, type TestSeller, type TestUser } from "./factory";
import { sql } from "./db";
import { freshIp } from "./api";
import { uiPageFor } from "./ui";
import type { Browser } from "@playwright/test";

/** Helpers private to flows 9 / 11 / 12 / 13 (refund cases, accounting export, dividend, backups). Nothing here changes global state. */

export interface CancelledCase {
  seller: TestSeller;
  buyer: TestUser;
  order: any;
  /** refund case id (source CANCEL, status OPEN) */
  caseId: string;
  reason: string;
}

/** Wallet-visible state of a user: available balance (hundredths) AND the number of wallet transactions. */
export async function walletFingerprint(u: { id: string; api: Api }): Promise<{ availableCents: bigint; frozen: string; txCount: number }> {
  const w = await walletOf(u);
  // SQL: read-only count of wallet_transactions rows: a balance can be unchanged while a +x/-x pair happened, so count the rows too.
  const [r] = await sql<{ n: string }>(`SELECT COUNT(*)::text AS n FROM wallet_transactions WHERE user_id = $1`, [u.id]);
  return { availableCents: w.availableCents, frozen: String(w.raw.frozenBalance ?? "0"), txCount: Number(r.n) };
}

const ADDRESS = { fullName: "E2E Buyer", phone: "0900000000", line1: "1 Test Road", city: "Taipei", country: "TW" };

/**
 * Order paid OFF_PLATFORM (the only kind that gets a refund case: MOCK orders never do): checkout -> buyer uploads proof
 * -> seller confirms payment -> PAID. Returns the order view.
 */
export async function offPlatformPaidOrder(buyer: TestUser, seller: TestSeller, quantity = 1): Promise<any> {
  const created = await ok<any>(
    await buyer.api.post("orders/checkout", { items: [{ variantId: seller.variantId, quantity }], shippingAddress: ADDRESS, paymentMethod: "OFF_PLATFORM" }),
  );
  const order = created.order ?? created.orders?.[0] ?? created;
  await uploadProof(buyer, order.id);
  await ok(await seller.user.api.post(`orders/${order.id}/payment/confirm`, {}));
  return { ...order, status: "PAID" };
}

export async function uploadProof(buyer: TestUser, orderId: string): Promise<void> {
  await ok(
    await buyer.api.ctx.post(`orders/${orderId}/payment-proof`, {
      multipart: { proof: { name: "proof.png", mimeType: "image/png", buffer: PNG } },
      headers: { "idempotency-key": crypto.randomUUID() },
    }),
  );
}

/** Find the refund case of an order in the buyer's list (as-buyer is newest first). */
export async function caseOfOrder(buyerApi: Api, orderId: string): Promise<any> {
  const items = await ok<any[]>(await buyerApi.get("refund-cases/as-buyer?pageSize=50"));
  const c = items.find((x) => x.orderId === orderId);
  if (!c) throw new Error(`no refund case for order ${orderId}`);
  return c;
}

/**
 * Paid order (MOCK) cancelled by ADMIN with a reason: the system opens a refund case (OPEN) by itself.
 * `selfDealing: true` first makes the order's buyer the shop owner (SQL, see comment): checkout itself refuses own-shop purchases.
 */
export async function cancelledPaidOrder(
  opts: { seller?: TestSeller; buyer?: TestUser; quantity?: number; reason?: string; selfDealing?: boolean; unitPrice?: string } = {},
): Promise<CancelledCase> {
  const seller = opts.seller ?? (await createSellerWithSku({ unitPrice: opts.unitPrice ?? "1000.00", prefix: "rcseller" }));
  const buyer = opts.buyer ?? (await createUser({ prefix: "rcbuyer" }));
  const order = await offPlatformPaidOrder(buyer, seller, opts.quantity ?? 1);
  const reason = opts.reason ?? "e2e admin cancel: stock problem";
  if (opts.selfDealing) {
    // SQL: checkout refuses a shop owner buying from own shop (OrderOwnShopForbidden) and no API changes an order's buyer;
    // make the owner the order's buyer so the case that the cancel opens has buyer == shop owner (TEST-GUIDE C2-c).
    await sql(`UPDATE orders SET buyer_id = $1 WHERE id = $2`, [seller.user.id, order.id]);
  }
  const admin = await staffApi("ADMIN");
  await ok(await admin.post(`admin/orders/${order.id}/cancel`, { reason }));
  await admin.dispose();
  const viewer = opts.selfDealing ? seller.user : buyer;
  const c = await caseOfOrder(viewer.api, order.id);
  return { seller, buyer: opts.selfDealing ? seller.user : buyer, order, caseId: c.id, reason };
}

/**
 * Own fresh session of a seed role (login with its own throttle bucket), instead of the shared stored session: other specs
 * run logout / session-revocation checks on the seeded accounts and would invalidate a shared cookie mid-test.
 */
export const staffApi = (role: RoleName): Promise<Api> => apiLogin(ROLES[role].email, ROLES[role].password);

/** Raw HTTP call that must be refused: returns {status, body} without throwing. */
export async function refused(res: { status(): number; text(): Promise<string> }): Promise<{ status: number; body: string }> {
  return { status: res.status(), body: await res.text() };
}

/** Sum of decimal strings in integer hundredths. */
export const sumCents = (xs: Array<string | number>): bigint => xs.reduce<bigint>((a, x) => a + decimalToCents(String(x)), 0n);

export { expect };

/**
 * Like uiPageFor, but every API call of the browser carries its own X-Forwarded-For (TRUST_PROXY=1): a browser context has
 * no such header, so ALL agents' UI sessions would share the 127.0.0.1 throttle bucket (100/min) and pages start
 * failing (auth bootstrap 429 -> redirect home) when several specs run at once.
 */
export async function uiPage(browser: Browser, who: { api: Api }) {
  const ui = await uiPageFor(browser, who);
  const ip = freshIp();
  await ui.context.route(/:3005\/api\/v1\//, (route) => route.continue({ headers: { ...route.request().headers(), "x-forwarded-for": ip } }));
  return ui;
}
