import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
import { REDIS_CONTAINER } from "../support/env";
import { staffApi, uiPage } from "../support/kit-flows-9-13";
import { readDownload, redisCli, taipeiDay } from "../support/kit-export";

/**
 * Flow 11, Redis outage. SERIAL ONLY: stopping Redis breaks every other spec (sessions, throttler, idempotency, queues).
 * The export limiter fails CLOSED: no Redis => 503 before anything is opened. Redis is always started again in `finally`
 * and the test waits until a Redis-backed call works again.
 * NOT RUN by the builder (lead decides when): typechecked only.
 */
test.describe.configure({ timeout: 240_000 });

const docker = (...a: string[]) => execFileSync("docker", a, { encoding: "utf8" }).trim();

async function waitRedisBack(probe: () => Promise<boolean>) {
  await expect.poll(() => { try { return redisCli("ping"); } catch { return "down"; } }, { timeout: 60_000, message: "redis answers PING" }).toBe("PONG");
  // ioredis in the backend reconnects with back-off: poll a Redis-backed route until it works again
  await expect.poll(probe, { timeout: 90_000, intervals: [1000], message: "backend reconnected to Redis" }).toBe(true);
}

test("Redis stopped: export download answers 503 (API and UI), then works again after Redis is started", async ({ browser }) => {
  const admin = await staffApi("ADMIN");
  const url = `admin/accounting-export/wallet-transactions?from=${taipeiDay(0)}&to=${taipeiDay(0)}&userId=${"00000000-0000-4000-8000-000000000000"}`;
  const probe = async () => { const r = await admin.get(url); await r.body(); return r.status() === 200; };
  expect(await probe()).toBe(true); // healthy before

  const ui = await uiPage(browser, { api: admin });
  const page = ui.page;
  await page.goto("/admin/accounting-export");
  await page.locator("form select").first().selectOption({ label: "Wallet transactions" });
  await page.getByLabel("From (GMT+8)").fill(taipeiDay(0));
  await page.getByLabel("To (GMT+8)").fill(taipeiDay(0));
  await page.getByLabel("User ID (optional)").fill("00000000-0000-4000-8000-000000000000");

  let stopped = false;
  try {
    docker("stop", REDIS_CONTAINER);
    stopped = true;

    const res = await admin.get(url);
    const body = await res.text();
    expect(res.status(), body.slice(0, 300)).toBe(503); // if another status shows up first (auth/throttler needing Redis) report it as a finding

    const resp = page.waitForResponse((r) => r.url().includes("/admin/accounting-export/wallet-transactions") && !r.url().includes("/summary"));
    await page.getByRole("button", { name: "Download CSV", exact: true }).click();
    expect((await resp).status()).toBe(503);
    await expect(page.locator(".mq-alert-error")).toContainText("temporarily unavailable");
  } finally {
    if (stopped) docker("start", REDIS_CONTAINER);
    await waitRedisBack(probe);
  }

  // recovered: the same click downloads
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download CSV", exact: true }).click();
  await readDownload(await dl, path.join(os.tmpdir(), `e2e-redis-back-${process.pid}.csv`));
  await expect(page.locator(".mq-alert-success")).toContainText("Saved");
  await ui.context.close();
});
