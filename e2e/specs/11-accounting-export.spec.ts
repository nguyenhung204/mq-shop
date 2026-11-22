import { test, expect, type Browser } from "@playwright/test";
import path from "node:path";
import os from "node:os";
import { anon, apiLogin, ok, type Api } from "../support/api";
import { ROLES } from "../support/env";
import {
  clawedBackCents, completeRmaAfterApproval, createCreditedReferralOrder, createSellerWithSku, createUser, openRma, uniq, walletOf, type ReferralSetup,
} from "../support/factory";
import { sql } from "../support/db";
import { cancelledPaidOrder, staffApi, uiPage, type CancelledCase } from "../support/kit-flows-9-13";
import {
  TAIPEI_ISO, UTC_ISO, c100, createAccountant, hasBom, leaseKey, readDownload, redisCli, sameInstant, sum100, taipeiDay, type Csv,
} from "../support/kit-export";

/**
 * TEST-GUIDE flow 11 / C2-d: accounting CSV exports. Files are downloaded through the UI (download event) and checked by code.
 * The exports are global (whole DB, by date): every read is narrowed with the shop / beneficiary / user filter of OUR data.
 * Real concurrency (a slow stream) cannot be made stable, so the 429 test plants fake leases in Redis (see that test).
 */
test.describe.configure({ timeout: 180_000 });

const FROM = () => taipeiDay(-1);
const TO = () => taipeiDay(1);
const tmp = (name: string) => path.join(os.tmpdir(), `e2e-export-${process.pid}-${Date.now()}-${name}`);

type Kind = "refund-cases" | "commission-ledger" | "wallet-transactions" | "dividend-settlements";
const KIND_LABEL: Record<Kind, string> = {
  "refund-cases": "Refund cases (with history)",
  "commission-ledger": "Commission ledger movements",
  "wallet-transactions": "Wallet transactions",
  "dividend-settlements": "Dividend settlements (automatic credit)",
};

/** Fill the export form like a person and click Download; returns the parsed file. */
async function uiExport(browser: Browser, api: Api, kind: Kind, fields: Record<string, string>): Promise<Csv> {
  const ui = await uiPage(browser, { api });
  const page = ui.page;
  await page.goto("/admin/accounting-export");
  await page.locator("form select").first().selectOption({ label: KIND_LABEL[kind] });
  if (kind !== "dividend-settlements") {
    await page.getByLabel("From (GMT+8)").fill(FROM());
    await page.getByLabel("To (GMT+8)").fill(TO());
  }
  for (const [label, value] of Object.entries(fields)) await page.getByLabel(label).fill(value);
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download CSV", exact: true }).click();
  const csv = await readDownload(await dl, tmp(`${kind}.csv`));
  await expect(page.locator(".mq-alert-success")).toContainText("Saved");
  await ui.context.close();
  return csv;
}

/** Common file rules: BOM, CRLF, TOTAL lines last, ISO +08:00 / UTC pairs, no unprotected formula cell. */
function checkEnvelope(csv: Csv, pairs: Array<[string, string]>, numericCols: string[]) {
  expect(hasBom(csv.bytes), "UTF-8 BOM EF BB BF").toBe(true);
  expect(csv.bytes.subarray(3, 6).toString()).not.toContain("﻿"); // exactly one BOM
  expect(csv.crlf).toBe(true);
  expect(csv.totals.length).toBeGreaterThan(0);
  // TOTAL lines are the last lines
  const last = csv.rows.slice(csv.rows.length - csv.totals.length);
  expect(last).toEqual(csv.totals);
  expect(csv.bytes.toString("utf8")).not.toContain("#ERROR");
  for (const r of csv.data) {
    for (const [tz, utc] of pairs) {
      if (!r[tz] && !r[utc]) continue;
      expect(r[tz], tz).toMatch(TAIPEI_ISO);
      expect(r[utc], utc).toMatch(UTC_ISO);
      expect(sameInstant(r[tz], r[utc]), `${tz} and ${utc} are one instant`).toBe(true);
    }
    for (const [col, v] of Object.entries(r)) {
      if (numericCols.includes(col)) {
        expect(v, col).toMatch(/^-?\d+(\.\d+)?$|^$/);
        continue;
      }
      expect(v, `${col} must not start with = + - @ (formula guard)`).not.toMatch(/^[\s]*[=+\-@]|^[\t\r]/);
    }
  }
}

