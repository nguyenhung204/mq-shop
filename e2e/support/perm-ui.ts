import type { Browser, BrowserContext, BrowserContextOptions, Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { AUTH_DIR, WEB, type RoleName } from "./env";
import { apiAs, freshIp } from "./api";

export type Viewer = RoleName | "GUEST";
export type Lang = "en" | "vi" | "zh-TW";

/**
 * Browser context for one seed role (or a guest) with its own client IP (the browser calls :3005 directly,
 * so the x-forwarded-for header reaches the throttler), UI language and region fixed so no gate overlay shows.
 * Never logs out / refreshes: the .auth/*.json sessions are shared with other agents.
 */
export async function viewerContext(
  browser: Browser,
  who: Viewer,
  opts: { lang?: Lang | null; width?: number; height?: number; region?: string | null; storageState?: BrowserContextOptions["storageState"] } = {},
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    storageState: opts.storageState ?? (who === "GUEST" ? undefined : path.join(AUTH_DIR, `${who}.json`)),
    baseURL: WEB,
    viewport: { width: opts.width ?? 1280, height: opts.height ?? 800 },
    extraHTTPHeaders: { "x-forwarded-for": freshIp() },
  });
  // lang === null: leave unset (shows the language/region gate); region === null: leave unset
  await context.addInitScript(([lang, region]) => {
    try {
      if (lang) localStorage.setItem("mq-lang", lang as string);
      if (region) localStorage.setItem("mq-region", region as string);
    } catch { /* ignore */ }
  }, [opts.lang === undefined ? "en" : opts.lang, opts.region === undefined ? "tw" : opts.region]);
  return { context, page: await context.newPage() };
}

// ---------------------------------------------------------------------------------------------------------------
// Route discovery (from mq-shop/app) and real ids
// ---------------------------------------------------------------------------------------------------------------

const APP_DIR = path.join(__dirname, "..", "..", "app");

/** Every `page.tsx` under mq-shop/app as a route pattern: `/admin/shops/[id]`, `/` ... (sorted). */
export function listAppRoutes(): string[] {
  const out: string[] = [];
  const walk = (dir: string, rel: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) walk(path.join(dir, e.name), `${rel}/${e.name}`);
      else if (e.name === "page.tsx") out.push(rel === "" ? "/" : rel);
    }
  };
  walk(APP_DIR, "");
  return out.sort();
}

export const NIL_UUID = "00000000-0000-4000-8000-000000000001";

export interface RealIds {
  /** param name -> a real id when one exists (read from the lists as SUPER_ADMIN); NIL_UUID/"2026Q4" otherwise */
  values: Record<string, string>;
  /** names of params that fell back to a made-up id */
  fallback: string[];
}

/** Read real ids from the list endpoints (read-only). Cheap; call from beforeAll. */
export async function discoverIds(): Promise<RealIds> {
  const sa = await apiAs("SUPER_ADMIN");
  const first = async (url: string, pick: (j: any) => string | undefined): Promise<string | undefined> => {
    try {
      const r = await sa.get(url);
      if (!r.ok()) return undefined;
      return pick(await r.json());
    } catch { return undefined; }
  };
  const idOfFirst = (j: any) => { const d = j?.data; const arr = Array.isArray(d) ? d : d?.items; return arr?.[0]?.id; };
  const found: Record<string, string | undefined> = {
    shop: await first("admin/shops?pageSize=1", idOfFirst),
    user: await first("admin/users?pageSize=1", idOfFirst),
    rma: await first("admin/rma?pageSize=1", idOfFirst),
    order: await first("admin/orders?pageSize=1", idOfFirst),
    refundCase: await first("admin/refund-cases?pageSize=1", idOfFirst),
    sellerPayout: await first("admin/payouts?pageSize=1", idOfFirst),
    walletPayout: await first("admin/wallet/payouts?pageSize=1", idOfFirst),
    transfer: await first("inventory/transfers?pageSize=1", idOfFirst),
  };
  await sa.dispose();
  const fallback: string[] = [];
  const v = (k: string) => { if (!found[k]) fallback.push(k); return found[k] ?? NIL_UUID; };
  return {
    values: { shop: v("shop"), user: v("user"), rma: v("rma"), order: v("order"), refundCase: v("refundCase"), sellerPayout: v("sellerPayout"), walletPayout: v("walletPayout"), transfer: v("transfer"), quarter: "2026Q4" },
    fallback,
  };
}

