import { expect, test, type Page } from "@playwright/test";
import { apiAs, ok } from "../support/api";
import { createSellerWithSku, createUser, type TestSeller, type TestUser } from "../support/factory";
import {
  claimQuarter,
  deliveredOrderIn,
  dividendOracle,
  errOf,
  orderRowsRewardedIn,
  pageAs,
  quarterAfter,
  quarterStart,
  seedSlots,
  type QuarterClaim,
} from "../support/admin-flows";

/**
 * Flow 6 (report part): quarter report numbers, lock and the client's worked examples.
 * Data lives in an ISOLATED PAST quarter (claimQuarter): past quarters are locked because dividendEditWindowDays is unset,
 * and no rate rows can exist for them (default 10%). Slot rows and the order reward date are seeded with SQL (documented in
 * support/admin-flows.ts); orders themselves are real (checkout + delivery). Everything is cleaned in `finally`.
 * Global settings are only READ (taxEnabled must be off, which is its default), so this file runs in the parallel project;
 * the tests share the quarter pool and therefore run one after the other.
 */
test.describe.configure({ mode: "serial", timeout: 180_000 }); // factory setup is slow when other agents load the shared backend

const HOLD = "e2e dividend holder";
const nf = new Intl.NumberFormat("en-US");
const twd2 = (cents: bigint) => `${nf.format(cents / 100n)}.${String(cents % 100n).padStart(2, "0")} TWD`;
const whole = (n: bigint) => `${nf.format(n)} TWD`;

interface World {
  claim: QuarterClaim;
  q: string;
  holders: TestUser[];
  seller: TestSeller;
  buyer: TestUser;
}

async function build(unitPrice: string, versions: number[][]): Promise<World> {
  const claim = await claimQuarter();
  try {
    const seller = await createSellerWithSku({ unitPrice, prefix: "divseller" });
    const buyer = await createUser({ prefix: "divbuyer" });
    const holders: TestUser[] = [];
    for (let i = 0; i < versions.length; i++) holders.push(await createUser({ prefix: "divholder", fullName: `${HOLD} ${i}` }));
    claim.track({ userIds: holders.map((h) => h.id) });
    await seedSlots(claim.quarter, holders.map((h, i) => ({ userId: h.id, versions: versions[i] })));
    return { claim, q: claim.quarter, holders, seller, buyer };
  } catch (e) {
    await claim.release();
    throw e;
  }
}

async function reportOf(q: string): Promise<any> {
  const sa = await apiAs("SUPER_ADMIN");
  return ok<any>(await sa.get(`admin/dividend/quarters/${q}/report`));
}

/** Compare a report with the independent oracle and the invariants. */
async function expectReportMatchesOracle(w: World, orderIds: string[], holderSlots: bigint[]) {
  const rep = await reportOf(w.q);
  expect(rep.tax.applied, "taxEnabled must be off (default) while the parallel project runs").toBe(false);
  const orders = await orderRowsRewardedIn(quarterStart(w.q), quarterStart(quarterAfter(w.q)));
  expect(orders.length).toBe(orderIds.length);
  const o = dividendOracle({
    orders,
    rateBps: 1000n,
    taxBps: 0n,
    holders: w.holders.map((h, i) => ({ key: h.id, slots: holderSlots[i] })),
  });
  expect(rep.locked).toBe(true);
  expect(rep.closed).toBe(true);
  expect(rep.byRateInterval).toHaveLength(1);
  expect(rep.byRateInterval[0].rateBps).toBe(1000);
  expect(rep.byRateInterval[0].isDefaultRate).toBe(true);
  expect(BigInt(rep.totals.salesBaseCents)).toBe(o.base);
  expect(BigInt(rep.totals.orderCount)).toBe(BigInt(orders.length));
  expect(BigInt(rep.totals.rawPoolCents)).toBe(o.rawPool);
  expect(BigInt(rep.totals.poolCents)).toBe(o.pool);
  expect(BigInt(rep.totals.totalSlots)).toBe(o.totalSlots);
  expect(rep.remainder.label).toBe("khoản thu từ tính toán chênh lệch");
  expect(BigInt(rep.remainder.cents)).toBe(o.remainder);
  const got = new Map<string, bigint>(rep.byAccount.map((a: any) => [a.userId, BigInt(a.shareNtd)]));
  let sum = 0n;
  for (const h of w.holders) {
    if (holderSlots[w.holders.indexOf(h)] === 0n) continue;
    expect(got.get(h.id), `share of ${h.email}`).toBe(o.shares.get(h.id));
    sum += got.get(h.id)!;
  }
  expect(sum * 100n + BigInt(rep.remainder.cents)).toBe(BigInt(rep.totals.poolCents)); // INV: shares + remainder = fund
  return { rep, o };
}

