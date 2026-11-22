import { expect, test } from "@playwright/test";
import { apiAs, ok, type Api } from "../support/api";
import { createSellerWithSku, createUser, deliverOrder, placeOrder } from "../support/factory";
import { sql } from "../support/db";
import {
  claimQuarter,
  deliveredOrderIn,
  dividendOracle,
  orderRowsRewardedIn,
  putSetting,
  quarterAfter,
  quarterStart,
  seedSlots,
  settingOf,
  type OracleOrder,
} from "../support/admin-flows";

/**
 * Flow 7 (SERIAL): tax in the dividend report. taxEnabled / taxRatePercent are GLOBAL, so this file only runs in the serial project.
 * Originals are read first and restored in `finally` (history rows of the restore stay, the history is append-only).
 *
 * 7a  open (current) quarter: tax block + per-order floor(base x 10000 / (10000 + bps)), against an independent BigInt oracle fed by
 *     read-only SQL over the DELIVERED orders rewarded in that quarter.
 * 7b  LOCKED quarter: a tax change after the lock does not change the report (the lock instant's settings are used).
 *     NOTE: a locked quarter reads the tax settings as of its lock instant; every past quarter locked before taxEnabled ever existed,
 *     so it can never apply tax. The client's "15,000 TWD, 5% tax" example (pool 1,428.57) is therefore only reachable in the OPEN
 *     quarter (7a, own 15,000-base order below) or via the tax-excluded base 14,285.71 in 06-dividend-report.spec.ts.
 */
async function reportOf(sa: Api, q: string) {
  return ok<any>(await sa.get(`admin/dividend/quarters/${q}/report`));
}

async function restoreTax(sa: Api, orig: { enabled: any; rate: any }) {
  const e = await settingOf(sa, "taxEnabled");
  if (e.value !== orig.enabled) await putSetting(sa, "taxEnabled", orig.enabled, "e2e restore");
  const r = await settingOf(sa, "taxRatePercent");
  if (r.value !== orig.rate) await putSetting(sa, "taxRatePercent", orig.rate, "e2e restore");
}

