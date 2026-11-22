import type { APIResponse, Browser, BrowserContext, Page } from "@playwright/test";
import { Api, freshIp, ok } from "./api";
import { db, sql } from "./db";
import { deliverOrder, placeOrder, type TestSeller, type TestUser } from "./factory";

/**
 * Helpers for the admin flows 4-7 and 10 (settings, currency display, dividend, tax, paid-at).
 * Everything that is not reachable through the HTTP API carries a `// SQL:` comment at the call site.
 */

/* ------------------------------------------------------------------ errors / settings */

/** Status + domain code (`data.code`) + message of a failed API response. */
export async function errOf(res: APIResponse): Promise<{ status: number; code: string | undefined; message: string }> {
  const text = await res.text();
  let j: any = {};
  try { j = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status(), code: j?.data?.code ?? j?.code, message: String(j?.message ?? text) };
}

export async function settingOf(api: Api, key: string): Promise<any> {
  const data = await ok<any>(await api.get("admin/settings"));
  const row = (data.items as any[]).find((s) => s.key === key);
  if (!row) throw new Error(`setting ${key} not listed`);
  return row;
}

export function putSetting(api: Api, key: string, value: number | boolean | null, reason: string) {
  return api.put(`admin/settings/${key}`, { value, reason });
}

export async function superAdminId(): Promise<string> {
  // SQL: read-only lookup of the seeded SUPER_ADMIN id (used as created_by of seeded dividend slot rows).
  const rows = await sql<{ id: string }>(`SELECT id FROM users WHERE email = 'superadmin@example.com'`);
  return rows[0].id;
}

/* ------------------------------------------------------------------ browser */

/** Page of the owner of `who` with the UI language fixed (our init script is registered last, so it wins). */
export async function pageAs(
  browser: Browser,
  who: { api: Api },
  lang: "en" | "vi" | "zh-TW" = "en",
): Promise<{ page: Page; context: BrowserContext }> {
  const storageState = await who.api.ctx.storageState();
  // own throttle bucket for the browser's API calls (backend runs with TRUST_PROXY=1); without it parallel UI tests share one IP and get 429 -> login page
  const context = await browser.newContext({
    storageState,
    baseURL: "http://localhost:3000",
    viewport: { width: 1280, height: 800 },
    extraHTTPHeaders: { "x-forwarded-for": freshIp() },
  });
  await context.addInitScript((l) => { try { localStorage.setItem("mq-lang", l); } catch { /* ignore */ } }, lang);
  return { page: await context.newPage(), context };
}

/* ------------------------------------------------------------------ quarters */

const pad2 = (n: number) => String(n).padStart(2, "0");

export function quarterAfter(q: string): string {
  const y = Number(q.slice(0, 4));
  const n = Number(q.slice(5));
  return n === 4 ? `${y + 1}Q1` : `${y}Q${n + 1}`;
}

/** First instant of the quarter, Asia/Taipei (+08:00). */
export function quarterStart(q: string): Date {
  const y = Number(q.slice(0, 4));
  const m = (Number(q.slice(5)) - 1) * 3 + 1;
  return new Date(`${y}-${pad2(m)}-01T00:00:00+08:00`);
}

/** A reward instant in the middle of the quarter (15th day of its second month, 10:00 Taipei). */
export function quarterMiddle(q: string): Date {
  const y = Number(q.slice(0, 4));
  const m = (Number(q.slice(5)) - 1) * 3 + 2;
  return new Date(`${y}-${pad2(m)}-15T10:00:00+08:00`);
}

async function quarterIsFree(q: string): Promise<boolean> {
  // SQL: read-only. "Free" = nobody holds slots that count in q (carry-forward from any earlier quarter) and no
  // DELIVERED order was rewarded inside q, so the report of q only contains what this test seeds.
  const rows = await sql<{ holders: number; orders: number }>(
    `SELECT (SELECT count(*) FROM (SELECT DISTINCT ON (user_id) slots FROM dividend_slot_entries
                                    WHERE quarter <= $1 ORDER BY user_id, quarter DESC, seq DESC) x WHERE x.slots > 0)::int AS holders,
            (SELECT count(*) FROM orders WHERE status IN ('DELIVERED','REFUND_APPROVED')
                AND sales_eligible_at >= $2 AND sales_eligible_at < $3)::int AS orders`,
    [q, quarterStart(q), quarterStart(quarterAfter(q))],
  );
  return rows[0].holders === 0 && rows[0].orders === 0;
}

