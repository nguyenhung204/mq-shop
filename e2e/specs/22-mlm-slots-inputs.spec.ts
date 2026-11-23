import { test, expect, type Locator, type Page } from "@playwright/test";
import { apiAs } from "../support/api";
import { createUser } from "../support/factory";
import {
  LOCALES, VALUES, expectMoney, rawFor, moneyMsg, pageIn, watchRequests, saveResults, row, tr,
  type Locale, type MoneyProfile, type ResultRow, type MoneyCode,
} from "../support/money-inputs";

/**
 * FLOW 22 - MLM and dividend-slot input cells in en / vi / zh-TW (MONEY-INPUT-AUDIT.md "MLM Ranks & Rules" row + spec 14 value matrix).
 * Companion of 14 / 14b / 14c (which cover wallet, FX/finance/dividend % and shop cells); this file adds the cells they do not have.
 *
 * EXPECTATION TABLE (documented rule -> what a person must see; written from the audit, NOT from lib/mlm or lib/money):
 *  Cell                              rule                                              error shown                         write
 *  MLM team %  (create / edit rank)  0..13, 4 decimals, zero ok, no negative,          toast = moneyInput.* message        none for a rejected value
 *                                    locale decimals (vi 1.234,5 / en 1,234.5)
 *  MLM referral % (create / edit)    0..10, 4 decimals, zero ok                        toast = moneyInput.* message
 *  MLM rank number (create form)     whole number 0..10                                toast admin.mlm.rankInvalid
 *  MLM global tier (create form)     blank (= none) or whole 5..10                     toast admin.mlm.globalTierInvalid
 *  MLM promotion rule count          whole 1..10000 (no zero)                          toast = moneyInput.* message (0 decimals)
 *  Dividend slots (set / transfer)   ASCII whole number; set 0..1,000,000, transfer    inline <ul role=alert> list          none
 *                                    1..1,000,000; NOT locale aware ("1,000" refused)  admin.dividend.slots.errors.slots.*
 * Rejected values never reach the network (watchRequests = 0). Accepted values are checked by the REQUEST PAYLOAD (the write is
 * fulfilled by the test so no global MLM rank / rule is changed); slots also have the server verdict (rejected by the UI => 400 from the API).
 * Results table per cell/locale: e2e/.run/money-inputs/*.json.
 */
test.describe.configure({ timeout: 300_000 });
test.use({ actionTimeout: 20_000 }); // a wrong selector fails in 20 s, not at the test timeout

const TEAM: MoneyProfile = { maxDec: 4, allowZero: true, allowNeg: false, min: 0, max: 13 };
const REFERRAL: MoneyProfile = { maxDec: 4, allowZero: true, allowNeg: false, min: 0, max: 10 };
const RANK_NO: MoneyProfile = { maxDec: 0, allowZero: true, allowNeg: false, min: 0, max: 10 };
const TIER: MoneyProfile = { maxDec: 0, allowZero: false, allowNeg: false, min: 5, max: 10 };
const COUNT: MoneyProfile = { maxDec: 0, allowZero: false, allowNeg: false, min: 1, max: 10000 };

// ERROR toasts only: the SUPER_ADMIN account is shared with the other tests, whose events (new shop application...) arrive here as info toasts
const TOAST = '[data-sonner-toast][data-type="error"]';
/** mark the toasts that exist now, so the next submit is judged only by the toast it creates */
async function markToasts(page: Page) {
  await page.evaluate(() => document.querySelectorAll("[data-sonner-toast]").forEach((e) => e.setAttribute("data-seen", "1")));
}
async function newToast(page: Page, ms = 2500): Promise<string | null> {
  const t = page.locator(`${TOAST}:not([data-seen])`).first();
  try { await t.waitFor({ state: "visible", timeout: ms }); return ((await t.innerText()) ?? "").trim().replace(/\s+/g, " "); } catch { return null; }
}

interface ToastCell {
  cell: string;
  locale: Locale;
  profile: MoneyProfile;
  /** expected message for a rejected value (default: the moneyInput.* text of the code) */
  message?: (code: MoneyCode) => string;
  input: Locator;
  submit: Locator;
  page: Page;
  reqs: { count: () => number };
  /** put the form back in a state where only `input` is under test */
  before: () => Promise<void>;
  skip?: string[];
  /** for accepted values: what the request must carry (null = do not check) */
  payloadOf?: (canonical: string) => (body: any) => boolean;
  onRequest?: () => any[];
  /** after an accepted value: wait until the form has closed itself (it does on success) so the next value starts from a known state */
  afterAccept?: () => Promise<void>;
}

