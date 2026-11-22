import fs from "node:fs";
import path from "node:path";
import type { Browser, BrowserContext, Page, Request } from "@playwright/test";
import { expect } from "@playwright/test";
import type { Api } from "./api";
import { ok, freshIp } from "./api";
import { latestOtp } from "./otp";

/**
 * Support for flow 14 (money / number / percent inputs). Everything here is independent of lib/money.ts on purpose:
 * the expectation table (VALUES + expectMoney) is written from .forge/MONEY-INPUT-AUDIT.md and TEST-GUIDE section 8,
 * so a regression in the parser cannot also change the oracle. Messages come from lib/i18n/locales/<locale>.json by key.
 */

export const LOCALES = ["en", "vi", "zh-TW"] as const;
export type Locale = (typeof LOCALES)[number];

// ---------------------------------------------------------------------------------------------------------------------
// i18n (strings are read from the product's own locale files; never hard-coded)
// ---------------------------------------------------------------------------------------------------------------------
const dicts = new Map<string, any>();
function dict(locale: Locale): any {
  let d = dicts.get(locale);
  if (!d) {
    d = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "lib", "i18n", "locales", `${locale}.json`), "utf8"));
    dicts.set(locale, d);
  }
  return d;
}
/** Translate `key` ("a.b.c") for `locale`, replacing `{var}` placeholders exactly like LanguageProvider.t. Throws on a missing key. */
export function tr(locale: Locale, key: string, vars?: Record<string, string>): string {
  let node: any = dict(locale);
  for (const part of key.split(".")) node = node?.[part];
  if (typeof node !== "string") throw new Error(`i18n key ${key} missing in ${locale}`);
  let text = node;
  if (vars) for (const [k, v] of Object.entries(vars)) text = text.replace(`{${k}}`, v);
  return text;
}

export type MoneyCode =
  | "EMPTY" | "INVALID_CHARS" | "AMBIGUOUS_FORMAT" | "TOO_MANY_DECIMALS" | "NEGATIVE_NOT_ALLOWED"
  | "ZERO_NOT_ALLOWED" | "TOO_LARGE" | "BELOW_MIN" | "ABOVE_MAX";