test.describe("07 tax", () => {
  test.describe.configure({ timeout: 240_000 });

  test("open quarter: tax block and per-order floor(base x 10000 / 10500) match an independent oracle; restored afterwards", async () => {
    const sa = await apiAs("SUPER_ADMIN");
    const orig = { enabled: (await settingOf(sa, "taxEnabled")).value, rate: (await settingOf(sa, "taxRatePercent")).value };
    const q: string = (await ok<any>(await sa.get("admin/dividend/slots"))).quarter; // the current (open) quarter
    const from = quarterStart(q);
    const to = quarterStart(quarterAfter(q));
    const seller = await createSellerWithSku({ unitPrice: "15000.00", prefix: "taxseller" });
    const buyer = await createUser({ prefix: "taxbuyer" });
    let ownId = "";
    try {
      const order = await placeOrder(buyer, seller);
      ownId = order.id;
      await deliverOrder(seller, order.id);
      // SQL: reward date (normally set 7 days after delivery by an hourly job) -> inside the open quarter, now.
      await sql(`UPDATE orders SET sales_eligible_at = now() WHERE id = $1`, [order.id]);
      const own = (await sql<{ t: string; s: string }>(`SELECT ROUND(total*100)::bigint::text t, ROUND(shipping_fee*100)::bigint::text s FROM orders WHERE id = $1`, [order.id]))[0];
      const ownOrder: OracleOrder = { totalCents: BigInt(own.t), shippingCents: BigInt(own.s) };
      expect(ownOrder.totalCents - ownOrder.shippingCents).toBe(1_500_000n); // base 15,000.00
      expect(dividendOracle({ orders: [ownOrder], rateBps: 1000n, taxBps: 500n, holders: [] }).base).toBe(1_428_571n); // floor(1500000 x 10000 / 10500)

      for (const [rate, bps] of [[5, 500n], [5.25, 525n]] as const) {
        await putSetting(sa, "taxRatePercent", rate, `e2e tax ${rate}`);
        await ok(await putSetting(sa, "taxEnabled", true, "e2e tax on"));
        // other tests may add orders while we read: accept only when the ground truth is the same before and after the report
        let rep: any;
        let orders: OracleOrder[] = [];
        await expect
          .poll(async () => {
            const a = await orderRowsRewardedIn(from, to);
            rep = await reportOf(sa, q);
            const b = await orderRowsRewardedIn(from, to);
            orders = a;
            return JSON.stringify(a, (_k, v) => (typeof v === "bigint" ? v.toString() : v)) === JSON.stringify(b, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
          })
          .toBe(true);
        expect(rep.locked).toBe(false);
        const o = dividendOracle({ orders, rateBps: 1000n, taxBps: bps, holders: [] });
        expect(rep.tax).toEqual({ applied: true, rateBps: Number(bps), ratePercent: Number(bps) / 100 });
        expect(BigInt(rep.totals.salesBaseBeforeTaxCents)).toBe(o.beforeTax);
        expect(BigInt(rep.totals.salesBaseCents)).toBe(o.base);
        expect(BigInt(rep.totals.taxExcludedCents)).toBe(o.taxExcluded);
        expect(o.taxExcluded).toBeGreaterThan(0n);
        expect(BigInt(rep.totals.orderCount)).toBe(BigInt(orders.length));
      }

      // switching tax off again: the base is the plain base (no tax block applied)
      await ok(await putSetting(sa, "taxEnabled", false, "e2e tax off"));
      const off = await reportOf(sa, q);
      expect(off.tax.applied).toBe(false);
      expect(off.totals.taxExcludedCents).toBe(0);
      expect(off.totals.salesBaseCents).toBe(off.totals.salesBaseBeforeTaxCents);
    } finally {
      await restoreTax(sa, orig);
      if (ownId) await sql(`UPDATE orders SET status = 'CANCELLED' WHERE id = $1`, [ownId]); // SQL: take the own order out of the shared quarter again
    }
    expect((await settingOf(sa, "taxEnabled")).value).toBe(orig.enabled);
    expect((await settingOf(sa, "taxRatePercent")).value).toBe(orig.rate);
  });

  test("a tax change after the quarter is locked does not change the locked quarter", async () => {
    const sa = await apiAs("SUPER_ADMIN");
    const orig = { enabled: (await settingOf(sa, "taxEnabled")).value, rate: (await settingOf(sa, "taxRatePercent")).value };
    const claim = await claimQuarter();
    try {
      const seller = await createSellerWithSku({ unitPrice: "15000.00", prefix: "taxlock" });
      const buyer = await createUser({ prefix: "taxlockbuyer" });
      const parent = await createUser({ prefix: "taxparent" });
      const child = await createUser({ prefix: "taxchild" });
      claim.track({ userIds: [parent.id, child.id] });
      await seedSlots(claim.quarter, [{ userId: parent.id, versions: [7] }, { userId: child.id, versions: [3] }]);
      await deliveredOrderIn(claim.quarter, claim, buyer, seller);
      const before = await reportOf(sa, claim.quarter);
      expect(before.locked).toBe(true);
      expect(before.tax.applied).toBe(false);
      // no tax: pool = 10% of 15,000.00 = 1,500.00; 7/10 = 1,050, 3/10 = 450, remainder 0
      expect(before.totals.poolCents).toBe(150_000);

      await putSetting(sa, "taxRatePercent", 5, "e2e tax after lock");
      await ok(await putSetting(sa, "taxEnabled", true, "e2e tax after lock"));
      const during = await reportOf(sa, claim.quarter);
      expect(during).toEqual(before); // identical: the locked quarter keeps its own tax settings

      await ok(await putSetting(sa, "taxEnabled", false, "e2e tax off after lock"));
      expect(await reportOf(sa, claim.quarter)).toEqual(before);
    } finally {
      await restoreTax(sa, orig);
      await claim.release();
    }
    expect((await settingOf(sa, "taxEnabled")).value).toBe(orig.enabled);
    expect((await settingOf(sa, "taxRatePercent")).value).toBe(orig.rate);
  });
});
