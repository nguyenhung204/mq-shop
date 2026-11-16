/**
 * Ledger rows written before a reward type was retired keep their old reason /
 * commission type in the DB. Show a generic label instead of a raw i18n key.
 */
export function labelOrLegacy(
  t: (key: string) => string,
  prefix: "wallet.reasons" | "wallet.commissionTypes",
  value: string,
): string {
  const key = `${prefix}.${value}`;
  const text = t(key);
  return text === key ? t(`${prefix}.legacy`) : text;
}