test.describe.serial("exports with data of our own", () => {
  let ref: ReferralSetup;
  let rc: CancelledCase;
  const evil = { refName: '=HYPERLINK("http://e2e.test","click"),x', buyerName: "@buyer-e2e", rcBuyerName: "-buyer evil", rcShop: `=Shop e2e evil ${uniq("s")}`, refShop: `+Shop,e2e;plus ${uniq("s")}`, note: "=cmd|' /C calc'!A0", reference: "+ref-1" };

  test.beforeAll(async () => {
    test.setTimeout(240_000);
    // commission + wallet data: referrer credited 310.00 pts, then a partial refund claws back 123.99 pts
    ref = await createCreditedReferralOrder();
    const rma = await openRma(ref.buyer, ref.order.id);
    await ok(await ref.referrer.user.api.post(`rma/${rma.id}/approve`, { refundAmount: "40000.00" }));
    await completeRmaAfterApproval(ref.buyer, ref.referrer.user.api, rma.id);
    await expect.poll(() => clawedBackCents(ref.order.id), { timeout: 20_000 }).toBe(12399n);
    // names that a spreadsheet would execute (profile API; shop names have no edit API)
    await ok(await ref.referrer.user.api.patch("users/me", { fullName: evil.refName }));
    await ok(await ref.buyer.api.patch("users/me", { fullName: evil.buyerName }));
    // SQL: no API renames a shop; the shop name is exported as shop_name / is not user-editable after approval.
    await sql(`UPDATE shops SET name = $2 WHERE id = $1`, [ref.referrer.shopId, evil.refShop]);

    // refund-case data
    rc = await cancelledPaidOrder();
    await ok(await rc.buyer.api.patch("users/me", { fullName: evil.rcBuyerName }));
    await sql(`UPDATE shops SET name = $2 WHERE id = $1`, [rc.seller.shopId, evil.rcShop]); // SQL: same reason
    await ok(await rc.seller.user.api.post(`refund-cases/${rc.caseId}/mark-paid`, { reference: evil.reference, note: "paid" }));
    await ok(await rc.buyer.api.post(`refund-cases/${rc.caseId}/dispute`, { note: evil.note }));
  });

  test("refund-case CSV (ACCOUNTANT, UI download): BOM, ISO +08:00 + UTC, formula guard, TOTAL = recomputed sum", async ({ browser }) => {
    const csv = await uiExport(browser, await staffApi("ACCOUNTANT"), "refund-cases", { "Shop ID": rc.seller.shopId });
    checkEnvelope(csv, [["case_opened_taipei", "case_opened_utc"], ["event_at_taipei", "event_at_utc"]], ["event_seq", "amount", "amount_counted", "display_amount", "fx_rate"]);
    // 3 events of exactly one case: CREATED, SELLER_MARK_PAID, BUYER_DISPUTE
    expect(csv.data.map((r) => r.event_kind)).toEqual(["CREATED", "SELLER_MARK_PAID", "BUYER_DISPUTE"]);
    expect(new Set(csv.data.map((r) => r.case_id))).toEqual(new Set([rc.caseId]));
    // formula guard: apostrophe in front of the dangerous text, original text otherwise intact
    for (const r of csv.data) {
      expect(r.shop_name).toBe(`'${evil.rcShop}`);
      expect(r.buyer_name).toBe(`'${evil.rcBuyerName}`);
    }
    expect(csv.data[1].reference).toBe(`'${evil.reference}`);
    expect(csv.data[2].note).toBe(`'${evil.note}`);
    // amounts: counted once (first event) and TOTAL line equals the recomputed sum and the DB
    const [{ cents }] = await sql<{ cents: string }>(`SELECT amount_cents::text AS cents FROM refund_cases WHERE id = $1`, [rc.caseId]); // SQL: DB truth
    expect(sum100(csv.data, "amount_counted")).toBe(BigInt(cents));
    expect(csv.data.map((r) => r.amount_counted)).toEqual([expect.stringMatching(/^\d+\.\d\d$/), "0.00", "0.00"]);
    expect(csv.totals).toHaveLength(1);
    expect(c100(csv.totals[0].amount_counted)).toBe(sum100(csv.data, "amount_counted"));
    expect(csv.totals[0].case_id).toBe("TOTAL cases=1 events=3");
    expect(csv.totals[0].currency).toBe("TWD");
    // the summary endpoint (JSON twin) says the same
    const acc = await staffApi("ACCOUNTANT");
    const sm = await ok<any>(await acc.get(`admin/accounting-export/refund-cases/summary?from=${FROM()}&to=${TO()}&shopId=${rc.seller.shopId}`));
    expect(sm.rowCount).toBe(3);
    expect(sm.caseCount).toBe(1);
    expect(c100(sm.amounts[0].total)).toBe(sum100(csv.data, "amount_counted"));
  });

  test("commission CSV (ADMIN) + wallet CSV (SUPER_ADMIN): totals recompute, and net points = wallet transactions = wallet balance", async ({ browser }) => {
    const refId = ref.referrer.user.id;
    const com = await uiExport(browser, await staffApi("ADMIN"), "commission-ledger", { "Beneficiary ID (optional)": refId });
    const wal = await uiExport(browser, await staffApi("SUPER_ADMIN"), "wallet-transactions", { "User ID (optional)": refId });

    const numCom = ["rate_percent", "base_twd", "gross_twd", "wallet_twd", "wallet_points", "held_twd", "current_twd"];
    checkEnvelope(com, [["movement_at_taipei", "movement_at_utc"]], numCom);
    checkEnvelope(wal, [["created_taipei", "created_utc"]], ["amount_signed", "available_after", "frozen_after"]);

    // formula guard on names/emails of this data
    expect(new Set(com.data.map((r) => r.beneficiary_name))).toEqual(new Set([`'${evil.refName}`]));
    expect(new Set(wal.data.map((r) => r.user_name))).toEqual(new Set([`'${evil.refName}`]));

    // commission rows: one CREDIT (+310.00 pts) and one REVERSAL (-123.99 pts); negative numbers are NOT apostrophe-prefixed
    const movements = com.data.map((r) => r.movement).sort();
    expect(movements).toEqual(["CREDIT", "REVERSAL"]);
    const credit = com.data.find((r) => r.movement === "CREDIT")!;
    const rev = com.data.find((r) => r.movement === "REVERSAL")!;
    expect(c100(credit.wallet_points)).toBe(31000n);
    expect(rev.wallet_points).toBe("-123.99");
    expect(rev.original_ledger_id).toBe(credit.movement_id);
    // TOTAL lines vs recomputation, per movement and the wallet net
    for (const mv of ["CREDIT", "REVERSAL"]) {
      const t = com.totals.find((r) => r.movement === mv)!;
      const rows = com.data.filter((r) => r.movement === mv);
      expect(t.movement_id).toBe(`TOTAL ${mv} rows=${rows.length}`);
      for (const col of ["gross_twd", "wallet_twd", "wallet_points", "held_twd"]) expect(c100(t[col]), `${mv} ${col}`).toBe(sum100(rows, col));
    }
    const net = com.totals.find((r) => r.movement_id.startsWith("TOTAL WALLET NET"))!;
    const netPoints = sum100(com.data, "wallet_points");
    expect(c100(net.wallet_points)).toBe(netPoints);
    expect(c100(net.wallet_twd)).toBe(sum100(com.data, "wallet_twd"));
    expect(netPoints).toBe(31000n - 12399n);

    // wallet transactions: signed amounts, NET line = recomputed sum; every commission movement has its wallet row
    const walNet = wal.totals.find((r) => r.tx_id.startsWith("TOTAL NET"))!;
    expect(c100(walNet.amount_signed)).toBe(sum100(wal.data, "amount_signed"));
    expect(wal.data.every((r) => r.unit === "PTS")).toBe(true);
    expect(new Set(wal.data.map((r) => r.tx_id))).toEqual(new Set([credit.wallet_tx_id, rev.wallet_tx_id]));
    for (const g of wal.totals.filter((r) => r.tx_id !== walNet.tx_id)) {
      const rows = wal.data.filter((r) => r.direction === g.direction && r.reason === g.reason);
      expect(g.tx_id).toBe(`TOTAL ${g.direction} ${g.reason} rows=${rows.length}`);
      expect(c100(g.amount_signed)).toBe(sum100(rows, "amount_signed"));
    }

    // reconciliation: commission net points == wallet transactions net == wallet balance == summary walletNet
    expect(sum100(wal.data, "amount_signed")).toBe(netPoints);
    const bal = await walletOf(ref.referrer.user);
    expect(bal.availableCents).toBe(netPoints);
    const acc = await staffApi("ACCOUNTANT");
    const sm = await ok<any>(await acc.get(`admin/accounting-export/commission-ledger/summary?from=${FROM()}&to=${TO()}&beneficiaryId=${refId}`));
    expect(c100(sm.walletNet.points)).toBe(netPoints);
    const sw = await ok<any>(await acc.get(`admin/accounting-export/wallet-transactions/summary?from=${FROM()}&to=${TO()}&userId=${refId}`));
    expect(c100(sw.net)).toBe(netPoints);
    expect(sw.rowCount).toBe(wal.data.length);
    // the last wallet row's balance snapshot is the balance
    expect(c100(wal.data[wal.data.length - 1].available_after)).toBe(bal.availableCents);
  });

  test("dividend CSV (ACCOUNTANT): BOM, TOTAL lines consistent with the lines of the same file", async ({ browser }) => {
    const csv = await uiExport(browser, await staffApi("ACCOUNTANT"), "dividend-settlements", {});
    expect(hasBom(csv.bytes)).toBe(true);
    expect(csv.header).toEqual(["quarter", "user_id", "user_name", "user_email", "slots", "amount_twd", "points", "wallet_tx_id", "status", "credited_taipei", "credited_utc"]);
    expect(csv.bytes.toString("utf8")).not.toContain("#ERROR");
    const items = csv.totals.find((r) => r.quarter.startsWith("TOTAL ITEMS"))!;
    expect(items.quarter).toBe(`TOTAL ITEMS rows=${csv.data.length}`);
    expect(c100(items.amount_twd)).toBe(sum100(csv.data, "amount_twd"));
    expect(csv.totals.map((r) => r.quarter.split(" ")[1])).toEqual(expect.arrayContaining(["ITEMS", "POOL", "REMAINDER"]));
    for (const t of csv.totals.filter((r) => r.status)) {
      const rows = csv.data.filter((r) => r.status === t.status);
      expect(t.quarter).toBe(`TOTAL ${t.status} rows=${rows.length}`);
      expect(c100(t.amount_twd)).toBe(sum100(rows, "amount_twd"));
    }
    for (const r of csv.data) {
      if (r.credited_taipei) {
        expect(r.credited_taipei).toMatch(TAIPEI_ISO);
        expect(sameInstant(r.credited_taipei, r.credited_utc)).toBe(true);
      }
    }
  });
});

