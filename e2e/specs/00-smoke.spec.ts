import { test, expect } from "@playwright/test";
import path from "node:path";
import { AUTH_DIR } from "../support/env";
import { apiAs, ok } from "../support/api";

test("harness: API session of SUPER_ADMIN works", async () => {
  const api = await apiAs("SUPER_ADMIN");
  const me = await ok(await api.get("users/me"));
  expect(JSON.stringify(me)).toContain("superadmin@example.com");
});

test.describe("harness: browser reuses the stored session", () => {
  test.use({ storageState: path.join(AUTH_DIR, "SUPER_ADMIN.json") });
  test("admin settings page renders for SUPER_ADMIN", async ({ page }) => {
    await page.goto("/admin/settings");
    await expect(page).toHaveURL(/\/admin\/settings/);
    await expect(page.locator("body")).not.toContainText("Application error");
  });
});
