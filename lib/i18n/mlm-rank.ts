/** Localized MLM rank labels (0–10). Prefer over BE English `rankName`. */
export function mlmRankLabel(
  t: (key: string, vars?: Record<string, string>) => string,
  rank: number | null | undefined,
  fallback?: string,
): string {
  if (rank == null || Number.isNaN(rank)) {
    return fallback?.trim() || t("wallet.rank");
  }
  const key = `wallet.bonusGuide.ranks.${rank}`;
  const label = t(key);
  if (label !== key) return label;
  return fallback?.trim() || t("wallet.rankSeller");
}
