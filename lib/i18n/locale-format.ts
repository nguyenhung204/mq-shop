import type { Locale } from "./types";

export function toIntlLocale(locale: Locale | null | undefined): string {
  if (locale === "zh-TW") return "zh-Hant";
  if (locale === "vi") return "vi-VN";
  return "en-US";
}

export function formatMoneyLocale(
  value: string | number | undefined | null,
  locale: Locale | null | undefined,
): string {
  const n = typeof value === "string" ? Number(value) : value ?? 0;
  const safe = Number.isNaN(n) ? 0 : n;
  return new Intl.NumberFormat(toIntlLocale(locale), {
    style: "currency",
    currency: "TWD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(safe);
}

export function formatDateTimeLocale(
  iso: string,
  locale: Locale | null | undefined,
): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(toIntlLocale(locale), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

/** Settlement calendar day in GMT+8 (Asia/Taipei), YYYY-MM-DD. */
export function formatSettlementDayGmt8(
  iso: string | null | undefined,
): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
