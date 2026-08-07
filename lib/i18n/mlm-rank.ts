import type { Locale } from "./types";

/**
 * Resolve a localized MLM rank label.
 *
 * Priority:
 * 1. `nameI18n[locale]` from the API (admin-managed translations)
 * 2. Static locale file key `wallet.bonusGuide.ranks.{rank}`
 * 3. `fallback` string (usually `name` from the API — Vietnamese default)
 * 4. Generic label from locale file
 */
export function mlmRankLabel(
  t: (key: string, vars?: Record<string, string>) => string,
  rank: number | null | undefined,
  fallback?: string,
  options?: { nameI18n?: Record<string, string>; locale?: Locale | null },
): string {
  if (rank == null || Number.isNaN(rank)) {
    return fallback?.trim() || t("wallet.rank");
  }

  // 1. Admin-managed i18n from API
  if (options?.nameI18n && options.locale) {
    const localized = options.nameI18n[options.locale];
    if (localized?.trim()) return localized;
  }

  // 2. Static locale file
  const key = `wallet.bonusGuide.ranks.${rank}`;
  const label = t(key);
  if (label !== key) return label;

  // 3. Fallback (usually Vietnamese name from DB)
  return fallback?.trim() || t("wallet.rankSeller");
}