/** Which id kind each dynamic route uses. */
const PARAM_KIND: Array<[RegExp, string]> = [
  [/^\/admin\/accounts\/\[id\]/, "user"],
  [/^\/admin\/customers\/\[id\]/, "user"],
  [/^\/admin\/payouts\/\[id\]/, "sellerPayout"],
  [/^\/admin\/refund-cases\/\[id\]/, "refundCase"],
  [/^\/admin\/rma\/\[id\]/, "rma"],
  [/^\/admin\/shops\/\[id\]/, "shop"],
  [/^\/admin\/transfers\/\[id\]/, "transfer"],
  [/^\/admin\/wallet\/payouts\/\[id\]/, "walletPayout"],
  [/^\/admin\/dividend\/settlements\/\[quarter\]/, "quarter"],
  [/^\/seller\/inventory\/transfers\/\[id\]/, "transfer"],
  [/^\/seller\/wallet\/withdrawals\/\[id\]/, "walletPayout"],
  [/^\/orders\/\[id\]/, "order"],
  [/^\/shops\/\[id\]/, "shop"],
  [/^\/wallet\/withdrawals\/\[id\]/, "walletPayout"],
  [/^\/dividend-credits\/\[id\]/, "refundCase"],
];

export function fillRoute(pattern: string, ids: RealIds): string {
  const kind = PARAM_KIND.find(([re]) => re.test(pattern))?.[1];
  return pattern.replace(/\[(\w+)\]/g, () => (kind ? ids.values[kind] : NIL_UUID));
}

// ---------------------------------------------------------------------------------------------------------------
// Settling after navigation (no fixed sleeps)
// ---------------------------------------------------------------------------------------------------------------

/**
 * Wait until the role guard has decided: either the browser left the page (router.replace) or the AuthGuard
 * placeholder ("Loading…" / raw key before the language is ready) is gone. Returns the final pathname.
 */
export async function settleAfterGoto(page: Page, timeoutMs = 20_000): Promise<string> {
  const start = new URL(page.url()).pathname;
  await page.waitForFunction(
    (p0) => {
      if (location.pathname !== p0) return true;
      const holders = Array.from(document.querySelectorAll("div.py-20.text-center"));
      const stuck = holders.some((d) => /^(Loading…|admin\.common\.loading)$/.test((d.textContent ?? "").trim()));
      return !stuck && document.body.innerText.trim().length > 0;
    },
    start,
    { timeout: timeoutMs },
  );
  return new URL(page.url()).pathname;
}

// ---------------------------------------------------------------------------------------------------------------
// Quiet page: no API request in flight (the notifications SSE stream is ignored: it never ends)
// ---------------------------------------------------------------------------------------------------------------
export interface Inflight { size(): number }
export function trackInflight(page: Page): Inflight {
  const open = new Set<unknown>();
  const relevant = (url: string) => url.includes(":3005/api/") && !url.includes("/notifications/stream");
  page.on("request", (r) => { if (relevant(r.url())) open.add(r); });
  const done = (r: unknown) => { open.delete(r); };
  page.on("requestfinished", done);
  page.on("requestfailed", done);
  return { size: () => open.size };
}

/** Wait until the page has made no API request for 3 consecutive 100 ms checks and two animation frames have passed. */
export async function waitQuiet(page: Page, inflight: Inflight, timeoutMs = 15_000): Promise<void> {
  const start = Date.now();
  let calm = 0;
  while (calm < 3) {
    if (Date.now() - start > timeoutMs) throw new Error("page never went quiet (API requests still in flight)");
    calm = inflight.size() === 0 ? calm + 1 : 0;
    await page.waitForTimeout(100);
  }
  await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
}

