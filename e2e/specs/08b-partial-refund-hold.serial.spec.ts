import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { apiAs, ok } from "../support/api";
import {
  clawedBackCents, commissionRowsOfOrder, completeRmaAfterApproval, createCreditedReferralOrder, createDeliveredReferralOrder,
  decimalToCents, getOrder, makeOrderEligible, openRma, walletOf, type CommissionRow,
} from "../support/factory";
import { sql } from "../support/db";

/**
 * DEFAULT production path COMMISSION_PAYOUT_HOLD=true: a REFERRAL commission stays PENDING (TWD, ledger only) and the wallet is NOT credited.
 * This spec flips the backend env to hold=true (only the backend is restarted) and ALWAYS restores hold=false in afterAll
 * (every other spec depends on =false).
 *
 * Expected values come from an independent BigInt oracle (no product import), cents everywhere:
 *   G = commission TWD cents (10000.00 TWD = 1000000), T = order total cents (100005.00 = 10000500), R = cumulative refunded cents
 *   reducedTwd(R) = floor(G * R / T);   PENDING payout = G - reducedTwd(R)   (full refund R >= T: row VOID)
 *   points at flush = round-half-up(twdCents * 0.031 / 0.99999) = (2*n + d) / (2*d), n = twdCents*3100, d = 99999   (FX 0.031, peg 0.99999)
 * Spec C1-1: "Pending (not yet credited) commissions are cancelled/reduced the same way" as credited ones.
 */
test.describe.configure({ mode: "serial", timeout: 240_000 });

const ENV_FILE = path.join(__dirname, "..", "env", "backend.env");
const STACK = path.join(__dirname, "..", "scripts", "stack.sh");
const OUT = path.join(__dirname, "..", ".run", "hold.out");

function setHold(hold: boolean) {
  const text = fs.readFileSync(ENV_FILE, "utf8");
  const next = /^COMMISSION_PAYOUT_HOLD=.*$/m.test(text)
    ? text.replace(/^COMMISSION_PAYOUT_HOLD=.*$/m, `COMMISSION_PAYOUT_HOLD=${hold}`)
    : `${text}\nCOMMISSION_PAYOUT_HOLD=${hold}\n`;
  fs.writeFileSync(ENV_FILE, next);
  // restart ONLY the backend (DB/Redis kept); output to a file because the background node keeps pipes open
  const fd = fs.openSync(OUT, "w");
  execFileSync("bash", [STACK, "backend"], { stdio: ["ignore", fd, fd], timeout: 180_000 });
  fs.closeSync(fd);
}

test.beforeAll(() => setHold(true));
test.afterAll(() => setHold(false));

const G = 1000000n; // 10000.00 TWD commission
const T = 10000500n;
const reduced = (r: bigint) => (r >= T ? G : (G * r) / T);
const pendingTwd = (r: bigint) => G - reduced(r);
const pointsOf = (twdCents: bigint) => { const n = twdCents * 3100n, d = 99999n; return (2n * n + d) / (2n * d); };
const referral = async (orderId: string): Promise<CommissionRow> => (await commissionRowsOfOrder(orderId)).find((r) => r.type === "REFERRAL")!;
const cents = (v: string | number) => decimalToCents(String(v));

async function refundVia(s: { buyer: any; referrer: any; order: any }, amount: string | undefined, reason = "e2e hold refund") {
  const rma = await openRma(s.buyer, s.order.id, reason);
  await ok(await s.referrer.user.api.post(`rma/${rma.id}/approve`, amount ? { refundAmount: amount } : {}));
  await completeRmaAfterApproval(s.buyer, s.referrer.user.api, rma.id);
}

async function expectWalletUntouched(s: { referrer: any }) {
  const w = await walletOf(s.referrer.user);
  expect(w.availableCents).toBe(0n);
  expect(cents(w.raw.frozenBalance)).toBe(0n);
}

test("hold=true: referral commission is PENDING and the referrer's wallet is not credited", async () => {
  const s = await createCreditedReferralOrder({ expectStatus: "PENDING" });
  const row = await referral(s.order.id);
  expect(row.status).toBe("PENDING");
  expect(row.wallet_tx_id).toBeNull();
  expect(row.meta.payoutHold).toBe(true);
  expect(cents(row.payout_amount)).toBe(G);
  expect(row.meta.points).toBe(310); // what a later flush would credit
  await expectWalletUntouched(s);
});

