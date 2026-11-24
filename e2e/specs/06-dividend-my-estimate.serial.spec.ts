import { expect, test } from "@playwright/test";
import { apiAs, ok } from "../support/api";
import { createUser } from "../support/factory";
import { pageAs } from "../support/admin-flows";

/**
 * "My slots and expected dividend" on /dividend-credits (owner view). SERIAL because it writes slots of the CURRENT quarter.
 * A holder sees his slots and a figure; an account without slots sees the "no slots" text; the API never returns another account.
 */
test("a slot holder sees his slots and an expected dividend; an account without slots sees none; nothing about others", async ({ browser }) => {
  test.setTimeout(180_000);
  const sa = await apiAs("SUPER_ADMIN");
  const holder = await createUser({ prefix: "estholder" });
  const other = await createUser({ prefix: "estother" });
  try {
    await ok(await sa.post("admin/dividend/slots", { userId: holder.id, slots: 4, reason: "e2e my estimate" }));

    // API: my own slots only, whole-NTD figures, no pool / total / other accounts
    const mine = await ok<any>(await holder.api.get("dividend/my-estimate"));
    expect(mine.slots).toBe(4);
    expect(mine.locked).toBe(false);
    expect(Number.isInteger(mine.estimate.currentNtd)).toBe(true);
    expect(Number.isInteger(mine.estimate.withProvisionalNtd)).toBe(true);
    expect(mine.estimate.withProvisionalNtd).toBeGreaterThanOrEqual(mine.estimate.currentNtd);
    const text = JSON.stringify(mine);
    for (const leak of [other.id, other.email, "totalSlots", "byAccount", "pool"]) expect(text).not.toContain(leak);
    const none = await ok<any>(await other.api.get("dividend/my-estimate"));
    expect(none.slots).toBe(0);
    expect(none.estimate).toEqual({ currentNtd: 0, withProvisionalNtd: 0 });

    // UI
    const h = await pageAs(browser, { api: holder.api });
    try {
      await h.page.goto("/dividend-credits");
      await expect(h.page.locator('[data-row="my-estimate"] [data-row="slots"]')).toHaveText("4");
      await expect(h.page.locator('[data-row="my-estimate"] [data-row="now"]')).toContainText("TWD");
      await expect(h.page.locator('[data-row="my-estimate"]')).toContainText("This is an estimate");
    } finally {
      await h.context.close();
    }
    const o = await pageAs(browser, { api: other.api });
    try {
      await o.page.goto("/dividend-credits");
      await expect(o.page.locator('[data-row="my-estimate"] [data-row="no-slots"]')).toBeVisible();
    } finally {
      await o.context.close();
    }
  } finally {
    await sa.post("admin/dividend/slots", { userId: holder.id, slots: 0, reason: "e2e cleanup" });
  }
});