// ---------------------------------------------------------------------------------------------------------------
// i18n raw-key detector and layout overflow probe (flow 16; reused by flow 17)
// ---------------------------------------------------------------------------------------------------------------
function flatten(obj: unknown, prefix = "", out: Set<string> = new Set()): Set<string> {
  if (obj && typeof obj === "object") for (const [k, v] of Object.entries(obj)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  else out.add(prefix);
  return out;
}
let keySet: Set<string> | null = null;
/** Every translation key path of en / vi / zh-TW (a raw key shown to the user is exactly one of these, or a typo of one). */
export function allI18nKeys(): Set<string> {
  if (keySet) return keySet;
  keySet = new Set();
  for (const l of ["en", "vi", "zh-TW"]) {
    const j = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "lib", "i18n", "locales", `${l}.json`), "utf8"));
    flatten(j, "", keySet);
  }
  return keySet;
}

/**
 * Allowlist for the generic a.b.c pattern. Each entry says why a dotted token is legitimate text, not a missing translation.
 * (Emails and URLs are removed before matching, so they need no entry.)
 */
export const RAW_KEY_ALLOWLIST: Array<{ re: RegExp; why: string }> = [
  { re: /^(www|api)\./, why: "host names such as www.example.com are content, not keys" },
  { re: /\.(com|org|net|io|tw|vn|my|sg|test|pdf|png|jpg|csv|zip|json)$/i, why: "file names and domains (e.g. refund-cases.csv, shop.example.com)" },
];

/** Dotted tokens in `text` that look like a translation key: a known key, or a lower-camel a.b.c (>= 3 segments). */
export function findRawKeys(text: string): string[] {
  const cleaned = text.replace(/\S+@\S+/g, " ").replace(/https?:\/\/\S+/g, " ");
  const known = allI18nKeys();
  const found = new Set<string>();
  for (const m of cleaned.matchAll(/[A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z0-9_]+)+/g)) {
    const tok = m[0].replace(/\.+$/, "");
    if (known.has(tok)) { found.add(tok); continue; }
    if (/^[a-z][a-zA-Z0-9]*(?:\.[a-zA-Z][a-zA-Z0-9_]{1,})(?:\.[a-zA-Z][a-zA-Z0-9_]{1,})+$/.test(tok) && !RAW_KEY_ALLOWLIST.some((a) => a.re.test(tok))) found.add(tok);
  }
  return [...found];
}

/** Visible text plus the user-facing attributes (placeholder, aria-label, title, alt). */
export async function visibleTextOf(page: Page): Promise<string> {
  return page.evaluate(() => {
    const attrs = Array.from(document.querySelectorAll("[placeholder],[aria-label],[title],img[alt]")).flatMap((e) =>
      ["placeholder", "aria-label", "title", "alt"].map((a) => e.getAttribute(a) ?? ""),
    );
    return document.body.innerText + "\n" + attrs.join("\n");
  });
}

export interface OverflowReport { scrollOverflow: number; offenders: string[] }
/** document scrollWidth - clientWidth, plus important elements sticking out of the viewport (not clipped by a narrower scroll container, not in an off-canvas drawer). */
export async function overflowOf(page: Page): Promise<OverflowReport> {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const vw = doc.clientWidth;
    const offenders: string[] = [];
    const sel = "h1,h2,button,a[href],input,select,textarea,[role=dialog],table";
    for (const el of Array.from(document.querySelectorAll(sel))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none") continue;
      if (r.right <= vw + 1 && r.left >= -1) continue;
      let clipped = false;
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const ps = getComputedStyle(p);
        if (p.getAttribute("aria-hidden") === "true" || p.hasAttribute("inert")) { clipped = true; break; }
        if (/(auto|scroll|hidden|clip)/.test(ps.overflowX)) {
          const pr = p.getBoundingClientRect();
          if (pr.right <= vw + 1 && pr.left >= -1) { clipped = true; break; }
        }
        if (ps.position === "fixed" && ps.transform !== "none") { clipped = true; break; } // off-canvas drawer
      }
      if (!clipped) offenders.push(`${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""} "${(el.textContent ?? "").trim().slice(0, 30)}" right=${Math.round(r.right)} left=${Math.round(r.left)}`);
    }
    return { scrollOverflow: doc.scrollWidth - doc.clientWidth, offenders: offenders.slice(0, 6) };
  });
}