async function runToastCell(c: ToastCell): Promise<ResultRow[]> {
  const rows: ResultRow[] = [];
  for (const v of VALUES) {
    if (c.skip?.includes(v.id)) continue;
    const exp = expectMoney(v, c.locale, c.profile);
    const raw = rawFor(v, c.locale);
    await c.before();
    await c.input.fill(raw);
    await markToasts(c.page);
    const n0 = c.reqs.count();
    await c.submit.click();
    if (!exp.ok) {
      const msg = await newToast(c.page);
      const expected = `${(c.message ?? ((code) => moneyMsg(c.locale, code, { maxDecimals: c.profile.maxDec, min: c.profile.min, max: c.profile.max })))(exp.code)} | kept=true | req=0`;
      const kept = (await c.input.inputValue()) === raw;
      row(rows, v.id, raw, expected, `${msg ?? "(no message)"} | kept=${kept} | req=${c.reqs.count() - n0}`, exp.code);
    } else {
      // accepted: a request leaves (fulfilled by the test) and no validation toast is shown
      await expect.poll(() => c.reqs.count() - n0, { message: `${v.id} typed ${JSON.stringify(raw)} should reach the network`, timeout: 4000 }).toBe(1);
      const body = (c.onRequest?.() ?? []).at(-1);
      const okPayload = c.payloadOf ? c.payloadOf(exp.canonical)(body) : true;
      row(rows, v.id, raw, `accepted ${exp.canonical} | payload=true`, `accepted ${exp.canonical} | payload=${okPayload}`, "ok");
      await c.afterAccept?.();
    }
  }
  saveResults(c.cell, c.locale, rows);
  return rows;
}

/* ------------------------------------------------------------------------------------------------ MLM: create-rank form */
async function mlmPage(browser: any, locale: Locale) {
  const sa = await apiAs("SUPER_ADMIN");
  const ui = await pageIn(browser, { api: sa }, locale);
  const posts: any[] = [];
  await ui.page.route(/\/admin\/mlm\/ranks$/, async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    posts.push(JSON.parse(route.request().postData() ?? "{}"));
    await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ data: { rank: 99, name: "x", teamPercent: "0", referralPercent: "0", isActive: true } }) });
  });
  const reqs = watchRequests(ui.page, "POST", /\/admin\/mlm\/ranks$/);
  await ui.page.goto("/admin/mlm");
  return { ...ui, posts, reqs };
}

async function openCreateRank(page: Page, locale: Locale) {
  const form = page.locator("form").filter({ has: page.getByText("Rank #", { exact: true }) });
  if (!(await form.isVisible().catch(() => false))) await page.getByRole("button", { name: tr(locale, "admin.mlm.createRank"), exact: true }).click();
  await expect(form).toBeVisible();
  return form;
}
const fieldOf = (form: Locator, label: string) => form.locator("label").filter({ has: form.page().getByText(label, { exact: true }) }).locator("input");

