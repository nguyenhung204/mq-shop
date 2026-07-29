import type { Locale } from "./types";
import { getTranslation } from "./get-translation";
import { translations } from "./translations";

/** Translate a domain status enum outside React (toasts, notifications). */
export function statusLabel(
  locale: Locale | null,
  domain: string,
  value: string | null | undefined,
): string {
  if (value == null || value === "") return "";
  if (!locale) return value;
  const key = `status.${domain}.${value}`;
  const label = getTranslation(locale, key);
  return label === key ? value : label;
}

/** Translate a domain status enum. Falls back to the raw value if the key is missing. */
export function translateStatus(
  t: (key: string, vars?: Record<string, string>) => string,
  domain: string,
  value: string | null | undefined,
): string {
  if (value == null || value === "") return "—";
  const key = `status.${domain}.${value}`;
  const label = t(key);
  return label === key ? value : label;
}

/**
 * Finance transaction rows reuse order statuses for ORDER type.
 * Try `transaction` first, then `order`, then raw value.
 */
export function translateTransactionStatus(
  t: (key: string, vars?: Record<string, string>) => string,
  value: string | null | undefined,
): string {
  if (value == null || value === "") return "—";
  const fromTx = translateStatus(t, "transaction", value);
  if (fromTx !== value) return fromTx;
  return translateStatus(t, "order", value);
}

/** Translate a list of role codes, joined for display. */
export function translateRoles(
  t: (key: string, vars?: Record<string, string>) => string,
  roles: string[] | null | undefined,
): string {
  if (!roles?.length) return "—";
  return roles.map((role) => translateStatus(t, "role", role)).join(", ");
}

/**
 * Look up a key that may contain dots (e.g. audit action codes) inside
 * `status.<mapName>` without treating dots as nested path segments.
 */
export function translateStatusMap(
  locale: Locale | null,
  mapName: string,
  key: string | null | undefined,
  fallback?: string,
): string {
  if (key == null || key === "") return fallback ?? "—";
  if (!locale) return fallback ?? key;
  const status = translations[locale]?.status as Record<string, unknown> | undefined;
  const map = status?.[mapName];
  if (map && typeof map === "object" && !Array.isArray(map)) {
    const hit = (map as Record<string, unknown>)[key];
    if (typeof hit === "string") return hit;
  }
  return fallback ?? key;
}
