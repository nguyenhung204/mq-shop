import { expect, test } from "@playwright/test";
import { apiAs, ok } from "../support/api";
import { errOf, pageAs, putSetting, settingOf } from "../support/admin-flows";
import { sql } from "../support/db";

/**
 * Flow 4 (parallel part, nothing global is written): /admin/settings permissions and the reason rules that are refused
 * BEFORE anything is stored. The writing part (3 and 500 characters accepted, history row, append-only trigger) is 04-settings.serial.spec.ts.
 */
const KEY = "refundOverdueDays";
const LABEL = "Refund overdue after (days)";
const historyRows = async () =>
  Number((await sql<{ n: string }>(`SELECT count(*)::text AS n FROM system_settings_history WHERE key = $1`, [KEY]))[0].n);

test.describe("04 settings (read-only checks)", () => {
  test("API: ADMIN reads settings and history but cannot write; SELLER and BUYER are refused everywhere", async () => {
    const admin = await apiAs("ADMIN");
    expect((await admin.get("admin/settings")).status()).toBe(200);
    expect((await admin.get(`admin/settings/${KEY}/history`)).status()).toBe(200);
    const cur = await settingOf(admin, KEY);
    expect((await putSetting(admin, KEY, cur.value, "admin must not write")).status()).toBe(403);
    for (const role of ["SELLER", "BUYER"] as const) {
      const api = await apiAs(role);
      expect((await api.get("admin/settings")).status(), role).toBe(403);
      expect((await api.get(`admin/settings/${KEY}/history`)).status(), role).toBe(403);
      expect((await putSetting(api, KEY, cur.value, "must be refused")).status(), role).toBe(403);
    }
    expect((await settingOf(await apiAs("SUPER_ADMIN"), KEY)).value).toBe(cur.value);
  });

  test("API: a reason of 2 characters, 501 characters or blanks is refused with 400 and stores nothing", async () => {
    const sa = await apiAs("SUPER_ADMIN");
    const before = await historyRows();
    const cur = await settingOf(sa, KEY);
    const newValue = typeof cur.value === "number" ? cur.value + 1 : 7;
    for (const reason of ["ab", "a".repeat(501), "     ", "  a "]) {
      const e = await errOf(await putSetting(sa, KEY, newValue, reason));
      expect(e.status, `reason length ${reason.length}`).toBe(400);
    }
    expect((await settingOf(sa, KEY)).value).toBe(cur.value);
    expect(await historyRows()).toBe(before);
  });

  test("API: the history has no update/delete routes", async () => {
    const sa = await apiAs("SUPER_ADMIN");
    for (const m of ["put", "patch"] as const) {
      expect([404, 405], m).toContain((await sa[m](`admin/settings/${KEY}/history`, { reason: "tamper" })).status());
    }
    expect([404, 405]).toContain((await sa.delete(`admin/settings/${KEY}/history`)).status());
  });

  test("UI: SUPER_ADMIN gets Edit buttons; the modal blocks a 2-character reason and cuts a 501st character", async ({ browser }) => {
    const { page, context } = await pageAs(browser, { api: await apiAs("SUPER_ADMIN") });
    try {
      let puts = 0;
      page.on("request", (r) => { if (r.method() === "PUT" && r.url().includes("/admin/settings/")) puts += 1; });
      await page.goto("/admin/settings");
      const row = page.getByRole("row").filter({ hasText: LABEL });
      await expect(row).toBeVisible();
      await row.getByRole("button", { name: "Edit" }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Value", { exact: true }).fill("9");
      await dialog.getByLabel("Reason").fill("ab");
      await dialog.getByRole("button", { name: "Save setting" }).click();
      await expect(dialog.getByRole("alert")).toContainText("The reason must be at least 3 characters.");
      await dialog.getByLabel("Reason").fill("z".repeat(501));
      await expect(dialog.getByText("500/500")).toBeVisible(); // the 501st character cannot be entered
      expect(puts).toBe(0);
    } finally {
      await context.close();
    }
  });

  test("UI: ADMIN sees the settings and can open the history, but has no Edit button", async ({ browser }) => {
    const { page, context } = await pageAs(browser, { api: await apiAs("ADMIN") });
    try {
      await page.goto("/admin/settings");
      await expect(page.getByText("Configurable business parameters (read only). Only a Super Admin can change them.")).toBeVisible();
      const row = page.getByRole("row").filter({ hasText: LABEL });
      await expect(row).toBeVisible();
      await expect(page.getByRole("button", { name: "Edit" })).toHaveCount(0);
      await row.getByRole("button", { name: "History" }).click();
      await expect(page.getByRole("row").filter({ hasText: /No changes recorded yet\.|When \(GMT\+8\)/ }).first()).toBeVisible();
    } finally {
      await context.close();
    }
  });

  for (const role of ["SELLER", "BUYER"] as const) {
    test(`UI: ${role} cannot stay on /admin/settings (redirected away, no settings shown)`, async ({ browser }) => {
      const { page, context } = await pageAs(browser, { api: await apiAs(role) });
      try {
        await page.goto("/admin/settings");
        await expect(page).not.toHaveURL(/\/admin\/settings/);
        await expect(page.getByText(LABEL)).toHaveCount(0);
      } finally {
        await context.close();
      }
    });
  }
});