export interface QuarterClaim {
  quarter: string;
  /** Make the quarter reusable (slots zeroed, seeded orders cancelled) and drop the advisory lock. Call in `finally`. */
  release(): Promise<void>;
  /** Register things to clean up on release. */
  track(opts: { userIds?: string[]; orderIds?: string[] }): void;
}

/**
 * Claim the lowest free past quarter of [from, to] for this test. Past quarters are locked (dividendEditWindowDays is
 * unset = 0) and have no dividend rates, so they are isolated from the live current quarter. A pg session advisory lock
 * keeps two of our tests from taking the same quarter.
 */
export async function claimQuarter(from = "2024Q4", to = "2026Q3"): Promise<QuarterClaim> {
  const userIds = new Set<string>();
  const orderIds = new Set<string>();
  for (let q = from; ; q = quarterAfter(q)) {
    const c = await db().connect();
    const key = `e2e-quarter:${q}`;
    const got = (await c.query(`SELECT pg_try_advisory_lock(hashtext($1)) AS ok`, [key])).rows[0].ok as boolean;
    if (got && (await quarterIsFree(q))) {
      return {
        quarter: q,
        track: (o) => { o.userIds?.forEach((x) => userIds.add(x)); o.orderIds?.forEach((x) => orderIds.add(x)); },
        release: async () => {
          try {
            const by = await superAdminId();
            for (const u of userIds) {
              // SQL: slot rows are append-only, so "cleaning" = a newer version with 0 slots at the same quarter.
              await c.query(
                `INSERT INTO dividend_slot_entries (user_id, quarter, slots, kind, reason, created_by) VALUES ($1, $2, 0, 'SET', 'e2e cleanup', $3)`,
                [u, q, by],
              );
            }
            if (orderIds.size > 0) {
              // SQL: take the seeded orders out of the quarter's sales base (they stay in the DB, no longer DELIVERED).
              await c.query(`UPDATE orders SET status = 'CANCELLED' WHERE id = ANY($1::uuid[])`, [[...orderIds]]);
            }
          } finally {
            await c.query(`SELECT pg_advisory_unlock(hashtext($1))`, [key]);
            c.release();
          }
        },
      };
    }
    if (got) await c.query(`SELECT pg_advisory_unlock(hashtext($1))`, [key]);
    c.release();
    if (q === to) throw new Error(`no free quarter between ${from} and ${to}`);
  }
}

/**
 * Seed slot versions for accounts at quarter q: every version is a `SET` row at q (later seq wins), and each account also
 * gets a 0 row at the NEXT quarter so a crash never leaves slots carried into the live current quarter.
 */