test.describe("06 dividend report", () => {
  test("1,000,000 x 10% = 100,000 and 5 of 100 slots = 5,000", async () => {
    const w = await build("1000000.00", [[5], [95]]);
    try {
      const ord = await deliveredOrderIn(w.q, w.claim, w.buyer, w.seller);
      expect(ord.totalCents - ord.shippingCents).toBe(100_000_000n); // base exactly 1,000,000.00
      const { rep } = await expectReportMatchesOracle(w, [ord.id], [5n, 95n]);
      expect(rep.totals.poolCents).toBe(10_000_000); // 100,000.00
      const share = new Map<string, number>(rep.byAccount.map((a: any) => [a.userId, a.shareNtd]));
      expect(share.get(w.holders[0].id)).toBe(5000);
      expect(share.get(w.holders[1].id)).toBe(95000);
      expect(rep.remainder.cents).toBe(0);
    } finally {
      await w.claim.release();
    }
  });

  test("a quarter nobody holds slots in has a fund of 0", async () => {
    const w = await build("2000.00", []);
    try {
      const ord = await deliveredOrderIn(w.q, w.claim, w.buyer, w.seller);
      const rep = await reportOf(w.q);
      expect(rep.totals.totalSlots).toBe(0);
      expect(rep.totals.poolCents).toBe(0);
      expect(rep.byAccount).toEqual([]);
      expect(rep.remainder.cents).toBe(0);
      expect(BigInt(rep.totals.salesBaseCents)).toBe(ord.totalCents - ord.shippingCents); // sales exist, but nothing is distributed
      expect(BigInt(rep.totals.rawPoolCents)).toBe(((ord.totalCents - ord.shippingCents) * 1000n) / 10000n);
    } finally {
      await w.claim.release();
    }
  });

  test("slots raised from 1 to 3 inside the quarter count as 3; 7 + 3 of 10 with remainder 1.57 (client example)", async () => {
    // base 14285.71 = floor(15000 x 10000 / 10500): the client's 15,000 TWD with 5% tax, with the tax step already applied
    // (a LOCKED quarter reads the tax settings as of its lock instant, which is before taxEnabled ever existed: see 07-tax).
    const w = await build("14285.71", [[1, 3], [7]]);
    try {
      const ord = await deliveredOrderIn(w.q, w.claim, w.buyer, w.seller);
      expect(ord.totalCents - ord.shippingCents).toBe(1_428_571n);
      const { rep } = await expectReportMatchesOracle(w, [ord.id], [3n, 7n]);
      expect(rep.totals.poolCents).toBe(142_857); // 1,428.57
      const share = new Map<string, number>(rep.byAccount.map((a: any) => [a.userId, a.shareNtd]));
      expect(share.get(w.holders[1].id)).toBe(999); // 7/10 (parent)
      expect(share.get(w.holders[0].id)).toBe(428); // 3/10, not 1/8: the end-of-quarter count wins
      expect(rep.remainder.cents).toBe(157); // 1.57
      expect(rep.remainder.amount).toBe("1.57");

      // locked quarter: every write is refused by the API
      const sa = await apiAs("SUPER_ADMIN");
      const set = await errOf(await sa.post("admin/dividend/slots", { userId: w.holders[0].id, slots: 4, quarter: w.q, reason: "locked quarter attempt" }));
      expect([set.status, set.code]).toEqual([409, "DIVIDEND_QUARTER_LOCKED"]);
      const tr = await errOf(
        await sa.post("admin/dividend/slots/transfer", { fromUserId: w.holders[1].id, toUserId: w.holders[0].id, slots: 1, quarter: w.q, reason: "locked quarter attempt" }),
      );
      expect([tr.status, tr.code]).toEqual([409, "DIVIDEND_QUARTER_LOCKED"]);
      const after = await reportOf(w.q);
      expect(after.byAccount).toEqual(rep.byAccount);
    } finally {
      await w.claim.release();
    }
  });

  test("UI: the report shows fund, shares, remainder line and the locked flag; the slots page of that quarter is read-only", async ({ browser }) => {
    const w = await build("14285.71", [[3], [7]]);
    const sa = await apiAs("SUPER_ADMIN");
    const { page, context } = await pageAs(browser, { api: sa });
    try {
      await deliveredOrderIn(w.q, w.claim, w.buyer, w.seller);
      await page.goto("/admin/dividend/report");
      await page.getByLabel("Quarter").selectOption(w.q);
      await expect(page.getByText("Locked (read-only)")).toBeVisible();
      await expect(page.getByText(twd2(142_857n), { exact: true }).first()).toBeVisible(); // pool
      await expect(page.getByText(twd2(1_428_571n), { exact: true }).first()).toBeVisible(); // sales base
      const row = (email: string) => page.getByRole("row").filter({ hasText: email });
      await expect(row(w.holders[1].email)).toContainText("999 TWD");
      await expect(row(w.holders[0].email)).toContainText("428 TWD");
      await expect(page.locator('[data-row="remainder"]')).toContainText("Income from difference calculation");
      await expect(page.locator('[data-row="remainder"]')).toContainText(twd2(157n));
      await expect(page.getByText(whole(1427n))).toBeVisible(); // distributed: 999 + 428

      // slots page: locked badge, no per-row edit button, every input of both forms disabled
      await page.goto("/admin/dividend/slots");
      await page.getByLabel("Quarter").selectOption(w.q);
      await expect(page.getByText("Locked", { exact: true })).toBeVisible();
      await expect(page.getByText(`${w.q} is locked. It is read-only and cannot be changed.`)).toHaveCount(2);
      await expect(page.getByRole("button", { name: "Set slots" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Save slots" })).toBeDisabled();
      await expect(page.getByRole("button", { name: "Transfer slots" })).toBeDisabled();
      await expect(page.getByLabel("Slots (total)")).toBeDisabled();
      await expect(page.getByLabel("Slots to move")).toBeDisabled();
      await expect(page.getByLabel("Expires at (optional, Taipei time)")).toBeDisabled();
      await expectAllDisabled(page.locator("form").filter({ hasText: "Save slots" }));
      await expectAllDisabled(page.locator("form").filter({ hasText: "Transfer slots" }));
    } finally {
      await context.close();
      await w.claim.release();
    }
  });

  test("slots page: ADMIN sees the write forms (MANAGE_DIVIDEND_SLOTS), ACCOUNTANT only reads", async ({ browser }) => {
    const admin = await pageAs(browser, { api: await apiAs("ADMIN") });
    try {
      await admin.page.goto("/admin/dividend/slots");
      await expect(admin.page.getByText("Only an Admin or a Super Admin can set and transfer slots.")).toHaveCount(0);
      await expect(admin.page.getByRole("button", { name: "Save slots" })).toBeVisible();
      await expect(admin.page.getByRole("button", { name: "Transfer slots" })).toBeVisible();
    } finally {
      await admin.context.close();
    }
    const acct = await pageAs(browser, { api: await apiAs("ACCOUNTANT") });
    try {
      await acct.page.goto("/admin/dividend/slots");
      await expect(acct.page.getByText("You can view this page. Only an Admin or a Super Admin can set and transfer slots.")).toBeVisible();
      await expect(acct.page.getByRole("button", { name: "Save slots" })).toHaveCount(0);
      await expect(acct.page.getByRole("button", { name: "Transfer slots" })).toHaveCount(0);
    } finally {
      await acct.context.close();
    }
  });
});

async function expectAllDisabled(form: ReturnType<Page["locator"]>) {
  for (const el of await form.locator('input:not([aria-hidden="true"]), textarea, select, button').all()) await expect(el).toBeDisabled();
}
