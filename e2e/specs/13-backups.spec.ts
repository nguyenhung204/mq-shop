import { test, expect } from "@playwright/test";
import { ok } from "../support/api";
import { createSellerWithSku, createUser, getOrder } from "../support/factory";
import { sql } from "../support/db";
import { runStaleBillAutoCancel } from "../support/backend-ctl-jobs";
import { staffApi, uiPage, uploadProof } from "../support/kit-flows-9-13";

/**
 * TEST-GUIDE flow 13 (A7 + A8), the parts that are safe beside other specs.
 * The manual backup itself freezes ALL writes of the stack (Redis maintenance flag, 503 on every POST/PUT/PATCH/DELETE while pg_dump
 * runs), so it lives in 13b-backups.serial.spec.ts.
 */
test.describe.configure({ timeout: 180_000 });

const ADDRESS = { fullName: "E2E Buyer", phone: "0900000000", line1: "1 Test Road", city: "Taipei", country: "TW" };

test("proofStaleAutoCancelDays empty: a PENDING order whose bill is 30 days old is NOT auto-cancelled by the job", async () => {
  const sa = await staffApi("SUPER_ADMIN");
  const settings = await ok<any>(await sa.get("admin/settings"));
  const s = settings.items.find((x: any) => x.key === "proofStaleAutoCancelDays");
  expect(s, "setting exists").toBeTruthy();
  expect(s.value, "precondition: the setting is empty (default, auto-cancel off)").toBeNull();

  const seller = await createSellerWithSku({ prefix: "stale" });
  const buyer = await createUser({ prefix: "stalebuyer" });
  const created = await ok<any>(
    await buyer.api.post("orders/checkout", { items: [{ variantId: seller.variantId, quantity: 1 }], shippingAddress: ADDRESS, paymentMethod: "OFF_PLATFORM" }),
  );
  const order = created.order ?? created.orders?.[0] ?? created;
  await uploadProof(buyer, order.id); // bill on file, nobody handled it
  // SQL: no API ages a bill; push the first proof 30 days back so the order would qualify the moment the setting has a value.
  await sql(`UPDATE orders SET payment_first_proof_at = now() - interval '30 days', payment_proof_uploaded_at = now() - interval '30 days' WHERE id = $1`, [order.id]);
  // SQL: prove the order IS a stale-bill candidate under the job's own rule (so "not cancelled" is due to the empty setting, nothing else)
  const [cand] = await sql<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM orders o WHERE o.id = $1 AND o.status = 'PENDING' AND o.payment_proof_url IS NOT NULL AND o.payment_proof_purged_at IS NULL
        AND o.payment_rejected_reason IS NULL AND COALESCE(o.payment_reuploaded_at, o.payment_first_proof_at) <= now() - interval '1 day'`,
    [order.id],
  );
  expect(cand.n).toBe("1");
  const [{ n: histBefore }] = await sql<{ n: string }>(`SELECT COUNT(*)::text AS n FROM order_status_history WHERE order_id = $1`, [order.id]);

  // SERVICE: the auto-cancel step of the daily job (09:00 Asia/Taipei, no HTTP route), run once through the backend DI container
  const cancelled = await runStaleBillAutoCancel();
  expect(cancelled).toBe(0);

  expect((await getOrder(buyer.api, order.id)).status).toBe("PENDING");
  const [row] = await sql<any>(`SELECT status, cancel_reason FROM orders WHERE id = $1`, [order.id]);
  expect(row).toEqual({ status: "PENDING", cancel_reason: null });
  const [{ n: histAfter }] = await sql<{ n: string }>(`SELECT COUNT(*)::text AS n FROM order_status_history WHERE order_id = $1`, [order.id]);
  expect(histAfter).toBe(histBefore);
  // no refund obligation / refund case appeared
  const [{ n: ob }] = await sql<{ n: string }>(`SELECT COUNT(*)::text AS n FROM order_refund_obligations WHERE order_id = $1`, [order.id]);
  expect(ob).toBe("0");
});

test("backups are Super Admin only: ADMIN / BUYER get 403 on the API, the page sends ADMIN away", async ({ browser }) => {
  const admin = await staffApi("ADMIN");
  const buyer = await createUser({ prefix: "bkbuyer" });
  for (const who of [admin, buyer.api]) {
    expect((await who.get("admin/backups")).status()).toBe(403);
    expect((await who.post("admin/backups", { backupType: "FULL" })).status()).toBe(403);
  }
  const ui = await uiPage(browser, { api: admin });
  await ui.page.goto("/admin/backups");
  await expect(ui.page.getByRole("button", { name: "Start FULL backup" })).toHaveCount(0);
  await expect(ui.page).not.toHaveURL(/admin\/backups/);
  await ui.context.close();
});