export async function seedSlots(q: string, holders: Array<{ userId: string; versions: number[] }>): Promise<void> {
  const by = await superAdminId();
  const next = quarterAfter(q);
  const c = await db().connect();
  try {
    await c.query("BEGIN");
    for (const h of holders) {
      // SQL: past quarters are locked, so the API refuses slot writes there; rows are what the API itself would insert.
      for (const v of h.versions) {
        await c.query(
          `INSERT INTO dividend_slot_entries (user_id, quarter, slots, kind, reason, created_by) VALUES ($1, $2, $3, 'SET', 'e2e seed', $4)`,
          [h.userId, q, v, by],
        );
      }
      await c.query(
        `INSERT INTO dividend_slot_entries (user_id, quarter, slots, kind, reason, created_by) VALUES ($1, $2, 0, 'SET', 'e2e carry-forward guard', $3)`,
        [h.userId, next, by],
      );
    }
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}

/** Real order (checkout + delivery through the API), then rewarded inside quarter q. Returns the ground-truth money in cents. */
export async function deliveredOrderIn(
  q: string,
  claim: QuarterClaim,
  buyer: TestUser,
  seller: TestSeller,
  quantity = 1,
): Promise<{ id: string; totalCents: bigint; shippingCents: bigint }> {
  const order = await placeOrder(buyer, seller, quantity);
  claim.track({ orderIds: [order.id] });
  await deliverOrder(seller, order.id);
  // SQL: the reward date (sales_eligible_at) is set by an hourly job 7 days after delivery; no API moves it into a past quarter.
  await sql(`UPDATE orders SET sales_eligible_at = $2 WHERE id = $1`, [order.id, quarterMiddle(q)]);
  const row = await sql<{ t: string; s: string }>(
    `SELECT ROUND(total * 100)::bigint::text AS t, ROUND(shipping_fee * 100)::bigint::text AS s FROM orders WHERE id = $1`,
    [order.id],
  );
  return { id: order.id, totalCents: BigInt(row[0].t), shippingCents: BigInt(row[0].s) };
}

/* ------------------------------------------------------------------ independent dividend oracle */

export interface OracleOrder { totalCents: bigint; shippingCents: bigint; refundCents?: bigint }

/**
 * Independent re-computation (BigInt, no product code) of the dividend rules:
 * per-order base = max(total - shipping - completed refunds, 0); with tax: floor(base x 10000 / (10000 + taxBps));
 * pool = floor(sum(base) x rateBps / 10000) cents; no slots => pool 0;
 * share(account) = floor(pool x slots / totalSlots / 100) whole NTD; remainder = pool - sum(shares x 100).
 */
export function dividendOracle(i: {
  orders: OracleOrder[];
  rateBps: bigint;
  taxBps: bigint;
  holders: Array<{ key: string; slots: bigint }>;
}) {
  let beforeTax = 0n;
  let base = 0n;
  for (const o of i.orders) {
    let b = o.totalCents - o.shippingCents - (o.refundCents ?? 0n);
    if (b < 0n) b = 0n;
    beforeTax += b;
    base += (b * 10000n) / (10000n + i.taxBps);
  }
  const rawPool = (base * i.rateBps) / 10000n;
  const totalSlots = i.holders.reduce((a, h) => a + h.slots, 0n);
  const pool = totalSlots === 0n ? 0n : rawPool;
  const shares = new Map<string, bigint>();
  let distributed = 0n;
  for (const h of i.holders) {
    const share = totalSlots === 0n ? 0n : (pool * h.slots) / (totalSlots * 100n);
    shares.set(h.key, share);
    distributed += share * 100n;
  }
  return { beforeTax, base, taxExcluded: beforeTax - base, rawPool, pool, totalSlots, shares, remainder: pool - distributed };
}

/** Ground-truth order rows (SQL read-only) rewarded in [from, to): what the report is supposed to sum. */
export async function orderRowsRewardedIn(from: Date, to: Date): Promise<OracleOrder[]> {
  // SQL: read-only ground truth for the oracle (total, shipping, completed refunds in cents).
  const rows = await sql<{ t: string; s: string; r: string }>(
    `SELECT ROUND(o.total * 100)::bigint::text AS t, ROUND(o.shipping_fee * 100)::bigint::text AS s,
            COALESCE((SELECT SUM(ROUND(x.refund_amount * 100)) FROM rma_requests x WHERE x.order_id = o.id AND x.status = 'COMPLETED'), 0)::bigint::text AS r
       FROM orders o WHERE o.status = 'DELIVERED' AND o.sales_eligible_at >= $1 AND o.sales_eligible_at < $2 ORDER BY o.id`,
    [from, to],
  );
  return rows.map((r) => ({ totalCents: BigInt(r.t), shippingCents: BigInt(r.s), refundCents: BigInt(r.r) }));
}

/** "1234.50" -> 123450n (cents). */
export function toCents(v: string | number): bigint {
  const s = String(v);
  const neg = s.startsWith("-");
  const [w, f = ""] = (neg ? s.slice(1) : s).split(".");
  const c = BigInt(w || "0") * 100n + BigInt(f.padEnd(2, "0").slice(0, 2));
  return neg ? -c : c;
}

/** Append-only probe: the statement must fail in the database, and is always rolled back. */
export async function expectDbRejects(statement: string, params: unknown[]): Promise<string> {
  const c = await db().connect();
  try {
    await c.query("BEGIN");
    try {
      await c.query(statement, params);
    } catch (e: any) {
      return String(e?.message ?? e);
    } finally {
      await c.query("ROLLBACK");
    }
    throw new Error(`database accepted: ${statement}`);
  } finally {
    c.release();
  }
}