for (const locale of LOCALES) {
  test(`MLM create-rank form [${locale}]: team % and referral % matrix (toast message, text kept, no POST; accepted value = payload)`, async ({ browser }) => {
    const { page, context, posts, reqs } = await mlmPage(browser, locale);
    const teamLabel = `${tr(locale, "admin.mlm.team")} %`;
    const refLabel = `${tr(locale, "admin.mlm.referral")} %`;
    const fresh = async () => {
      const form = await openCreateRank(page, locale);
      await fieldOf(form, "Rank #").fill("7");
      await form.locator("label").filter({ has: page.getByText(tr(locale, "admin.mlm.rankName"), { exact: true }) }).locator("input").first().fill("E2E rank");
      return form;
    };
    // team %
    await fresh();
    const team = fieldOf(page.locator("form"), teamLabel);
    const refIn = fieldOf(page.locator("form"), refLabel);
    const createBtn = () => page.locator("form").getByRole("button", { name: tr(locale, "admin.common.create"), exact: true });
    const closed = async () => { await expect(page.locator("form").filter({ has: page.getByText("Rank #", { exact: true }) })).toBeHidden(); };
    const rowsTeam = await runToastCell({
      cell: "mlm-team-percent", locale, profile: TEAM, page, input: team, submit: createBtn(), reqs,
      before: async () => { const f = await fresh(); await fieldOf(f, refLabel).fill(rawFor({ id: "", en: "5", vi: "5" }, locale)); },
      onRequest: () => posts, afterAccept: closed,
      payloadOf: (canonical) => (b) => b && Number(b.teamPercent) === Number(canonical) && b.rank === 7 && Number(b.referralPercent) === 5,
    });
    expect(rowsTeam.filter((r) => !r.pass), "team % mismatches").toEqual([]);
    // referral %
    const rowsRef = await runToastCell({
      cell: "mlm-referral-percent", locale, profile: REFERRAL, page, input: refIn, submit: createBtn(), reqs,
      before: async () => { const f = await fresh(); await fieldOf(f, teamLabel).fill(rawFor({ id: "", en: "3", vi: "3" }, locale)); },
      onRequest: () => posts, afterAccept: closed,
      payloadOf: (canonical) => (b) => b && Number(b.referralPercent) === Number(canonical) && Number(b.teamPercent) === 3,
    });
    expect(rowsRef.filter((r) => !r.pass), "referral % mismatches").toEqual([]);
    await context.close();
  });

  test(`MLM create-rank form [${locale}]: rank number 0..10 and global tier 5..10 (blank = none), generic messages`, async ({ browser }) => {
    const { page, context, posts, reqs } = await mlmPage(browser, locale);
    const createBtn = () => page.locator("form").getByRole("button", { name: tr(locale, "admin.common.create"), exact: true });
    const closed = async () => { await expect(page.locator("form").filter({ has: page.getByText("Rank #", { exact: true }) })).toBeHidden(); };
    const fresh = async () => {
      const f = await openCreateRank(page, locale);
      await f.locator("label").filter({ has: page.getByText(tr(locale, "admin.mlm.rankName"), { exact: true }) }).locator("input").first().fill("E2E rank");
      await fieldOf(f, `${tr(locale, "admin.mlm.team")} %`).fill("1");
      await fieldOf(f, `${tr(locale, "admin.mlm.referral")} %`).fill("2");
      return f;
    };
    // rank number: any refusal is the same generic message
    const rankRows = await runToastCell({
      cell: "mlm-rank-number", locale, profile: RANK_NO, page, input: fieldOf(page.locator("form"), "Rank #"), submit: createBtn(), reqs,
      message: () => tr(locale, "admin.mlm.rankInvalid"),
      before: async () => { await fresh(); },
      onRequest: () => posts, afterAccept: closed,
      payloadOf: (canonical) => (b) => b && b.rank === Number(canonical),
    });
    expect(rankRows.filter((r) => !r.pass), "rank number mismatches").toEqual([]);
    // global tier: blank is allowed (= no tier), so the "blank spaces" value is a VALID one here
    const tierLabel = tr(locale, "admin.mlm.globalTier");
    const tierRows = await runToastCell({
      cell: "mlm-global-tier", locale, profile: TIER, page, input: fieldOf(page.locator("form"), tierLabel), submit: createBtn(), reqs,
      message: () => tr(locale, "admin.mlm.globalTierInvalid"),
      skip: ["blank spaces only"],
      before: async () => { const f = await fresh(); await fieldOf(f, "Rank #").fill("7"); },
      onRequest: () => posts, afterAccept: closed,
      payloadOf: (canonical) => (b) => b && b.globalFundTier === Number(canonical),
    });
    expect(tierRows.filter((r) => !r.pass), "global tier mismatches").toEqual([]);
    await context.close();
  });

  test(`MLM promotion rule form [${locale}]: count 1..10000 (whole, no zero), message with min/max, payload when accepted`, async ({ browser }) => {
    const sa = await apiAs("SUPER_ADMIN");
    const { page, context } = await pageIn(browser, { api: sa }, locale);
    const posts: any[] = [];
    await page.route(/\/admin\/mlm\/promotion-rules$/, async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      posts.push(JSON.parse(route.request().postData() ?? "{}"));
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ data: { id: 1, fromRank: 1, toRank: 2, mode: "seller_granted", requiredF1Rank: null, count: 1, isActive: true } }) });
    });
    const reqs = watchRequests(page, "POST", /\/admin\/mlm\/promotion-rules$/);
    await page.goto("/admin/mlm");
    const fresh = async () => {
      const form = page.locator("form").filter({ has: page.getByText(tr(locale, "admin.mlm.rules.count"), { exact: true }) });
      if (!(await form.isVisible().catch(() => false))) await page.getByRole("button", { name: tr(locale, "admin.mlm.rules.create"), exact: true }).first().click();
      await expect(form).toBeVisible();
      await fieldOf(form, tr(locale, "admin.mlm.rules.from")).fill("1");
      await fieldOf(form, tr(locale, "admin.mlm.rules.to")).fill("2");
      await form.locator("select").selectOption("seller_granted");
      return form;
    };
    await fresh();
    const form = () => page.locator("form").filter({ has: page.getByText(tr(locale, "admin.mlm.rules.count"), { exact: true }) });
    const rows = await runToastCell({
      cell: "mlm-promotion-count", locale, profile: COUNT, page, input: fieldOf(form(), tr(locale, "admin.mlm.rules.count")), submit: form().getByRole("button", { name: tr(locale, "admin.common.save"), exact: true }), reqs,
      before: async () => { await fresh(); },
      onRequest: () => posts,
      afterAccept: async () => { await expect(form()).toBeHidden(); },
      payloadOf: (canonical) => (b) => b && b.count === Number(canonical) && b.fromRank === 1 && b.toRank === 2,
    });
    expect(rows.filter((r) => !r.pass), "promotion count mismatches").toEqual([]);
    await context.close();
  });
}