test("range longer than 366 days is refused: UI shows the error without calling the API; API answers 400 on every export and summary", async ({ browser }) => {
  const acc = await staffApi("ACCOUNTANT");
  const ui = await uiPage(browser, { api: acc });
  const calls: string[] = [];
  ui.page.on("request", (r) => { if (r.url().includes("/api/v1/admin/accounting-export/")) calls.push(r.url()); });
  await ui.page.goto("/admin/accounting-export");
  for (const kind of ["refund-cases", "commission-ledger", "wallet-transactions"] as const) {
    await ui.page.locator("form select").first().selectOption({ label: KIND_LABEL[kind] });
    await ui.page.getByLabel("From (GMT+8)").fill("2025-01-01");
    await ui.page.getByLabel("To (GMT+8)").fill("2026-11-22");
    await ui.page.getByRole("button", { name: "Download CSV", exact: true }).click();
    await expect(ui.page.locator(".mq-admin-modal-error")).toContainText("The range must not exceed 366 days.");
    await ui.page.getByRole("button", { name: "Preview totals", exact: true }).click();
    await expect(ui.page.locator(".mq-admin-modal-error")).toContainText("366 days");
  }
  expect(calls).toEqual([]); // nothing left the browser
  await ui.context.close();

  const bad = { from: "2025-01-01", to: "2026-11-22" };
  for (const ep of ["refund-cases", "commission-ledger", "wallet-transactions"]) {
    for (const suffix of ["", "/summary"]) {
      const res = await acc.get(`admin/accounting-export/${ep}${suffix}?from=${bad.from}&to=${bad.to}`);
      expect(res.status(), `${ep}${suffix}`).toBe(400);
      expect(await res.text()).toContain("366");
    }
  }
  // boundary: 366 days inclusive-range accepted, 367 refused
  const d = (o: number) => taipeiDay(o);
  expect((await acc.get(`admin/accounting-export/wallet-transactions/summary?from=${d(-365)}&to=${d(0)}`)).status()).toBe(200);
  expect((await acc.get(`admin/accounting-export/wallet-transactions/summary?from=${d(-366)}&to=${d(0)}`)).status()).toBe(400);
  // missing / reversed / impossible dates
  expect((await acc.get(`admin/accounting-export/wallet-transactions?from=${d(0)}`)).status()).toBe(400);
  expect((await acc.get(`admin/accounting-export/wallet-transactions?from=${d(1)}&to=${d(0)}`)).status()).toBe(400);
  expect((await acc.get(`admin/accounting-export/wallet-transactions?from=2026-02-30&to=2026-03-01`)).status()).toBe(400);
});

