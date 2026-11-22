import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ok } from "../support/api";
import { staffApi, uiPage } from "../support/kit-flows-9-13";

/**
 * TEST-GUIDE A8: manual backup from /admin/backups. SERIAL ONLY: while pg_dump runs the backend sets a Redis maintenance flag and every
 * POST/PUT/PATCH/DELETE of the whole stack answers 503, which would break any spec running beside it.
 * NOT RUN by the builder (lead decides when): typechecked only.
 *
 * Needs `pg_dump` on the PATH of the machine that runs the BACKEND (same machine here). This host has pg_dump 18.4 (Homebrew libpq)
 * against a PostgreSQL 16.15 server: a newer client can dump an older server, so it should work; the backend row records the version.
 */
function pgDumpVersion(): string | null {
  try { return execFileSync("pg_dump", ["--version"], { encoding: "utf8" }).trim(); } catch { return null; }
}
const PG_DUMP = pgDumpVersion();

test.describe.configure({ timeout: 240_000 });
test.skip(PG_DUMP === null, "pg_dump is not available on this machine (the backend needs it on its PATH): a backup cannot run, nothing is faked");

test("manual full backup: new row appears, reaches Success, ZIP downloads from the UI", async ({ browser }) => {
  const sa = await staffApi("SUPER_ADMIN");
  const ui = await uiPage(browser, { api: sa });
  const page = ui.page;
  await page.goto("/admin/backups");
  await expect(page.getByRole("button", { name: "Start FULL backup" })).toBeEnabled(); // no backup already running
  const before = await ok<any[]>(await sa.get("admin/backups?pageSize=50"));

  const created = page.waitForResponse((r) => r.url().endsWith("/admin/backups") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Start FULL backup" }).click();
  const res = await created;
  expect(res.status(), await res.text()).toBe(202);
  const id: string = (await res.json()).data.id;
  expect(before.map((b) => b.id)).not.toContain(id);

  // the new row is the first line of the table and ends up Success (poll through the Refresh button, like a person)
  const firstRow = page.locator("tbody tr").first();
  await expect(firstRow).toBeVisible();
  await expect
    .poll(async () => {
      await page.getByRole("button", { name: "Refresh" }).click();
      const b = await ok<any>(await sa.get(`admin/backups/${id}`));
      if (b.status === "FAILED") throw new Error(`backup FAILED: ${b.error ?? b.errorMessage}`);
      return b.status;
    }, { timeout: 150_000, intervals: [2000], message: "backup finished" })
    .toBe("SUCCESS");
  await expect(firstRow.locator(".mq-badge").first()).toHaveText("Success");

  const done = await ok<any>(await sa.get(`admin/backups/${id}`));
  expect(done.postgresVersion ?? done.postgres_version).toBeTruthy();
  expect(Number(done.fileSize ?? done.sizeBytes)).toBeGreaterThan(0);
  expect(done.checksum).toMatch(/^[0-9a-f]{64}$/);

  // download through the UI and look inside: a ZIP holding database.dump (pg_dump custom format starts with PGDMP)
  const dl = page.waitForEvent("download");
  await firstRow.getByRole("button", { name: "Download ZIP" }).click();
  const file = path.join(os.tmpdir(), `e2e-backup-${process.pid}.zip`);
  await (await dl).saveAs(file);
  const zip = fs.readFileSync(file);
  expect(zip.subarray(0, 2).toString()).toBe("PK");
  expect(zip.includes(Buffer.from("database.dump"))).toBe(true);
  expect(zip.length).toBe(Number(done.fileSize ?? done.sizeBytes));
  await ui.context.close();
});
