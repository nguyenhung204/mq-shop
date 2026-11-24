import { expect, test } from "@playwright/test";
import { apiAs, ok } from "../support/api";
import { createUser, uniq, type TestUser } from "../support/factory";
import { errOf, expectDbRejects, pageAs } from "../support/admin-flows";

/**
 * Flow 6 (SERIAL part): dividend rates and slot allocations, which are GLOBAL (the current quarter's holdings and the rate table
 * are shared by every report).
 *
 * PERMANENT SIDE EFFECT: dividend_rates is append-only (trigger), so the rate rows written here can never be removed. To leave the
 * effective rate at 10% the test adds a 12% row for tomorrow and then a 10% row for the SAME day (a later row for the same date
 * replaces the earlier one, status "superseded"). Each run adds two rows for a new "tomorrow"; the rate interval list of the
 * current quarter therefore splits at that date (same 10%, different row id).
 * Slots of the accounts created here are set back to 0 in `finally` (history rows stay).
 */
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

test.describe("06 dividend rates", () => {
  test("default 10%; 12% from tomorrow accepted; yesterday refused; no edit/delete (UI, API, trigger)", async ({ browser }) => {
    test.setTimeout(120_000);
    const sa = await apiAs("SUPER_ADMIN");
    const info = await ok<any>(await sa.get("admin/dividend/rates"));
    expect(info.default.ratePercent).toBe(10);
    const tomorrow = addDays(info.today, 1);
    const yesterday = addDays(info.today, -1);

    // ---- API validation, nothing is stored
    const before = (await ok<any>(await sa.get("admin/dividend/rates"))).items.length;
    const past = await errOf(await sa.post("admin/dividend/rates", { ratePercent: 12, effectiveDate: yesterday, reason: "yesterday attempt" }));
    expect(past.status).toBe(400);
    expect(past.code).toBe("DIVIDEND_INPUT_INVALID");
    for (const bad of [101, -1, 12.345]) {
      expect((await errOf(await sa.post("admin/dividend/rates", { ratePercent: bad, effectiveDate: tomorrow, reason: "bad rate attempt" }))).status, String(bad)).toBe(400);
    }
    expect((await errOf(await sa.post("admin/dividend/rates", { ratePercent: 12, effectiveDate: tomorrow, reason: "ab" }))).status).toBe(400);
    expect((await ok<any>(await sa.get("admin/dividend/rates"))).items.length).toBe(before);

    // ---- UI: yesterday is blocked in the form, tomorrow is accepted
    const tomorrowReason = uniq("UI rate");
    const { page, context } = await pageAs(browser, { api: sa });
    try {
      await page.goto("/admin/dividend/rates");
      await expect(page.getByText("Default rate (used when no row applies)")).toBeVisible();
      await expect(page.getByText("10.00%", { exact: true }).first()).toBeVisible();
      await page.getByLabel("Rate (%)").fill("12");
      await page.getByLabel("Effective date (Taipei time)").fill(yesterday);
      await page.getByLabel("Reason").fill("UI yesterday attempt");
      await page.getByRole("button", { name: "Save rate" }).click();
      await expect(page.locator("ul[role=alert]")).toContainText("The effective date cannot be before today (Taipei time).");
      expect((await ok<any>(await sa.get("admin/dividend/rates"))).items.length).toBe(before);

      await page.getByLabel("Effective date (Taipei time)").fill(tomorrow);
      await page.getByLabel("Reason").fill(tomorrowReason);
      const created = page.waitForResponse((r) => r.url().includes("/admin/dividend/rates") && r.request().method() === "POST");
      await page.getByRole("button", { name: "Save rate" }).click();
      expect((await created).status()).toBe(201);
      const row12 = page.getByRole("row").filter({ hasText: tomorrow }).filter({ hasText: tomorrowReason });
      await expect(row12).toContainText("12.00%");
      await expect(row12).toContainText("Upcoming");

      // ---- no edit / delete anywhere in the history table
      await expect(page.getByRole("table").getByRole("button")).toHaveCount(0);
    } finally {
      await context.close();
    }

    // ---- put the effective rate back to 10% for that day (permanent extra row, see header)
    await ok(await sa.post("admin/dividend/rates", { ratePercent: 10, effectiveDate: tomorrow, reason: "e2e: back to 10% for the same day" }));
    const list = await ok<any>(await sa.get("admin/dividend/rates"));
    const tomorrows = (list.items as any[]).filter((r) => r.effectiveDate === tomorrow);
    // earlier runs of this test leave their own pairs for the same date: only the newest row of a date is live
    const upcoming = tomorrows.filter((r) => r.status === "upcoming");
    expect(upcoming.map((r) => r.ratePercent)).toEqual([10]);
    expect(tomorrows.filter((r) => r.ratePercent === 12).every((r) => r.status === "superseded")).toBe(true);
    expect(tomorrows.some((r) => r.ratePercent === 12)).toBe(true);
    expect(list.current.ratePercent).toBe(10);

    // ---- immutable: no API routes, DB trigger rejects UPDATE / DELETE of a real row
    const id = tomorrows[0].id;
    for (const m of ["put", "patch"] as const) {
      expect([404, 405], m).toContain((await sa[m](`admin/dividend/rates/${id}`, { ratePercent: 1 })).status());
    }
    expect([404, 405]).toContain((await sa.delete(`admin/dividend/rates/${id}`)).status());
    expect(await expectDbRejects(`UPDATE dividend_rates SET rate_bps = 1 WHERE id = $1`, [id])).toMatch(/append-only/);
    expect(await expectDbRejects(`DELETE FROM dividend_rates WHERE id = $1`, [id])).toMatch(/append-only/);
  });

  test("ADMIN only reads rates: no form in the UI, POST is 403", async ({ browser }) => {
    const admin = await apiAs("ADMIN");
    expect((await admin.get("admin/dividend/rates")).status()).toBe(200);
    const info = await ok<any>(await admin.get("admin/dividend/rates"));
    expect((await admin.post("admin/dividend/rates", { ratePercent: 12, effectiveDate: addDays(info.today, 1), reason: "admin attempt" })).status()).toBe(403);
    const { page, context } = await pageAs(browser, { api: admin });
    try {
      await page.goto("/admin/dividend/rates");
      await expect(page.getByText("You can view this page. Only a Super Admin can make changes.")).toBeVisible();
      await expect(page.getByRole("button", { name: "Save rate" })).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});

test.describe("06 dividend slots (current quarter)", () => {
  test("grant, 100 cap (101 refused), 1 -> 3, expiry, linked transfer legs", async ({ browser }) => {
    test.setTimeout(180_000);
    const sa = await apiAs("SUPER_ADMIN");
    const users: TestUser[] = [];
    const mk = async (p: string) => { const u = await createUser({ prefix: p }); users.push(u); return u; };
    const view = async () => ok<any>(await sa.get("admin/dividend/slots"));
    const heldBy = async (u: TestUser) => ((await view()).items as any[]).find((h) => h.userId === u.id);
    const set = (u: TestUser, slots: number, extra: Record<string, unknown> = {}) =>
      sa.post("admin/dividend/slots", { userId: u.id, slots, reason: "e2e slots", ...extra });
    const start = await view();
    const q: string = start.quarter;
    expect(start.locked).toBe(false);
    const cap: number = start.caps.maxSlotsPerAccount;
    expect(cap, "maxSlotsPerAccount default is 100").toBe(100);
    const { page, context } = await pageAs(browser, { api: sa });
    try {
      const grantee = await mk("slotgrant");
      const capped = await mk("slotcap");
      const riser = await mk("slotrise");
      const fromU = await mk("slotfrom");
      const toU = await mk("slotto");

      // ---- grant with an expiry after the quarter end: counts; reason bounds
      const farFuture = new Date(Date.now() + 400 * 86_400_000).toISOString();
      expect((await errOf(await set(grantee, 5, { reason: "ab" }))).status).toBe(400);
      const g = await ok<any>(await set(grantee, 5, { expiresAt: farFuture }));
      expect(g.slots).toBe(5);
      expect(g.expiresAt).toBe(farFuture);
      expect((await heldBy(grantee)).slots).toBe(5);
      // expiry on or before the quarter end is refused: such slots would count 0 at quarter end (and slip past the cap); nothing stored
      const soon = new Date(Date.now() + 2 * 86_400_000).toISOString();
      const early = await errOf(await set(grantee, 5, { expiresAt: soon }));
      expect([early.status, early.code]).toEqual([400, "DIVIDEND_INPUT_INVALID"]);
      const unchanged = await heldBy(grantee);
      expect(unchanged.slots).toBe(5);
      expect(unchanged.expiresAt).toBe(farFuture);
      // expiring slots cannot be transferred
      const tr0 = await errOf(await sa.post("admin/dividend/slots/transfer", { fromUserId: grantee.id, toUserId: toU.id, slots: 1, reason: "expiring" }));
      expect([tr0.status, tr0.code]).toEqual([409, "DIVIDEND_SLOT_INSUFFICIENT"]);

      // ---- cap: 100 allowed, 101 refused (API and UI), nothing stored by the refusal
      await ok(await set(capped, 100));
      const over = await errOf(await set(capped, 101));
      expect([over.status, over.code]).toEqual([409, "DIVIDEND_SLOT_CAP_EXCEEDED"]);
      expect((await heldBy(capped)).slots).toBe(100);
      await page.goto("/admin/dividend/slots");
      const row = page.getByRole("row").filter({ hasText: capped.email });
      await row.getByRole("button", { name: "Set slots" }).click();
      await page.getByLabel("Slots (total)").fill("101");
      await page.locator("form").filter({ hasText: "Save slots" }).getByLabel("Reason").fill("UI over the cap");
      const refused = page.waitForResponse((r) => r.url().endsWith("/admin/dividend/slots") && r.request().method() === "POST");
      await page.getByRole("button", { name: "Save slots" }).click();
      expect((await refused).status()).toBe(409);
      expect((await heldBy(capped)).slots).toBe(100);
      // UI: lowering is accepted
      await page.getByLabel("Slots (total)").fill("40");
      const lowered = page.waitForResponse((r) => r.url().endsWith("/admin/dividend/slots") && r.request().method() === "POST");
      await page.getByRole("button", { name: "Save slots" }).click();
      expect((await lowered).status()).toBe(201);
      expect((await heldBy(capped)).slots).toBe(40);

      // ---- raised from 1 to 3 inside the (open) quarter: the end-of-quarter number (3) is what counts
      await ok(await set(riser, 1));
      await ok(await set(riser, 3));
      expect((await heldBy(riser)).slots).toBe(3);

      // ---- transfer: two linked legs
      await ok(await set(fromU, 5));
      const t = await ok<any>(await sa.post("admin/dividend/slots/transfer", { fromUserId: fromU.id, toUserId: toU.id, slots: 2, reason: "e2e transfer" }));
      expect(t.legs).toHaveLength(2);
      const [outLeg, inLeg] = t.legs;
      expect([outLeg.kind, inLeg.kind]).toEqual(["TRANSFER_OUT", "TRANSFER_IN"]);
      expect(outLeg.transferId).toBe(t.transferId);
      expect(inLeg.transferId).toBe(t.transferId);
      expect([outLeg.userId, outLeg.counterpartyUserId]).toEqual([fromU.id, toU.id]);
      expect([inLeg.userId, inLeg.counterpartyUserId]).toEqual([toU.id, fromU.id]);
      expect([outLeg.slots, inLeg.slots]).toEqual([3, 2]);
      expect((await heldBy(fromU)).slots).toBe(3);
      expect((await heldBy(toU)).slots).toBe(2);
      const hist = (await ok<any>(await sa.get("admin/dividend/slots/history?limit=200"))).items as any[];
      const legs = hist.filter((h) => h.transferId === t.transferId);
      expect(legs.map((h) => h.id).sort()).toEqual([outLeg.id, inLeg.id].sort());
      // more than held is refused
      const tooMany = await errOf(await sa.post("admin/dividend/slots/transfer", { fromUserId: fromU.id, toUserId: toU.id, slots: 4, reason: "too many" }));
      expect([tooMany.status, tooMany.code]).toEqual([409, "DIVIDEND_SLOT_INSUFFICIENT"]);
      // slot history is append-only: no routes
      expect([404, 405]).toContain((await sa.delete(`admin/dividend/slots/history/${outLeg.id}`)).status());
    } finally {
      await context.close();
      // reset every account created here so the shared current-quarter totals are as before (append-only: rows stay)
      for (const u of users) {
        const h = await heldBy(u);
        if (h && (h.slots !== 0 || h.expiresAt)) await sa.post("admin/dividend/slots", { userId: u.id, slots: 0, reason: "e2e cleanup" });
      }
    }
  });

  test("ADMIN cannot write slots (403)", async () => {
    const admin = await apiAs("ADMIN");
    const u = await createUser({ prefix: "slotadmin" });
    expect((await admin.post("admin/dividend/slots", { userId: u.id, slots: 1, reason: "admin attempt" })).status()).toBe(403);
    expect((await admin.get("admin/dividend/slots")).status()).toBe(200);
  });
});