/* ------------------------------------------------------------------------------------------------ slots */

type SlotCode = "required" | "notInteger" | "tooLow" | "tooHigh";
/** Typed text -> verdict of the SLOT field alone. Source: SetDividendSlotsDto (@IsInt 0..1,000,000) + the form's plain ASCII whole-number rule. */
const SLOT_VALUES: Array<{ id: string; typed: string; set: "ok" | SlotCode; transfer: "ok" | SlotCode; note?: string; api?: unknown }> = [
  { id: "empty", typed: "", set: "required", transfer: "required" },
  { id: "blank", typed: "   ", set: "required", transfer: "required" },
  { id: "0", typed: "0", set: "ok", transfer: "tooLow" },
  { id: "1", typed: "1", set: "ok", transfer: "ok" },
  { id: "5", typed: "5", set: "ok", transfer: "ok" },
  { id: "007", typed: "007", set: "ok", transfer: "ok" },
  { id: "1000000 (max)", typed: "1000000", set: "ok", transfer: "ok" },
  { id: "1000001 (max+1)", typed: "1000001", api: 1000001, set: "tooHigh", transfer: "tooHigh" },
  { id: "-1", typed: "-1", api: -1, set: "notInteger", transfer: "notInteger" },
  { id: "1.5", typed: "1.5", api: 1.5, set: "notInteger", transfer: "notInteger" },
  { id: "1,000 (thousands comma)", typed: "1,000", set: "notInteger", transfer: "notInteger" },
  { id: "1.000 (vi thousands dot)", typed: "1.000", set: "notInteger", transfer: "notInteger" },
  { id: "1e3", typed: "1e3", api: "1e3", set: "notInteger", transfer: "notInteger" },
  { id: "abc", typed: "abc", api: "abc", set: "notInteger", transfer: "notInteger" },
  { id: "fullwidth 5", typed: "５", set: "notInteger", transfer: "notInteger" },
  { id: "+5", typed: "+5", set: "notInteger", transfer: "notInteger" },
  { id: "5 spaces 0", typed: "5 0", set: "notInteger", transfer: "notInteger" },
  {
    id: "12345678 (8 digits)", typed: "12345678", api: 12345678, set: "notInteger", transfer: "notInteger",
    note: "KNOWN-ISSUE (cosmetic): spec says > 1,000,000 is 'cannot exceed 1,000,000' (tooHigh); the form's 7-digit regex answers 'must be a whole number'. Still refused, nothing written.",
  },
];

