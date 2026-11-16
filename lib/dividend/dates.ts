import { wallClockGmt8 } from "@/lib/i18n/gmt8-calendar";

const pad2 = (n: number) => String(n).padStart(2, "0");
const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const QUARTER_RE = /^(\d{4})Q([1-4])$/;

/** Today's calendar day in Asia/Taipei (GMT+8) as YYYY-MM-DD. `now` is injectable for tests. */
export function todayGmt8(now: Date = new Date()): string {
  const w = wallClockGmt8(now);
  return `${w.y}-${pad2(w.m)}-${pad2(w.day)}`;
}

/** True only for a real calendar day (rejects 2026-02-30, 2026-13-01, malformed text). */
export function isRealDay(value: string): boolean {
  const m = DAY_RE.exec(value);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

export function isQuarterLabel(value: string): boolean {
  const m = QUARTER_RE.exec(value);
  return Boolean(m && Number(m[1]) >= 2000 && Number(m[1]) <= 2999);
}

/** "2026Q4" for the GMT+8 calendar quarter containing `now`. */
export function currentQuarter(now: Date = new Date()): string {
  const w = wallClockGmt8(now);
  return `${w.y}Q${Math.floor((w.m - 1) / 3) + 1}`;
}

/** Step a quarter label by n quarters (negative = back). Returns null for a bad label. */
export function shiftQuarter(label: string, n: number): string | null {
  const m = QUARTER_RE.exec(label);
  if (!m) return null;
  const idx = Number(m[1]) * 4 + (Number(m[2]) - 1) + n;
  return `${Math.floor(idx / 4)}Q${(idx % 4) + 1}`;
}

/** Selector options: `back` quarters before the current one up to `forward` after it, newest first. */
export function quarterOptions(now: Date = new Date(), back = 8, forward = 1): string[] {
  const cur = currentQuarter(now);
  const out: string[] = [];
  for (let n = forward; n >= -back; n--) out.push(shiftQuarter(cur, n)!);
  return out;
}
