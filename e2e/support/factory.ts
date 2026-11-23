import type { APIResponse } from "@playwright/test";
import { Api, anon, apiAs, apiLogin, freshIp, ok } from "./api";
import { DEFAULT_PASSWORD } from "./env";
import { latestOtp } from "./otp";
import { sql } from "./db";
import { runEligibility } from "./backend-ctl";

/**
 * Data factory for E2E specs. Everything goes through the real HTTP API; the few SQL escapes carry a `// SQL:` comment.
 * Names/emails are unique per (process, run, counter): `RUN` is fixed when the module loads, the counter is deterministic.
 */
const RUN = Date.now().toString(36);
let seq = 0;
export function uniq(prefix: string): string {
  seq += 1;
  return `${prefix}-${RUN}-${process.pid}-${seq}`;
}

/** Minimal valid PDF (starts with %PDF, accepted for shop documents). */
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");
/** 1x1 PNG (payment / refund proof, RMA evidence). */
export const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

export interface TestUser {
  id: string;
  email: string;
  password: string;
  referralCode: string | null;
  /** Session of this user (cookies). Re-created by `relogin` when roles change. */
  api: Api;
}

async function meOf(api: Api) {
  const me = await ok<any>(await api.get("users/me"));
  return me.user ?? me;
}

/**
 * Register a brand-new BUYER through the real 2-step flow (register -> OTP read from the backend log -> verify + set password).
 * `referrerCode` links the new user under that referrer (F1 upline).
 */
export async function createUser(opts: { prefix?: string; referrerCode?: string; fullName?: string } = {}): Promise<TestUser> {
  const email = `${uniq(opts.prefix ?? "u")}@e2e.test`;
  const api = await anon();
  await ok(await api.post("auth/register", { email, fullName: opts.fullName ?? email.split("@")[0], ...(opts.referrerCode ? { referrerCode: opts.referrerCode } : {}) }));
  const otp = await latestOtp(email);
  await ok(await api.post("auth/register/verify-otp", { email, otp, password: DEFAULT_PASSWORD }), [200, 201]);
  const me = await meOf(api);
  return { id: me.id, email, password: DEFAULT_PASSWORD, referralCode: me.referralCode ?? null, api };
}

/** Fresh login (new JWT with the user's current roles, e.g. after becoming SELLER). */
export async function relogin(u: TestUser): Promise<TestUser> {
  await u.api.dispose();
  const api = await apiLogin(u.email, u.password);
  const me = await meOf(api);
  return { ...u, api, referralCode: me.referralCode ?? u.referralCode };
}

/** Referral code of a user (allocated lazily by the MLM profile endpoint when missing). */
export async function referralCodeOf(u: TestUser): Promise<string> {
  if (u.referralCode) return u.referralCode;
  const me = await meOf(u.api);
  if (!me.referralCode) throw new Error(`user ${u.email} has no referralCode`);
  u.referralCode = me.referralCode;
  return me.referralCode;
}

export interface TestSeller {
  user: TestUser;
  shopId: string;
  productId: string;
  variantId: string;
  sku: string;
  unitPrice: string;
}

/**
 * New user -> shop application (multipart PDF) -> SUPER_ADMIN approves (grants SELLER) -> warehouse -> product with one SKU
 * -> admin approves product -> inbound stock slip approved. Returns a seller whose SKU has `stock` units.
 */
export async function createSellerWithSku(opts: { unitPrice?: string; stock?: number; referrerCode?: string; prefix?: string } = {}): Promise<TestSeller> {
  const unitPrice = opts.unitPrice ?? "100000.00";
  const stock = opts.stock ?? 50;
  let user = await createUser({ prefix: opts.prefix ?? "seller", referrerCode: opts.referrerCode });
  const shopName = uniq("Shop");
  const apply = await user.api.ctx.post("shops/apply", {
    multipart: {
      name: shopName,
      taxId: `${String(Date.now()).slice(3)}${String(process.pid % 1000).padStart(3, "0")}${String(seq % 100).padStart(2, "0")}`, // 15 digits, unique per ms/worker/call
      countryCode: "TW",
      bankName: "E2E Bank",
      accountNumber: "1234567890",
      accountName: "E2E Seller",
      document: { name: "doc.pdf", mimeType: "application/pdf", buffer: PDF },
    },
    headers: { "idempotency-key": crypto.randomUUID() },
  });
  const shop = await ok<any>(apply, [200, 201]);
  const shopId: string = shop.id ?? shop.shop?.id ?? shop.shopId;

  const sa = await apiAs("SUPER_ADMIN");
  await ok(await sa.post(`admin/shops/${shopId}/approve`));
  user = await relogin(user);

  const sku = uniq("SKU").toUpperCase();
  const warehouseCode = uniq("WH").toUpperCase().slice(0, 30);
  await ok(await user.api.post("inventory/warehouses", { code: warehouseCode, address: "E2E", countryCode: "TW" }));
  const product = await ok<any>(
    await user.api.post("products", {
      title: uniq("Product"),
      description: "e2e product",
      categoryId: "cat-electronics",
      variants: [{ sku, sellingPrice: unitPrice }],
    }),
  );
  const productId: string = product.id ?? product.product?.id;
  await ok(await sa.post(`admin/products/${productId}/approve`));
  const variants = await ok<any>(await user.api.get(`inventory/variants?productId=${productId}`));
  const items: any[] = variants.items ?? variants;
  const variantId: string = items.find((v) => v.sku === sku).id;

  const slip = await ok<any>(
    await user.api.post("inventory/slips", { type: "IN", warehouseCode, items: [{ sku, quantity: stock }] }),
  );
  await ok(await sa.post(`admin/inventory/slips/${slip.id ?? slip.slip?.id}/approve`));
  return { user, shopId, productId, variantId, sku, unitPrice };
}

