import { execFileSync } from "node:child_process";
import fs from "node:fs";
import type { Download } from "@playwright/test";
import { apiAs, ok } from "./api";
import { REDIS_CONTAINER } from "./env";
import { createSellerWithSku, createUser, relogin, decimalToCents, type TestUser } from "./factory";

/** Helpers of flow 11 (accounting export): CSV reading, a dedicated ACCOUNTANT user, Redis lease access. */

export interface Csv {
  /** raw bytes of the file as downloaded */
  bytes: Buffer;
  header: string[];
  /** every row (TOTAL lines included) keyed by header */
  rows: Array<Record<string, string>>;
  data: Array<Record<string, string>>;
  totals: Array<Record<string, string>>;
  /** the line terminator used between rows */
  crlf: boolean;
}

export const hasBom = (b: Buffer) => b.length >= 3 && b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf;

/** RFC 4180 parser (quotes, doubled quotes, CRLF inside quotes). `firstCell` of TOTAL lines starts with "TOTAL". */
export function parseCsv(bytes: Buffer): Csv {
  let text = bytes.toString("utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const table: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\r" && text[i + 1] === "\n") { row.push(cell); table.push(row); row = []; cell = ""; i++; }
    else if (ch === "\n") { row.push(cell); table.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); table.push(row); }
  const [header, ...body] = table;
  const rows = body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
  const isTotal = (r: Record<string, string>) => (r[header[0]] ?? "").startsWith("TOTAL");
  return { bytes, header, rows, data: rows.filter((r) => !isTotal(r)), totals: rows.filter(isTotal), crlf: text.includes("\r\n") };
}

export async function readDownload(d: Download, to: string): Promise<Csv> {
  await d.saveAs(to);
  return parseCsv(fs.readFileSync(to));
}

/** decimal string -> hundredths, '' -> 0 */
export const c100 = (v: string | undefined) => (v ? decimalToCents(v) : 0n);
export const sum100 = (rows: Array<Record<string, string>>, col: string) => rows.reduce((a, r) => a + c100(r[col]), 0n);

export const TAIPEI_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}\+08:00$/;
export const UTC_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
/** Taipei wall-clock ISO must be the same instant as the UTC column. */
export const sameInstant = (taipei: string, utc: string) => new Date(taipei).getTime() === new Date(utc).getTime();

/** Asia/Taipei calendar date `offsetDays` from today. */
export const taipeiDay = (offsetDays = 0) => new Date(Date.now() + 8 * 3600_000 + offsetDays * 86_400_000).toISOString().slice(0, 10);

/**
 * A fresh user who can export: a new BUYER promoted to shop-staff ACCOUNTANT by SUPER_ADMIN (POST admin/staff on an existing
 * buyer applies the role at once). Own account => own per-user export lease key, so lease experiments cannot hurt other specs.
 */
export async function createAccountant(): Promise<TestUser> {
  const shop = await createSellerWithSku({ prefix: "acctshop" });
  const u = await createUser({ prefix: "acct" });
  const sa = await apiAs("SUPER_ADMIN");
  await ok(await sa.post("admin/staff", { email: u.email, role: "ACCOUNTANT", shopId: shop.shopId }));
  return relogin(u);
}

// ---- Redis (container mqe2e-redis) ------------------------------------------------------------------------------

export function redisCli(...args: string[]): string {
  return execFileSync("docker", ["exec", REDIS_CONTAINER, "redis-cli", ...args], { encoding: "utf8" }).trim();
}
export const leaseKey = (userId: string) => `export:lease:user:${userId}`;