/** Exact inline message for a parser error code (keys per MONEY-INPUT-AUDIT; the "example" follows the doc: 1,234.50 en / 1.234,50 vi). */
export function moneyMsg(locale: Locale, code: MoneyCode, o: { maxDecimals?: number; min?: number; max?: number | string } = {}): string {
  const md = o.maxDecimals ?? 2;
  const vi = locale === "vi";
  const example = md === 0 ? (vi ? "1.000" : "1,000") : `${vi ? "1.234," : "1,234."}${"50".padEnd(md, "0").slice(0, md)}`;
  switch (code) {
    case "EMPTY": return tr(locale, "moneyInput.empty");
    case "INVALID_CHARS": return tr(locale, "moneyInput.invalidChars", { example });
    case "AMBIGUOUS_FORMAT": return tr(locale, "moneyInput.ambiguousFormat", { example });
    case "TOO_MANY_DECIMALS": return tr(locale, "moneyInput.tooManyDecimals", { maxDecimals: String(md), example });
    case "NEGATIVE_NOT_ALLOWED": return tr(locale, "moneyInput.negativeNotAllowed");
    case "ZERO_NOT_ALLOWED": return tr(locale, "moneyInput.zeroNotAllowed");
    case "TOO_LARGE": return tr(locale, "moneyInput.tooLarge");
    case "BELOW_MIN": return tr(locale, "moneyInput.belowMin", { min: String(o.min ?? 0) });
    case "ABOVE_MAX": return tr(locale, "moneyInput.aboveMax", { max: String(o.max ?? "") });
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Value matrix (what a person types). `en` is used for en and zh-TW, `vi` for vi.
// `fmt` = locale-format-level verdict independent of the cell; int/frac/neg = the number the text means when well formed.
// ---------------------------------------------------------------------------------------------------------------------
export interface MoneyValue {
  id: string;
  en: string;
  vi: string;
  fmt?: { en?: MoneyCode; vi?: MoneyCode };
  neg?: boolean;
  int?: string;
  frac?: string;
  /** thousands separator AND a decimal part ("1,234.50"): at 0 decimals this is TOO_MANY_DECIMALS, never AMBIGUOUS */
  grouped?: boolean;
  /** well-formed and in range for most cells but larger than any test wallet: submit is allowed to fail on the server (balance) */
  big?: boolean;
}
const bothFmt = (c: MoneyCode) => ({ en: c, vi: c });

export const VALUES: MoneyValue[] = [
  // valid shapes
  { id: "100", en: "100", vi: "100", int: "100" },
  { id: "100.5", en: "100.5", vi: "100,5", int: "100", frac: "5" },
  { id: "100.50", en: "100.50", vi: "100,50", int: "100", frac: "50" },
  { id: "1,234.50 (en) / 1.234,50 (vi)", en: "1,234.50", vi: "1.234,50", int: "1234", frac: "50", grouped: true },
  { id: "1,234 (en) / 1.234 (vi) thousands", en: "1,234", vi: "1.234", int: "1234" },
  { id: "leading zeros 007", en: "007", vi: "007", int: "7" },
  { id: "padded with spaces", en: "  123.45  ", vi: "  123,45  ", int: "123", frac: "45" },
  { id: "fullwidth digits", en: "１２３．４５", vi: "１２３，４５", int: "123", frac: "45" },
  { id: "zero-width space inside", en: "1​00", vi: "1​00", int: "100" },
  { id: "trailing NBSP", en: "100 ", vi: "100 ", int: "100" },
  { id: "999999999999.99 max", en: "999999999999.99", vi: "999999999999,99", int: "999999999999", frac: "99", big: true },
  // zero / sign
  { id: "0", en: "0", vi: "0", int: "0" },
  { id: "0.00", en: "0.00", vi: "0,00", int: "0", frac: "00" },
  { id: "-5", en: "-5", vi: "-5", neg: true, int: "5" },
  { id: "-0", en: "-0", vi: "-0", neg: true, int: "0" },
  { id: "+5", en: "+5", vi: "+5", fmt: bothFmt("INVALID_CHARS") },
  // precision
  { id: "1.234 (en) / 1,234 (vi) literal", en: "1.234", vi: "1,234", int: "1", frac: "234" },
  { id: "100.555", en: "100.555", vi: "100,555", int: "100", frac: "555" },
  { id: "0.001", en: "0.001", vi: "0,001", int: "0", frac: "001" },
  // junk
  { id: "1e3", en: "1e3", vi: "1e3", fmt: bothFmt("INVALID_CHARS") },
  { id: "abc", en: "abc", vi: "abc", fmt: bothFmt("INVALID_CHARS") },
  { id: "12abc", en: "12abc", vi: "12abc", fmt: bothFmt("INVALID_CHARS") },
  { id: ".5", en: ".5", vi: ",5", fmt: bothFmt("INVALID_CHARS") },
  { id: "5.", en: "5.", vi: "5,", fmt: bothFmt("INVALID_CHARS") },
  { id: "NaN", en: "NaN", vi: "NaN", fmt: bothFmt("INVALID_CHARS") },
  { id: "Infinity", en: "Infinity", vi: "Infinity", fmt: bothFmt("INVALID_CHARS") },
  { id: "space inside number", en: "1 000", vi: "1 000", fmt: bothFmt("INVALID_CHARS") },
  { id: "NT$100", en: "NT$100", vi: "NT$100", fmt: bothFmt("INVALID_CHARS") },
  { id: "$50", en: "$50", vi: "$50", fmt: bothFmt("INVALID_CHARS") },
  { id: "100d", en: "100đ", vi: "100đ", fmt: bothFmt("INVALID_CHARS") },
  { id: "blank spaces only", en: "   ", vi: "   ", fmt: bothFmt("EMPTY") },
  // wrong separators for the language
  { id: "1234.50 (vi ambiguous) / 1234,50 (en ambiguous)", en: "1234,50", vi: "1234.50", fmt: bothFmt("AMBIGUOUS_FORMAT") },
  { id: "100,5 (en) / 100.5 (vi) swapped separators", en: "100,5", vi: "100.5", fmt: bothFmt("AMBIGUOUS_FORMAT") },
  { id: "1,23,4 bad grouping", en: "1,23,4", vi: "1.23.4", fmt: bothFmt("AMBIGUOUS_FORMAT") },
  // size
  { id: "13 digits", en: "1000000000000", vi: "1000000000000", int: "1000000000000" },
  { id: "1000000000000.00", en: "1000000000000.00", vi: "1000000000000,00", int: "1000000000000", frac: "00" },
  { id: "9999999999.99 numeric(12,2) max", en: "9999999999.99", vi: "9999999999,99", int: "9999999999", frac: "99", big: true },
  { id: "10000000000.00 just above numeric(12,2)", en: "10000000000.00", vi: "10000000000,00", int: "10000000000", frac: "00", big: true },
  { id: "10000000000 (11 digits, just above numeric(12,2))", en: "10000000000", vi: "10000000000", int: "10000000000", big: true },
  { id: "1000000 (1e6, adjust max)", en: "1000000", vi: "1000000", int: "1000000" },
  { id: "-1000000 (adjust min)", en: "-1000000", vi: "-1000000", neg: true, int: "1000000" },
  { id: "9999999999 (SKU price max, integer)", en: "9999999999", vi: "9999999999", int: "9999999999" },
  { id: "1000001 (just above 1e6)", en: "1000001", vi: "1000001", int: "1000001" },
  { id: "-1000001 (just below -1e6)", en: "-1000001", vi: "-1000001", neg: true, int: "1000001" },
];

export interface MoneyProfile { maxDec: number; allowZero: boolean; allowNeg: boolean; min?: number; max?: number }

export type MoneyExpect = { ok: true; canonical: string; value: number } | { ok: false; code: MoneyCode };

/** Verdict the documented rules give for `v` typed in `locale` on a cell with `p` (order of checks as documented). */
export function expectMoney(v: MoneyValue, locale: Locale, p: MoneyProfile): MoneyExpect {
  const fc = v.fmt?.[locale === "vi" ? "vi" : "en"];
  if (fc) return { ok: false, code: fc };
  const frac = v.frac ?? "";
  const int = (v.int ?? "0").replace(/^0+(?=\d)/, "") || "0";
  if (frac.length > p.maxDec) {
    // 0-decimal cells: a bare 3-digit fraction ("1.234", "0.001") could be a thousands group => AMBIGUOUS_FORMAT, anything else TOO_MANY_DECIMALS
    if (p.maxDec === 0 && frac.length === 3 && !v.grouped) return { ok: false, code: "AMBIGUOUS_FORMAT" };
    return { ok: false, code: "TOO_MANY_DECIMALS" };
  }
  const zero = int === "0" && /^0*$/.test(frac);
  const neg = !!v.neg;
  if (neg && zero) return { ok: false, code: !p.allowNeg ? "NEGATIVE_NOT_ALLOWED" : p.allowZero ? "INVALID_CHARS" : "ZERO_NOT_ALLOWED" };
  if (neg && !p.allowNeg) return { ok: false, code: "NEGATIVE_NOT_ALLOWED" };
  if (zero && !p.allowZero) return { ok: false, code: "ZERO_NOT_ALLOWED" };
  if (int.length > 12) return { ok: false, code: "TOO_LARGE" };
  const canonical = `${neg && !zero ? "-" : ""}${int}${frac ? "." + frac : ""}`;
  const value = Number(canonical);
  if (p.min != null && value < p.min) return { ok: false, code: "BELOW_MIN" };
  if (p.max != null && value > p.max) return { ok: false, code: "ABOVE_MAX" };
  return { ok: true, canonical, value };
}
export const rawFor = (v: MoneyValue, locale: Locale): string => (locale === "vi" ? v.vi : v.en);
export const centsOf = (canonical: string): bigint => {
  const neg = canonical.startsWith("-");
  const [w, f = ""] = (neg ? canonical.slice(1) : canonical).split(".");
  const c = BigInt(w) * 100n + BigInt(f.padEnd(2, "0").slice(0, 2));
  return neg ? -c : c;
};

// ---------------------------------------------------------------------------------------------------------------------
// Browser helpers
// ---------------------------------------------------------------------------------------------------------------------
/** Page logged in as the owner of `who.api`, UI language `locale` fixed via localStorage `mq-lang` before any page script runs. */
export async function pageIn(browser: Browser, who: { api: Api }, locale: Locale): Promise<{ page: Page; context: BrowserContext }> {
  const storageState = await who.api.ctx.storageState();
  // own X-Forwarded-For per browser: the backend throttles 100 req/min per client IP and every page load calls users/me; a shared IP
  // makes the SPA see a 429 as "logged out" and redirect to /login when many tests run in parallel.
  const context = await browser.newContext({ storageState, baseURL: "http://localhost:3000", viewport: { width: 1280, height: 900 }, extraHTTPHeaders: { "x-forwarded-for": freshIp() } });
  await context.addInitScript((l) => { try { localStorage.setItem("mq-lang", l); } catch { /* ignore */ } }, locale);
  return { page: await context.newPage(), context };
}

/** Collects requests matching method + url regex (page.on('request')). */
export function watchRequests(page: Page, method: string, url: RegExp): { all: Request[]; count: () => number } {
  const all: Request[] = [];
  page.on("request", (r) => { if (r.method() === method && url.test(r.url())) all.push(r); });
  return { all, count: () => all.length };
}

/** The wallet PIN of a fresh user (OTP from the backend log). */
export async function setWalletPin(user: { api: Api; id: string }, pin = "123456"): Promise<void> {
  await ok(await user.api.post("wallet/pin/request-otp", {}));
  const otp = await latestOtp(user.id); // logged as "Dev OTP (wallet-pin) for <userId>", not the email
  await ok(await user.api.post("wallet/pin/confirm", { otp, pin, confirmPin: pin }));
}

// ---------------------------------------------------------------------------------------------------------------------
// Result log: one JSON file per (cell, locale); the lead / report aggregates them (e2e/.run/money-inputs/*.json)
// ---------------------------------------------------------------------------------------------------------------------
export interface ResultRow { value: string; typed: string; expected: string; actual: string; pass: boolean; note?: string }
const RESULT_DIR = path.join(__dirname, "..", ".run", "money-inputs");
export function saveResults(cell: string, locale: string, rows: ResultRow[]): void {
  fs.mkdirSync(RESULT_DIR, { recursive: true });
  const safe = `${cell}__${locale}`.replace(/[^\w.-]+/g, "_");
  fs.writeFileSync(path.join(RESULT_DIR, `${safe}.json`), JSON.stringify({ cell, locale, rows }, null, 1));
}

/** Soft-assert helper that also records the row. `actual` is a short string describing what the UI did. */
export function row(rows: ResultRow[], v: string, typed: string, expected: string, actual: string, note?: string): boolean {
  const pass = expected === actual;
  rows.push({ value: v, typed, expected, actual, pass, note });
  expect.soft(actual, `${v} typed ${JSON.stringify(typed)}${note ? " (" + note + ")" : ""}`).toBe(expected);
  return pass;
}

// ---------------------------------------------------------------------------------------------------------------------
// Generic runner: invalid values on a text field whose error is shown by the product (inline alert or banner)
// ---------------------------------------------------------------------------------------------------------------------
import type { Locator } from "@playwright/test";

export interface InlineCell {
  cell: string;
  locale: Locale;
  profile: MoneyProfile;
  /** options passed to moneyMsg (maxDecimals / min / max shown in the message) */
  msgOpts?: { maxDecimals?: number; min?: number; max?: number | string };
  page: Page;
  input: Locator;
  submit: Locator;
  /** where the product shows the error for this cell */
  alert: Locator;
  /** requests that must NOT happen for a rejected value */
  reqs: { count: () => number };
  /** values to skip (id) */
  skip?: string[];
  /** run before each value (e.g. refill sibling fields that a failed attempt may have cleared) */
  before?: () => Promise<void>;
}

/** Types every value the documented rules reject, clicks submit, and checks: exact message, text kept, zero requests. Returns the rows. */
export async function runInvalidValues(c: InlineCell): Promise<ResultRow[]> {
  const rows: ResultRow[] = [];
  for (const v of VALUES) {
    if (c.skip?.includes(v.id)) continue;
    const exp = expectMoney(v, c.locale, c.profile);
    if (exp.ok) continue;
    const raw = rawFor(v, c.locale);
    await c.before?.();
    await c.input.fill(raw);
    const n0 = c.reqs.count();
    await c.submit.click();
    let msg: string;
    try {
      await c.alert.first().waitFor({ state: "visible", timeout: 3000 });
      msg = ((await c.alert.first().innerText()) ?? "").trim();
    } catch { msg = "(no message)"; }
    const kept = (await c.input.inputValue()) === raw;
    const actual = `${msg} | kept=${kept} | req=${c.reqs.count() - n0}`;
    const expected = `${moneyMsg(c.locale, exp.code, c.msgOpts ?? { maxDecimals: c.profile.maxDec, min: c.profile.min, max: c.profile.max })} | kept=true | req=0`;
    row(rows, v.id, raw, expected, actual, exp.code);
  }
  saveResults(c.cell + "/invalid", c.locale, rows);
  return rows;
}