/** Admin wallet adjustment (signed points). Positive = credit, negative = debit available. */
export async function adjustWallet(userId: string, amount: string, note = "e2e"): Promise<void> {
  const sa = await apiAs("SUPER_ADMIN");
  await ok(await sa.post("admin/wallet/adjust", { userId, amount, note }));
}

/** Points available in the user's wallet, as a decimal string and as integer hundredths. */
export async function walletOf(u: { api: Api }): Promise<{ raw: any; available: string; availableCents: bigint }> {
  const w = await ok<any>(await u.api.get("wallet"));
  const available: string = String(w.availableBalance);
  return { raw: w, available, availableCents: decimalToCents(available) };
}

export function decimalToCents(v: string | number): bigint {
  const s = String(v).trim();
  const neg = s.startsWith("-");
  const [w, f = ""] = (neg ? s.slice(1) : s).split(".");
  const c = BigInt(w || "0") * 100n + BigInt(f.padEnd(2, "0").slice(0, 2));
  return neg ? -c : c;
}
export const centsToDecimal = (c: bigint): string => `${c < 0n ? "-" : ""}${(c < 0n ? -c : c) / 100n}.${String((c < 0n ? -c : c) % 100n).padStart(2, "0")}`;

/** Set the MLM rank of a user (admin API). Rank >= 6 pays the maximum 10% referral rate. */
export async function setRank(userId: string, rank: number): Promise<void> {
  const sa = await apiAs("SUPER_ADMIN");
  await ok(await sa.patch(`admin/mlm/users/${userId}/rank`, { rank }));
}

const ADDRESS = { fullName: "E2E Buyer", phone: "0900000000", line1: "1 Test Road", city: "Taipei", country: "TW" };

/** Place an order paid with the MOCK method (order starts PAID). Returns the order view. */
export async function placeOrder(buyer: TestUser, seller: TestSeller, quantity = 1): Promise<any> {
  const order = await ok<any>(
    await buyer.api.post("orders/checkout", {
      items: [{ variantId: seller.variantId, quantity }],
      shippingAddress: ADDRESS,
      paymentMethod: "MOCK",
    }),
  );
  return order.order ?? order.orders?.[0] ?? order;
}

/** Drive a PAID order to DELIVERED as the seller (CONFIRMED -> PACKED -> SHIPPED -> DELIVERED). */
export async function deliverOrder(seller: TestSeller, orderId: string): Promise<void> {
  for (const status of ["CONFIRMED", "PACKED", "SHIPPED", "DELIVERED"]) {
    await ok(await seller.user.api.patch(`orders/${orderId}/status`, { status }));
  }
}

export async function getOrder(api: Api, orderId: string): Promise<any> {
  const o = await ok<any>(await api.get(`orders/${orderId}`));
  return o.order ?? o;
}

export async function openRma(buyer: TestUser, orderId: string, reason = "E2E partial refund request"): Promise<any> {
  const r = await ok<any>(
    await buyer.api.post(`orders/${orderId}/rma`, { reason, bankInfo: { bankName: "E2E Bank", accountNumber: "99999999", accountName: "E2E Buyer" } }),
  );
  return r.rma ?? r;
}

/**
 * After the seller/staff APPROVED an RMA: buyer ships the return, seller receives + accepts it, seller uploads refund proof and
 * marks the refund sent, buyer confirms -> RMA COMPLETED (refund complete => ORDER_REFUNDED event => commission clawback).
 */
export async function completeRmaAfterApproval(buyer: TestUser, sellerApi: Api, rmaId: string): Promise<void> {
  await ok(await buyer.api.post(`rma/${rmaId}/return-shipped`, { trackingCode: uniq("TRK"), carrier: "E2E" }));
  await ok(await sellerApi.post(`rma/${rmaId}/return-received`, {}));
  await ok(await sellerApi.post(`rma/${rmaId}/accept-return`, {}));
  await ok(
    await sellerApi.ctx.post(`rma/${rmaId}/refund-proof`, {
      multipart: { proof: { name: "proof.png", mimeType: "image/png", buffer: PNG } },
      headers: { "idempotency-key": crypto.randomUUID() },
    }),
  );
  await ok(await sellerApi.post(`rma/${rmaId}/refund-sent`, {}));
  await ok(await buyer.api.post(`rma/${rmaId}/confirm-completed`, {}));
}