test("BUYER / SELLER / CS / WAREHOUSE are refused: API 403 on every route, UI sends them away from the page", async ({ browser }) => {
  const buyer = await createUser({ prefix: "xbuy" });
  const seller = await createSellerWithSku({ prefix: "xsel" });
  const people: Array<[string, Api]> = [
    ["BUYER", buyer.api],
    ["SELLER", seller.user.api],
    ["CS", await apiLogin(ROLES.CS.email, ROLES.CS.password)],
    ["WAREHOUSE", await apiLogin(ROLES.WAREHOUSE.email, ROLES.WAREHOUSE.password)],
  ];
  const range = `from=${FROM()}&to=${TO()}`;
  for (const [who, api] of people) {
    for (const ep of ["refund-cases", "commission-ledger", "wallet-transactions"]) {
      expect((await api.get(`admin/accounting-export/${ep}?${range}`)).status(), `${who} ${ep}`).toBe(403);
      expect((await api.get(`admin/accounting-export/${ep}/summary?${range}`)).status(), `${who} ${ep}/summary`).toBe(403);
    }
    expect((await api.get(`admin/accounting-export/dividend-settlements`)).status(), `${who} dividend`).toBe(403);
    expect((await api.get(`admin/accounting-export/dividend-settlements/summary`)).status(), `${who} dividend summary`).toBe(403);
  }
  const anonymous = await anon();
  expect((await anonymous.get(`admin/accounting-export/wallet-transactions?${range}`)).status()).toBe(401);

  for (const [who, api] of people) {
    const ui = await uiPage(browser, { api });
    await ui.page.goto("/admin/accounting-export");
    await expect(ui.page.getByRole("button", { name: "Download CSV", exact: true }), `${who} UI`).toHaveCount(0);
    await expect(ui.page).not.toHaveURL(/accounting-export/);
    await ui.context.close();
  }
});

