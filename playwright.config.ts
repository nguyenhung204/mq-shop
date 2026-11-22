import { defineConfig, devices } from "@playwright/test";

/**
 * E2E against the throwaway stack started by e2e/scripts/run.sh
 * (backend :3005, frontend :3000 via `next start`, Postgres/Redis/MinIO in temp containers).
 * Projects: `parallel` = independent tests (own data per test); `serial` = tests that change
 * global state (settings, FX, Redis stop) and always restore it in `finally`.
 */
export default defineConfig({
  testDir: "./e2e/specs",
  outputDir: "./e2e/.results",
  globalSetup: "./e2e/support/global-setup.ts",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: true,
  retries: 1,
  workers: process.env.E2E_WORKERS ? Number(process.env.E2E_WORKERS) : 3,
  reporter: [["list"], ["html", { outputFolder: "e2e/.report", open: "never" }], ["json", { outputFile: "e2e/.report/results.json" }]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "parallel",
      testIgnore: /\.serial\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "serial",
      testMatch: /\.serial\.spec\.ts$/,
      fullyParallel: false,
      workers: 1,
      dependencies: ["parallel"],
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
  ],
});
