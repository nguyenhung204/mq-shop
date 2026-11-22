import { test, expect } from "@playwright/test";
import { ok, type Api } from "../support/api";
import {
  completeRmaAfterApproval, createSellerWithSku, createUser, deliverOrder, openRma, placeOrder, walletOf, type TestUser,
} from "../support/factory";
import { sql } from "../support/db";
import { staffApi, uiPage } from "../support/kit-flows-9-13";

/**
 * TEST-GUIDE C5: automatic dividend credit. SERIAL ONLY (switches global settings, writes settlements, credits wallets).
 * NOT RUN by the builder (lead decides when): typechecked only.
 *
 * Isolated quarter: the LATEST quarter <= 2026Q3 that has no settlement row yet (a settled quarter is final, so each run uses the next older
 * one). Choosing the latest keeps every quarter between it and today already settled, so the hourly job (minute :11, from the first quarter
 * on, while the switch is ON) can only touch our quarter. Slot rows are INSERTed with an expiry just after the quarter ends so the test
 * accounts hold 0 slots in every later quarter (other reports are not skewed). The switch is always put back to OFF and the first quarter
 * cleared in `finally`.
 *
 * SQL used (each also commented at its place): slot entries (the API refuses a locked quarter; the table is append-only so INSERT is allowed),
 * order dates (no time travel API), read-only oracle reads.
 */
test.describe.configure({ timeout: 300_000 });

const SWITCH = "dividendAutoCreditEnabled";
const FROM_Q = "dividendAutoCreditFromQuarter";

// ---- independent BigInt oracle -------------------------------------------------------------------------------------

/** "0.031" -> {n: 31n, d: 1000n} */
function frac(s: string): { n: bigint; d: bigint } {
  const [w, f = ""] = String(s).split(".");
  return { n: BigInt(w + f), d: 10n ** BigInt(f.length) };
}
/** points in hundredths = round-half-up(TWD * 100 * fx / peg) */
function pointsOracle(twd: bigint, fx: string, peg: string): bigint {
  const a = frac(fx), b = frac(peg);
  const num = twd * 100n * a.n * b.d;
  const den = a.d * b.n;
  return (2n * num + den) / (2n * den);
}
/** slots -> whole-TWD share = floor(pool_cents * slots / (total * 100)) */
const shareTwd = (poolCents: bigint, slots: bigint, total: bigint) => (poolCents * slots) / (total * 100n);
const cents2 = (c: bigint) => `${c / 100n}.${String(c % 100n).padStart(2, "0")}`;

function quarterOf(i: number, y: number): string { return `${y}Q${i}`; }
/** instant (UTC ms) at which Taipei quarter `key` starts, and ends (exclusive) */
function quarterBounds(key: string) {
  const y = Number(key.slice(0, 4)), q = Number(key.slice(5));
  const start = Date.UTC(y, (q - 1) * 3, 1) - 8 * 3600_000;
  const end = Date.UTC(q === 4 ? y + 1 : y, q === 4 ? 0 : q * 3, 1) - 8 * 3600_000;
  return { start, end };
}
const codeOf = (key: string) => Number(key.slice(0, 4)) * 10 + Number(key.slice(5));

async function pickQuarter(): Promise<string> {
  // latest quarter <= 2026Q3 without a settlement row
  let y = 2026, q = 3;
  for (;;) {
    const key = quarterOf(q, y);
    const [{ n }] = await sql<{ n: string }>(`SELECT COUNT(*)::text AS n FROM dividend_settlements WHERE quarter = $1`, [key]); // SQL: read
    if (n === "0") return key;
    q -= 1;
    if (q === 0) { q = 4; y -= 1; }
    if (y < 2020) throw new Error("no free quarter left for the dividend e2e (a settled quarter is final): reset the e2e database");
  }
}

/** The hourly dividend job runs at minute :11 (Asia/Taipei = same minutes as UTC): stay away from it while the switch is ON. */
async function avoidCron() {
  const m = new Date().getUTCMinutes();
  if (m >= 10 && m <= 12) await new Promise((r) => setTimeout(r, (13 - m) * 60_000 - new Date().getUTCSeconds() * 1000));
}

