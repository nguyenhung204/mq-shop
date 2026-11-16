import type { AuthUser } from "@/lib/api/types";

/**
 * Settings and dividend writes (rates, slots) are SUPER_ADMIN only on the API
 * (CONFIG_SYS / CONFIG_MLM without an approval scope). ADMIN and ACCOUNTANT read only.
 * Fails closed when there is no user.
 */
export function canWriteSettings(user: AuthUser | null | undefined): boolean {
  return Boolean(user?.roles?.includes("SUPER_ADMIN"));
}

export const canWriteDividend = canWriteSettings;

/** Staff allowed to enter a partial refund amount on RMA approval (the API refuses everyone else). */
export function canSetPartialRefund(user: AuthUser | null | undefined): boolean {
  return Boolean(user?.roles?.some((r) => r === "ADMIN" || r === "SUPER_ADMIN"));
}