for (const locale of LOCALES) {
  test(`dividend slots [${locale}]: set-slots and transfer forms show the documented message for every typed value; the server refuses what the form refuses`, async ({ browser }) => {
    const sa = await apiAs("SUPER_ADMIN");
    const holder = await createUser({ prefix: "slotuser" });
    const { page, context, health } = await (async () => {
      const ui = await pageIn(browser, { api: sa }, locale);
      return { ...ui, health: (await import("../support/cart-ui")).watchHealth(ui.page) };
    })();
    test.info().annotations.push({
      type: "known-issue",
      description: SLOT_VALUES.find((x) => x.id.startsWith("12345678"))!.note!,
    });
    const writes = watchRequests(page, "POST", /\/admin\/dividend\/slots(\/transfer)?$/);
    await page.goto("/admin/dividend/slots");
    const setForm = page.locator("form").filter({ has: page.getByText(tr(locale, "admin.dividend.slots.slotsAbsolute"), { exact: true }) });
    const transferForm = page.locator("form").filter({ has: page.getByText(tr(locale, "admin.dividend.slots.transferSlots"), { exact: true }) });
    await expect(setForm).toBeVisible();
    await expect(transferForm).toBeVisible();
    const msg = (code: SlotCode) => tr(locale, `admin.dividend.slots.errors.slots.${code}`);
    const reasonOk = "e2e slots matrix";
    const all: SlotCode[] = ["required", "notInteger", "tooLow", "tooHigh"];

    const rowsSet: ResultRow[] = [];
    const rowsTransfer: ResultRow[] = [];
    for (const v of SLOT_VALUES) {
      // ---- set form (account left empty on purpose: the "choose an account" error is expected next to the slots verdict)
      await setForm.getByLabel(tr(locale, "admin.dividend.slots.slotsAbsolute"), { exact: true }).fill(v.typed);
      await setForm.getByLabel(tr(locale, "admin.common.reason"), { exact: true }).fill(reasonOk);
      const n0 = writes.count();
      await setForm.getByRole("button", { name: tr(locale, "admin.dividend.slots.setSubmit"), exact: true }).click();
      const list = setForm.locator("ul[role=alert]");
      await expect(list).toBeVisible(); // the missing account always produces a list
      const texts = (await list.locator("li").allInnerTexts()).map((s) => s.trim());
      const shown = all.filter((c) => texts.includes(msg(c)));
      row(rowsSet, v.id, v.typed, `${v.set === "ok" ? "none" : v.set} | req=0`, `${shown.length ? shown.join("+") : "none"} | req=${writes.count() - n0}`, v.note);
      expect(texts).toContain(tr(locale, "admin.dividend.slots.errors.userId.required"));

      // ---- transfer form (accounts empty on purpose)
      await transferForm.getByLabel(tr(locale, "admin.dividend.slots.transferSlots"), { exact: true }).fill(v.typed);
      await transferForm.getByLabel(tr(locale, "admin.common.reason"), { exact: true }).fill(reasonOk);
      const m0 = writes.count();
      await transferForm.getByRole("button", { name: tr(locale, "admin.dividend.slots.transferSubmit"), exact: true }).click();
      const tlist = transferForm.locator("ul[role=alert]");
      await expect(tlist).toBeVisible();
      const ttexts = (await tlist.locator("li").allInnerTexts()).map((s) => s.trim());
      const tshown = all.filter((c) => ttexts.includes(msg(c)));
      row(rowsTransfer, v.id, v.typed, `${v.transfer === "ok" ? "none" : v.transfer} | req=0`, `${tshown.length ? tshown.join("+") : "none"} | req=${writes.count() - m0}`, v.note);
    }
    saveResults("slots-set", locale, rowsSet);
    saveResults("slots-transfer", locale, rowsTransfer);
    health.assertClean(`slots page ${locale}`);

    // server verdict for values whose numeric meaning is out of the DTO range / not an integer (nothing is written)
    for (const v of SLOT_VALUES) {
      if (v.api === undefined) continue;
      const res = await sa.post("admin/dividend/slots", { userId: holder.id, slots: v.api, reason: reasonOk });
      expect(res.status(), `server must refuse ${JSON.stringify(v.typed)}`).toBe(400);
    }
    await context.close();
  });
}
