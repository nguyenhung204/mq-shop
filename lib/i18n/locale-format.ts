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
    currency: "USD",
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