test("a user already running 2 exports gets 429 on the 3rd: UI shows the limit message; releasing one slot allows it again (leases planted in Redis)", async ({ browser }) => {
  // SIMULATION: a real slow stream cannot be made stable (a small CSV finishes in ms and frees its lease), so the two running
  // exports are represented by two lease entries in the same Redis sorted set the limiter uses for this user
  // (export:lease:user:<id>), not in the global set. The 429 itself, its UI text and the release are real.
  const acc = await createAccountant();
  const key = leaseKey(acc.id);
  const expires = String(Date.now() + 5 * 60_000);
  const url = `admin/accounting-export/wallet-transactions?from=${FROM()}&to=${TO()}&userId=${acc.id}`;
  try {
    // baseline: a real export works and gives its lease back
    const first = await acc.api.get(url);
    expect(first.status()).toBe(200);
    await first.body();
    await expect.poll(() => redisCli("zcard", key), { message: "lease released after a normal export" }).toBe("0");

    redisCli("zadd", key, expires, "e2e-fake-lease-1", expires, "e2e-fake-lease-2");
    expect(redisCli("zcard", key)).toBe("2");

    const blocked = await acc.api.get(url);
    expect(blocked.status()).toBe(429);
    expect(await blocked.text()).toContain("already have exports running");
    // summaries do not take a slot
    expect((await acc.api.get(`admin/accounting-export/wallet-transactions/summary?from=${FROM()}&to=${TO()}&userId=${acc.id}`)).status()).toBe(200);

    const ui = await uiPage(browser, acc);
    await ui.page.goto("/admin/accounting-export");
    await ui.page.locator("form select").first().selectOption({ label: KIND_LABEL["wallet-transactions"] });
    await ui.page.getByLabel("From (GMT+8)").fill(FROM());
    await ui.page.getByLabel("To (GMT+8)").fill(TO());
    await ui.page.getByLabel("User ID (optional)").fill(acc.id);
    let downloaded = false;
    ui.page.on("download", () => { downloaded = true; });
    const resp = ui.page.waitForResponse((r) => r.url().includes("/admin/accounting-export/wallet-transactions") && !r.url().includes("/summary"));
    await ui.page.getByRole("button", { name: "Download CSV", exact: true }).click();
    expect((await resp).status()).toBe(429);
    await expect(ui.page.locator(".mq-alert-error")).toContainText("at most 2 at the same time per person");
    expect(downloaded).toBe(false);

    // one export finishes -> room for exactly one more
    redisCli("zrem", key, "e2e-fake-lease-1");
    const dl = ui.page.waitForEvent("download");
    await ui.page.getByRole("button", { name: "Download CSV", exact: true }).click();
    await readDownload(await dl, tmp("lease.csv"));
    await expect(ui.page.locator(".mq-alert-success")).toContainText("Saved");
    await ui.context.close();
  } finally {
    redisCli("del", key);
  }
});