test("hold=true, row exists (re-opened window): partial 40000 then the rest reduce the PENDING amount, wallet never moves, REFERRAL ends VOID", async () => {
  const s = await createCreditedReferralOrder({ expectStatus: "PENDING" });
  const id = s.order.id;

  await refundVia(s, "40000.00");
  const R1 = 4000000n;
  await expect.poll(async () => cents((await referral(id)).payout_amount), { timeout: 15_000, message: "PENDING amount reduced" }).toBe(pendingTwd(R1));
  expect(pendingTwd(R1)).toBe(600020n); // 10000.00 - floor(10000.00*40000/100005)=3999.80
  let row = await referral(id);
  expect(row.status).toBe("PENDING");
  expect(row.wallet_tx_id).toBeNull();
  expect(await clawedBackCents(id)).toBe(0n); // held rows move no points
  await expectWalletUntouched(s);
  expect((await getOrder(s.buyer.api, id)).status).toBe("DELIVERED");

  await refundVia(s, undefined, "the rest"); // full remaining 60005.00
  await expect.poll(async () => (await referral(id)).status, { timeout: 15_000 }).toBe("VOID");
  row = await referral(id);
  expect(row.wallet_tx_id).toBeNull();
  expect(await clawedBackCents(id)).toBe(0n);
  await expectWalletUntouched(s);
  await expect.poll(async () => (await getOrder(s.buyer.api, id)).status).toBe("REFUNDED");
});

test("hold=true, realistic order: refund completes BEFORE the 7-day hold ends, the commission is then created already reduced", async () => {
  const s = await createDeliveredReferralOrder();
  const id = s.order.id;
  expect(await commissionRowsOfOrder(id)).toHaveLength(0); // nothing yet: not past the 7-day hold
  await refundVia(s, "40000.00");
  const r = await makeOrderEligible(id); // SQL + SERVICE (see factory.makeOrderEligible)
  expect(r.marked).toBe(true);
  await expect.poll(async () => { const x = await commissionRowsOfOrder(id); return x.find((y) => y.type === "REFERRAL") ? cents(x.find((y) => y.type === "REFERRAL")!.payout_amount) : null; },
    { timeout: 20_000, message: "fresh row reduced to what is still owed" }).toBe(pendingTwd(4000000n));
  const row = await referral(id);
  expect(row.status).toBe("PENDING");
  await expectWalletUntouched(s);

  // SQL: the RMA window (7 days from delivery) closed when the hold ended; re-open it to refund the rest.
  await sql(`UPDATE orders SET delivered_at = now() - interval '1 day' WHERE id = $1`, [id]);
  await refundVia(s, undefined, "the rest");
  await expect.poll(async () => (await referral(id)).status, { timeout: 15_000 }).toBe("VOID");
  await expectWalletUntouched(s);
});

test("hold=true then released: after a partial refund the flush credits only the reduced amount; the rest of the refund debits it to 0", async () => {
  const s = await createCreditedReferralOrder({ expectStatus: "PENDING" });
  const id = s.order.id;
  await refundVia(s, "40000.00");
  await expect.poll(async () => cents((await referral(id)).payout_amount), { timeout: 15_000 }).toBe(pendingTwd(4000000n));

  setHold(false); // release: flush only works when hold is off
  try {
    const sa = await apiAs("SUPER_ADMIN");
    const flushed = await ok<any>(await sa.post("admin/mlm/commissions/flush-pending", {}));
    expect(flushed.flushed).toBeGreaterThanOrEqual(1);
    const row = await referral(id);
    expect(row.status).toBe("CREDITED");
    const expectedPts = pointsOf(pendingTwd(4000000n)); // 186.00x -> oracle
    expect(decimalToCents(String(row.meta.points))).toBe(expectedPts);
    expect((await walletOf(s.referrer.user)).availableCents).toBe(expectedPts);

    await refundVia(s, undefined, "the rest");
    await expect.poll(async () => (await referral(id)).status, { timeout: 15_000 }).toBe("VOID");
    await expect.poll(() => clawedBackCents(id), { timeout: 15_000 }).toBe(expectedPts); // exactly what was credited, never more
    const w = await walletOf(s.referrer.user);
    expect(w.availableCents).toBe(0n);
  } finally {
    setHold(true); // keep hold=true until afterAll restores false (all tests in this file assume the flipped state)
  }
});
