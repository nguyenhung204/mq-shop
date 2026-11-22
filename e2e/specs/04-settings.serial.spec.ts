import { expect, test } from "@playwright/test";
import { apiAs, ok } from "../support/api";
import { expectDbRejects, pageAs, putSetting, settingOf } from "../support/admin-flows";
import { sql } from "../support/db";

/**
 * Flow 4 (writing part, SERIAL): SUPER_ADMIN really changes one setting. Key `refundOverdueDays` is low impact (it only flags
 * overdue refund cases); its original value (possibly null) is restored in `finally`. The restore itself adds history rows:
 * the history is append-only, so those rows stay (reason "e2e restore").
 */
const KEY = "refundOverdueDays";
const LABEL = "Refund overdue after (days)";

test.describe("04 settings (writes)", () => {
  test("SUPER_ADMIN edits through the UI (3-char reason), 500-char reason works, history gets rows and is append-only", async ({ browser }) => {
    const sa = await apiAs("SUPER_ADMIN");
    const orig = await settingOf(sa, KEY);
    const pick = (n: number) => (orig.value === n ? n + 100 : n);
    const v1 = pick(11);
    const { page, context } = await pageAs(browser, { api: sa });
    try {
      // ---- UI edit with the minimum reason (3 characters)
      await page.goto("/admin/settings");
      const row = page.getByRole("row").filter({ hasText: LABEL });
      await row.getByRole("button", { name: "Edit" }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Value", { exact: true }).fill(String(v1));
      await dialog.getByLabel("Reason").fill("abc");
      const saved = page.waitForResponse((r) => r.request().method() === "PUT" && r.url().includes(`/admin/settings/${KEY}`));
      await dialog.getByRole("button", { name: "Save setting" }).click();
      expect((await saved).status()).toBe(200);
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(row).toContainText(String(v1));

      // ---- history shows the new row; it has no edit / delete control
      await row.getByRole("button", { name: "History" }).click();
      const histRow = page.getByRole("row").filter({ hasText: "abc" }).filter({ hasText: `→ ${v1}` }).first();
      await expect(histRow).toBeVisible();
      const historyTable = page.locator("td table") /* the history table nested in the settings table */;
      await expect(historyTable.getByRole("button")).toHaveCount(0);

      // ---- API: exactly 500 characters accepted, 501 refused, newest first
      const long = "x".repeat(500);
      const r2 = await ok<any>(await putSetting(sa, KEY, v1 + 1, long));
      expect(r2.changed).toBe(true);
      expect((await putSetting(sa, KEY, v1 + 2, "y".repeat(501))).status()).toBe(400);
      const hist = (await ok<any>(await sa.get(`admin/settings/${KEY}/history`))).items as any[];
      expect(hist[0].reason).toBe(long);
      expect(hist[0].newValue).toBe(v1 + 1);
      expect(hist[0].oldValue).toBe(v1);
      expect(hist[1].reason).toBe("abc");
      expect(hist[1].newValue).toBe(v1);

      // ---- same value again: no new row
      const again = await ok<any>(await putSetting(sa, KEY, v1 + 1, "same value again"));
      expect(again.changed).toBe(false);
      const hist2 = (await ok<any>(await sa.get(`admin/settings/${KEY}/history`))).items as any[];
      expect(hist2.length).toBe(hist.length);

      // ---- append-only: no API route, and the database trigger rejects UPDATE / DELETE of a real row
      expect([404, 405]).toContain((await sa.put(`admin/settings/${KEY}/history/${hist[0].id}`, { reason: "x" })).status());
      expect([404, 405]).toContain((await sa.delete(`admin/settings/${KEY}/history/${hist[0].id}`)).status());
      expect(await expectDbRejects(`UPDATE system_settings_history SET reason = 'tampered' WHERE id = $1`, [hist[0].id])).toMatch(/append-only/);
      expect(await expectDbRejects(`DELETE FROM system_settings_history WHERE id = $1`, [hist[0].id])).toMatch(/append-only/);
      const stored = await sql<{ reason: string }>(`SELECT reason FROM system_settings_history WHERE id = $1`, [hist[0].id]);
      expect(stored[0].reason).toBe(long);
    } finally {
      await context.close();
      // restore (also when the test failed half way); null stays null
      const now = await settingOf(sa, KEY);
      if (now.value !== orig.value) await putSetting(sa, KEY, orig.value, "e2e restore");
    }
    expect((await settingOf(sa, KEY)).value).toBe(orig.value);
  });

  test("an ADMIN write is refused (403) and leaves no history row", async () => {
    const admin = await apiAs("ADMIN");
    const before = Number((await sql<{ n: string }>(`SELECT count(*)::text AS n FROM system_settings_history WHERE key = $1`, [KEY]))[0].n);
    expect((await putSetting(admin, KEY, 5, "admin write attempt")).status()).toBe(403);
    const after = Number((await sql<{ n: string }>(`SELECT count(*)::text AS n FROM system_settings_history WHERE key = $1`, [KEY]))[0].n);
    expect(after).toBe(before);
  });
});