async function setting(sa: Api, key: string, value: number | boolean | null) {
  await ok(await sa.ctx.put(`admin/settings/${key}`, { data: { value, reason: "e2e dividend auto credit" }, headers: { "idempotency-key": crypto.randomUUID() } }));
}
async function settingValue(sa: Api, key: string) {
  const list = await ok<any>(await sa.get("admin/settings"));
  return list.items.find((x: any) => x.key === key)?.value;
}

const tx = async (userId: string) =>
  sql<{ id: string; amount: string; direction: string }>(`SELECT id, amount::text AS amount, direction FROM wallet_transactions WHERE user_id = $1 AND reason = 'DIVIDEND'`, [userId]); // SQL: read

test("dividend auto credit: off by default, needs the first quarter, pays each account its share once, frozen after settlement", async ({ browser }) => {
  const sa = await staffApi("SUPER_ADMIN");
  const me = await ok<any>(await sa.get("users/me"));
  const saId: string = (me.user ?? me).id;
  const QX = await pickQuarter();
  const { start, end } = quarterBounds(QX);

  try {
    // ---- preconditions (fail loudly: the oracle below assumes the defaults) -------------------------------------------------
    expect(await settingValue(sa, SWITCH), "switch starts OFF").toBe(false);
    expect(await settingValue(sa, FROM_Q), "first quarter starts empty").toBeNull();
    expect(await settingValue(sa, "taxEnabled"), "tax off (oracle has no tax)").toBe(false);
    const [rates] = await sql<{ n: string }>(`SELECT COUNT(*)::text AS n FROM dividend_rates WHERE effective_date <= $1::date`, [new Date(end - 1 + 8 * 3600_000).toISOString().slice(0, 10)]);
    expect(rates.n, "no dividend rate row in force => default 10%").toBe("0");
    const [ordersIn] = await sql<{ n: string }>(`SELECT COUNT(*)::text AS n FROM orders WHERE sales_eligible_at >= $1 AND sales_eligible_at < $2`, [new Date(start), new Date(end)]);
    expect(ordersIn.n, `no foreign order rewarded inside ${QX}`).toBe("0");
    const [fxRow] = await sql<{ rate: string; age_days: string }>(`SELECT rate::text AS rate, EXTRACT(EPOCH FROM (now() - effective_at)) / 86400 AS age_days FROM fx_rates WHERE quote_currency = 'USD' AND effective_at <= now() ORDER BY effective_at DESC LIMIT 1`);
    expect(Number(fxRow.age_days), "fx rate must be at most 7 days old or the snapshot is refused").toBeLessThan(7);
    const rep0 = await ok<any>(await sa.get(`admin/dividend/quarters/${QX}/report`));
    expect(rep0.locked, `${QX} is locked`).toBe(true);

    // ---- data: 3 delivered orders rewarded inside QX (bases 7000 + 3000 + 1000), 3 accounts with 3 / 5 / 7 slots -----------------
    const seller = await createSellerWithSku({ unitPrice: "1000.00", stock: 50, prefix: "divshop" });
    const accounts: Array<{ u: TestUser; slots: bigint }> = [];
    for (const slots of [3n, 5n, 7n]) {
      const u = await createUser({ prefix: "divacc" });
      await walletOf(u); // the account needs a wallet row (an account without one is skipped, by design)
      accounts.push({ u, slots });
    }
    const buyer = await createUser({ prefix: "divbuyer" });
    const orders: any[] = [];
    for (const qty of [7, 3, 1]) {
      const o = await placeOrder(buyer, seller, qty);
      await deliverOrder(seller, o.id);
      orders.push(o);
    }
    for (const [i, o] of orders.entries()) {
      // SQL: no time travel API. The reward date (sales_eligible_at) decides the quarter: put each order inside QX.
      await sql(`UPDATE orders SET sales_eligible_at = $2, delivered_at = now() - interval '1 day' WHERE id = $1`, [o.id, new Date(start + (10 + i) * 86_400_000)]);
    }
    for (const a of accounts) {
      // SQL: POST admin/dividend/slots refuses a locked quarter and the table is append-only (INSERT only). expires_at = just after the
      // quarter end, so these accounts count 0 slots in every later quarter.
      await sql(
        `INSERT INTO dividend_slot_entries (user_id, quarter, slots, expires_at, kind, reason, created_by) VALUES ($1, $2, $3, $4, 'SET', 'e2e dividend isolated quarter', $5)`,
        [a.u.id, QX, a.slots.toString(), new Date(end + 86_400_000), saId],
      );
    }

    // ---- oracle (independent: raw tables + BigInt) -----------------------------------------------------------------------------
    // Other specs left slot entries in older quarters that carry forward into QX, so the holders are NOT only our 3 accounts:
    // holders = per account the latest entry with quarter <= QX (then highest seq), not expired at the quarter end, slots > 0.
    const holderRows = await sql<{ user_id: string; slots: number }>(
      `SELECT user_id, slots FROM (SELECT DISTINCT ON (user_id) user_id, slots, expires_at FROM dividend_slot_entries WHERE quarter <= $1 ORDER BY user_id, quarter DESC, seq DESC) h
        WHERE slots > 0 AND (expires_at IS NULL OR expires_at > $2)`,
      [QX, new Date(end)],
    ); // SQL: read
    const baseCents = 1000n * 100n * (7n + 3n + 1n); // total - shipping per order, summed (no foreign order in QX, checked above)
    const poolCents = (baseCents * 1000n) / 10_000n; // 10%
    const total = holderRows.reduce((a, x) => a + BigInt(x.slots), 0n);
    const holders = holderRows.map((h) => ({ userId: h.user_id, slots: BigInt(h.slots), twd: shareTwd(poolCents, BigInt(h.slots), total) }));
    const remainderCents = poolCents - holders.reduce((a, x) => a + x.twd * 100n, 0n);
    expect(poolCents).toBe(110_000n);
    for (const a of accounts) expect(holders.find((h) => h.userId === a.u.id)?.slots).toBe(a.slots);
    const expected = accounts.map((a) => ({ ...a, twd: shareTwd(poolCents, a.slots, total) }));
    const rep = await ok<any>(await sa.get(`admin/dividend/quarters/${QX}/report`));
    expect(rep.totals.poolCents).toBe(Number(poolCents)); // the live report agrees with the hand calculation before anything is frozen

    const walletsBefore = await Promise.all(accounts.map((a) => walletOf(a.u)));
    const settlementUi = await uiPage(browser, { api: sa });
    const page = settlementUi.page;

    // ================= 1. default OFF: nothing is written =================
    await page.goto("/admin/dividend/settlements");
    await expect(page.getByText("Off: nothing is settled")).toBeVisible();
    for (const a of ["run"]) void a;
    const off = await sa.post(`admin/dividend/settlements/${QX}/run`, {});
    expect(off.status()).toBe(409);
    expect(await off.text()).toContain("DIVIDEND_AUTO_CREDIT_DISABLED");
    const noRows = async () => {
      const [s] = await sql<{ n: string }>(`SELECT COUNT(*)::text AS n FROM dividend_settlements WHERE quarter = $1`, [QX]);
      const [i] = await sql<{ n: string }>(`SELECT COUNT(*)::text AS n FROM dividend_settlement_items WHERE quarter = $1`, [QX]);
      return [s.n, i.n];
    };
    expect(await noRows()).toEqual(["0", "0"]);
    for (const a of accounts) expect(await tx(a.u.id)).toEqual([]);

    // ================= 2. switch ON but first quarter empty: still nothing =================
    await avoidCron();
    await setting(sa, SWITCH, true);
    await page.reload();
    await expect(page.getByText("Switch on but no first quarter: nothing is settled")).toBeVisible();
    const noFrom = await sa.post(`admin/dividend/settlements/${QX}/run`, {});
    expect(noFrom.status()).toBe(409);
    expect(await noFrom.text()).toContain("DIVIDEND_AUTO_CREDIT_FROM_REQUIRED");
    expect(await noRows()).toEqual(["0", "0"]);
    for (const a of accounts) expect(await tx(a.u.id)).toEqual([]);

    // a quarter BEFORE the first quarter is refused even when armed (checked once armed below)
    // ================= 3. first quarter = QX: run from the UI =================
    await setting(sa, FROM_Q, codeOf(QX));
    await page.reload();
    await expect(page.getByText("Armed: it will settle locked quarters from the first quarter on")).toBeVisible();
    const earlier = await sa.post(`admin/dividend/settlements/${quarterOf(Number(QX.slice(5)) === 1 ? 4 : Number(QX.slice(5)) - 1, Number(QX.slice(5)) === 1 ? Number(QX.slice(0, 4)) - 1 : Number(QX.slice(0, 4)))}/run`, {});
    expect(earlier.status()).toBe(409);
    expect(await earlier.text()).toContain("DIVIDEND_QUARTER_BEFORE_START");

    await page.getByRole("textbox", { name: "Quarter" }).fill(QX);
    await page.getByRole("button", { name: "Run now", exact: true }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Run now", exact: true }).click();
    const result = page.getByRole("status").filter({ hasText: "Credited" });
    await expect(result).toBeVisible({ timeout: 240_000 });
    // normally COMPLETED with 3 credited; if the hourly job got there first the run is ALREADY_COMPLETED (state checked below either way)
    await expect(result).toContainText(/Completed|Already completed/);

    // ---- the frozen snapshot, items and wallets vs the oracle -----------------------------------------------------------------
    const fetchDetail = async () => {
      let first: any = null;
      const items: any[] = [];
      for (let page = 1; ; page++) {
        const d = await ok<any>(await sa.get(`admin/dividend/settlements/${QX}?page=${page}&pageSize=100`));
        first ??= d.settlement;
        items.push(...d.items);
        if (d.items.length < 100) return { settlement: first, items };
      }
    };
    const det = await fetchDetail();
    const s = det.settlement;
    expect(s.status).toBe("COMPLETED");
    expect(BigInt(s.pool.cents)).toBe(poolCents);
    expect(BigInt(s.remainder.cents)).toBe(remainderCents);
    expect(s.totalSlots).toBe(Number(total));
    expect(s.itemCount).toBe(holders.length);
    expect(Number(s.fxRateTwdUsd)).toBe(Number(fxRow.rate)); // the latest fx row was frozen
    expect(Number(s.pointUsdValue)).toBeGreaterThan(0);
    expect(det.items).toHaveLength(holders.length);
    // every holder (ours and foreign): amount, points and status as the oracle says
    const mine = new Set(accounts.map((a) => a.u.id));
    let paid = 0n;
    for (const h of holders) {
      const item = det.items.find((x: any) => x.userId === h.userId);
      expect(item, `item of ${h.userId}`).toBeTruthy();
      expect(item.slots).toBe(Number(h.slots));
      expect(BigInt(item.amountTwd.cents)).toBe(h.twd * 100n);
      const pts = pointsOracle(h.twd, String(s.fxRateTwdUsd), String(s.pointUsdValue));
      expect(item.points).toBe(cents2(pts));
      const [u] = await sql<{ status: string; has_wallet: boolean }>(`SELECT u.status, EXISTS (SELECT 1 FROM wallets w WHERE w.user_id = u.id) AS has_wallet FROM users u WHERE u.id = $1`, [h.userId]); // SQL: read
      const payable = pts > 0n && h.twd > 0n && !!u && u.status !== "DELETED" && u.status !== "PENDING_ACTIVATION" && u.has_wallet;
      const want = h.twd === 0n || pts === 0n ? "SKIPPED_ZERO" : payable ? "CREDITED" : "SKIPPED_NO_WALLET";
      expect(item.status, `status of ${h.userId}`).toBe(want);
      if (want === "CREDITED") paid += h.twd * 100n;
    }
    for (const [i, a] of expected.entries()) {
      const item = det.items.find((x: any) => x.userId === a.u.id);
      const pts = pointsOracle(a.twd, String(s.fxRateTwdUsd), String(s.pointUsdValue));
      expect(item.status).toBe("CREDITED");
      expect(item.walletTxId).toBeTruthy();
      const rows = await tx(a.u.id);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ id: item.walletTxId, direction: "IN" });
      expect(BigInt(Math.round(Number(rows[0].amount) * 100))).toBe(pts);
      expect((await walletOf(a.u)).availableCents).toBe(walletsBefore[i].availableCents + pts);
    }
    void mine;
    expect(BigInt(s.paidTotal.cents)).toBe(paid);
    // items + remainder = pool (unpayable shares are kept by the company, so pool = paid + remainder + unpaid)
    expect(holders.reduce((a, x) => a + x.twd * 100n, 0n) + BigInt(s.remainder.cents)).toBe(poolCents);

    // ---- the owner sees the line and the points in the UI --------------------------------------------------------------------
    for (const [i, a] of expected.entries()) {
      const ownerUi = await uiPage(browser, a.u);
      await ownerUi.page.goto("/dividend-credits");
      const row = ownerUi.page.locator("tbody tr").first();
      await expect(row).toContainText(`${QX.slice(0, 4)} Q${QX.slice(5)}`);
      await expect(row).toContainText(cents2(pointsOracle(a.twd, String(s.fxRateTwdUsd), String(s.pointUsdValue))));
      await expect(row).toContainText("Credited");
      await ownerUi.context.close();
      void i;
    }
    // the admin list shows the quarter completed
    await page.goto("/admin/dividend/settlements");
    await expect(page.locator("tbody tr", { hasText: `${QX.slice(0, 4)} Q${QX.slice(5)}` })).toContainText("Completed");

    // ================= 4. second run pays nobody again =================
    const walletsAfter = await Promise.all(accounts.map((a) => walletOf(a.u)));
    const again = await ok<any>(await sa.post(`admin/dividend/settlements/${QX}/run`, {}));
    expect(again.outcome).toBe("ALREADY_COMPLETED");
    expect(again.credited).toBe(0);
    for (const [i, a] of accounts.entries()) {
      expect(await tx(a.u.id)).toHaveLength(1);
      expect((await walletOf(a.u)).availableCents).toBe(walletsAfter[i].availableCents);
    }

    // ================= 5. changes after the snapshot do not move the frozen numbers =================
    // a partial refund of order #3 completes NOW (after the quarter locked); slot edits of the locked quarter are refused
    const rma = await openRma(buyer, orders[2].id, "partial refund after settlement");
    await ok(await seller.user.api.post(`rma/${rma.id}/approve`, { refundAmount: "500.00" }));
    await completeRmaAfterApproval(buyer, seller.user.api, rma.id);
    const edit = await sa.post("admin/dividend/slots", { userId: accounts[0].u.id, slots: 99, quarter: QX, reason: "e2e edit after lock" });
    expect(edit.status()).toBeGreaterThanOrEqual(400);
    expect(await edit.text()).toContain("DIVIDEND_QUARTER_LOCKED");

    const rep2 = await ok<any>(await sa.get(`admin/dividend/quarters/${QX}/report`));
    expect(rep2.totals.poolCents).toBe(Number(poolCents)); // the locked report ignores refunds completed after the lock
    expect(rep2.refundsAfterLock.refundCents).toBe(50_000);
    expect(rep2.refundsAfterLock.appliedToPool).toBe(false);
    const det2 = await fetchDetail();
    expect(det2.settlement.reportHash).toBe(s.reportHash);
    expect(det2.items.map((x: any) => [x.userId, x.amountTwd.cents, x.points, x.status, x.walletTxId]).sort()).toEqual(
      det.items.map((x: any) => [x.userId, x.amountTwd.cents, x.points, x.status, x.walletTxId]).sort(),
    );
    const again2 = await ok<any>(await sa.post(`admin/dividend/settlements/${QX}/run`, {}));
    expect(again2.credited).toBe(0);
    for (const a of accounts) expect(await tx(a.u.id)).toHaveLength(1);

    // the export (flow 11) carries the same lines
    const csv = await sa.get(`admin/accounting-export/dividend-settlements?quarter=${QX}`);
    const text = await csv.text();
    expect(text).toContain(`TOTAL ITEMS rows=${holders.length}`);
    expect(text).toContain(`TOTAL REMAINDER settlements=1,,,,,${cents2(remainderCents)}`);
    await settlementUi.context.close();
  } finally {
    // always back to the safe default: switch OFF, first quarter cleared (the settled quarter stays: it is final by design)
    await setting(sa, SWITCH, false).catch(() => undefined);
    await setting(sa, FROM_Q, null).catch(() => undefined);
    const restored = [await settingValue(sa, SWITCH), await settingValue(sa, FROM_Q)];
    expect(restored).toEqual([false, null]);
  }
});
