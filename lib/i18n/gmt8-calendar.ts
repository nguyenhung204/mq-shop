/** Platform settlement / period calendar — GMT+8 year-round (Asia/Taipei, no DST). */
export const PLATFORM_IANA_TZ = "Asia/Taipei";
export const PLATFORM_UTC_OFFSET_HOURS = 8;
const OFFSET_MS = PLATFORM_UTC_OFFSET_HOURS * 60 * 60 * 1000;

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATETIME_LOCAL_RE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function wallClockGmt8(now = new Date()): {
  y: number;
  m: number;
  day: number;
  hour: number;
  minute: number;
} {
  const shifted = new Date(now.getTime() + OFFSET_MS);
  return {
    y: shifted.getUTCFullYear(),
    m: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

/** yyyy-mm-dd → 00:00:00.000 GMT+8 as ISO. */
export function gmt8DayStartIso(date: string): string {
  const m = DAY_RE.exec(date.trim());
  if (!m) return "";
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return new Date(Date.UTC(y, mo - 1, d, 0, 0, 0, 0) - OFFSET_MS).toISOString();
}

/** yyyy-mm-dd → 23:59:59.999 GMT+8 as ISO. */
export function gmt8DayEndIso(date: string): string {
  const m = DAY_RE.exec(date.trim());
  if (!m) return "";
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return new Date(
    Date.UTC(y, mo - 1, d, 23, 59, 59, 999) - OFFSET_MS,
  ).toISOString();
}

/** Current GMT+8 calendar month as yyyy-mm-dd bounds (inclusive). */
export function gmt8MonthBounds(now = new Date()): { start: string; end: string } {
  const { y, m } = wallClockGmt8(now);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    start: `${y}-${pad2(m)}-01`,
    end: `${y}-${pad2(m)}-${pad2(last)}`,
  };
}

/** Inclusive GMT+8 calendar day range ending today, starting one year earlier. */
export function gmt8YearBackDayBounds(now = new Date()): {
  start: string;
  end: string;
} {
  const end = wallClockGmt8(now);
  const startShifted = new Date(now.getTime() + OFFSET_MS);
  startShifted.setUTCFullYear(startShifted.getUTCFullYear() - 1);
  return {
    start: `${startShifted.getUTCFullYear()}-${pad2(startShifted.getUTCMonth() + 1)}-${pad2(startShifted.getUTCDate())}`,
    end: `${end.y}-${pad2(end.m)}-${pad2(end.day)}`,
  };
}

/**
 * `<input type="datetime-local">` value interpreted as GMT+8 wall clock → ISO.
 */
export function gmt8DateTimeLocalToIso(local: string): string {
  const match = DATETIME_LOCAL_RE.exec(local.trim());
  if (!match) return "";
  const y = Number(match[1]);
  const mo = Number(match[2]);
  const d = Number(match[3]);
  const hh = Number(match[4]);
  const mm = Number(match[5]);
  const ss = Number(match[6] || "0");
  return new Date(
    Date.UTC(y, mo - 1, d, hh, mm, ss, 0) - OFFSET_MS,
  ).toISOString();
}

/** ISO → `yyyy-mm-ddTHH:mm` in GMT+8 for datetime-local inputs. */
export function isoToGmt8DateTimeLocal(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const w = wallClockGmt8(date);
  return `${w.y}-${pad2(w.m)}-${pad2(w.day)}T${pad2(w.hour)}:${pad2(w.minute)}`;
}

export function formatDateTimeGmt8(
  iso: string,
  locale = "en-US",
): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, {
    timeZone: PLATFORM_IANA_TZ,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
