/** Canonical FE path for affiliate register deep links. */
export const REFERRAL_REGISTER_PATH = "/my-account/register";

/**
 * Build a register URL with `?ref=` for the current origin.
 * Prefer this over BE `referralLink` when BE points at `/register` (404 on this app).
 */
export function buildReferralRegisterUrl(
  referralCode: string | null | undefined,
  origin?: string,
): string {
  const code = referralCode?.trim();
  if (!code) return "";
  const base =
    origin ??
    (typeof window !== "undefined" ? window.location.origin : "");
  if (!base) return `${REFERRAL_REGISTER_PATH}?ref=${encodeURIComponent(code)}`;
  return `${base}${REFERRAL_REGISTER_PATH}?ref=${encodeURIComponent(code)}`;
}