export interface ReferralSetup {
  referrer: TestSeller;
  buyer: TestUser;
  /** The order, DELIVERED and already past the 7-day hold: REFERRAL commission CREDITED to the referrer's wallet. */
  order: any;
  /** Points credited to the referrer for this order (ledger meta.points), integer hundredths. */
  creditedCents: bigint;
}

/**
 * Referrer (seller, rank 6 = 10% referral rate, with the SKU) + buyer registered under them + one order of `quantity` units paid (MOCK),
 * delivered, then pushed past the 7-day hold so the REFERRAL commission is credited to the referrer's wallet.
 * Defaults: unitPrice 100000 TWD (+ 5 shipping) => subtotal 100000 >= the 2000 referral minimum, commission 10000 TWD,
 * 10000 * 0.031 / 0.99999 = 310.00 points. The RMA window is re-opened afterwards (see SQL comments) so a refund can still be requested.
 */
/** Referrer (seller, rank 6) + referred buyer + DELIVERED order, not yet past the 7-day hold (no commission row yet). */
export async function createDeliveredReferralOrder(opts: { unitPrice?: string; quantity?: number; referrerRank?: number } = {}): Promise<{ referrer: TestSeller; buyer: TestUser; order: any }> {
  const referrer = await createSellerWithSku({ unitPrice: opts.unitPrice, prefix: "ref" });
  await setRank(referrer.user.id, opts.referrerRank ?? 6);
  const buyer = await createUser({ prefix: "buyer", referrerCode: await referralCodeOf(referrer.user) });
  const order = await placeOrder(buyer, referrer, opts.quantity ?? 1);
  await deliverOrder(referrer, order.id);
  return { referrer, buyer, order };
}

/** Push an order past the 7-day hold and run the eligibility step (referral row is created). Does NOT re-open the RMA window. */
export async function makeOrderEligible(orderId: string): Promise<{ marked: boolean; ledgerRow: boolean }> {
  // SQL: no API/time-travel exists for the 7-day hold. Push paid_at/delivered_at 8/9 days back so the order is eligible.
  await sql(`UPDATE orders SET delivered_at = now() - interval '8 days', paid_at = now() - interval '9 days' WHERE id = $1`, [orderId]);
  // SERVICE: eligibility is only run by an hourly cron (no HTTP route): same service method through the helper process.
  return runEligibility(orderId);
}

export async function createCreditedReferralOrder(opts: { unitPrice?: string; quantity?: number; referrerRank?: number; expectStatus?: "CREDITED" | "PENDING" } = {}): Promise<ReferralSetup> {
  const { referrer, buyer, order } = await createDeliveredReferralOrder(opts);
  const r = await makeOrderEligible(order.id);
  if (!r.marked || !r.ledgerRow) throw new Error(`eligibility did not credit referral: ${JSON.stringify(r)}`);
  // SQL: a buyer can only open an RMA within 7 days of delivery, but the commission is only paid after 7 days. In production the
  // refund therefore normally precedes the credit; to test "clawback of an already credited commission" re-open the window.
  await sql(`UPDATE orders SET delivered_at = now() - interval '1 day' WHERE id = $1`, [order.id]);
  const rows = await commissionRowsOfOrder(order.id);
  const ref = rows.find((x) => x.type === "REFERRAL");
  if (!ref || ref.status !== (opts.expectStatus ?? "CREDITED")) throw new Error(`referral row not ${opts.expectStatus ?? "CREDITED"}: ${JSON.stringify(rows)}`);
  return { referrer, buyer, order: await getOrder(buyer.api, order.id), creditedCents: decimalToCents(String(ref.meta.points)) };
}

export interface CommissionRow {
  id: string;
  status: string;
  type: string;
  payout_amount: string;
  meta: any;
  idempotency_key: string;
  wallet_tx_id: string | null;
}

/** Ground-truth ledger rows of one order (REFERRAL credit + reversal rows). */
export async function commissionRowsOfOrder(orderId: string): Promise<CommissionRow[]> {
  // SQL: read-only ground truth; the user-facing ledger endpoints are paged/filtered by period and do not expose meta.refund.
  return sql<CommissionRow>(
    `SELECT id, status, type, payout_amount, meta, idempotency_key, wallet_tx_id FROM commission_ledger WHERE source_order_id = $1 ORDER BY created_at`,
    [orderId],
  );
}

/** Points debited from the referrer's wallet by clawbacks of this order so far (integer hundredths). */
export async function clawedBackCents(orderId: string): Promise<bigint> {
  // SQL: read-only; sums the reversal rows' meta.points (hundredths = points*100) written by the commission service.
  const rows = await sql<{ pts: string | null }>(
    `SELECT COALESCE(SUM(ROUND((meta->>'points')::numeric * 100)), 0)::text AS pts
       FROM commission_ledger WHERE source_order_id = $1 AND (meta->>'reversal') = 'true' AND wallet_tx_id IS NOT NULL`,
    [orderId],
  );
  return BigInt(rows[0]?.pts ?? "0");
}

export { freshIp, apiAs, ok };
export type { APIResponse };
