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

/** /admin/users needs VIEW_USERS: ADMIN and SUPER_ADMIN only (the account pickers fall back to known holders). */
export function canSearchUsers(user: AuthUser | null | undefined): boolean {
  return Boolean(user?.roles?.some((r) => r === "ADMIN" || r === "SUPER_ADMIN"));
}

/** Staff allowed to enter a partial refund amount on RMA approval (the API refuses everyone else). */
export function canSetPartialRefund(user: AuthUser | null | undefined): boolean {
  return Boolean(user?.roles?.some((r) => r === "ADMIN" || r === "SUPER_ADMIN"));
}

/** Edit of an order's payment date: SUPER_ADMIN only (CONFIG_SYS without an approval scope). */
export const canEditPaidAt = canWriteSettings;

/** Read of the paid-at history: CONFIG_SYS, so ADMIN and SUPER_ADMIN. */
export function canReadPaidAtHistory(user: AuthUser | null | undefined): boolean {
  return Boolean(user?.roles?.some((r) => r === "ADMIN" || r === "SUPER_ADMIN"));
}

/**
 * Who may type a refund amount on the SELLER approve route (POST /rma/:id/approve): a SELLER who holds
 * no CS / WAREHOUSE / ACCOUNTANT role (the API answers 400 RMA_REFUND_AMOUNT_INVALID to those), and
 * ADMIN / SUPER_ADMIN. Seller of another shop is refused by the API (403); the page only lists own shop RMAs.
 */
export function canSetSellerPartialRefund(user: AuthUser | null | undefined): boolean {
  const roles = user?.roles ?? [];
  if (roles.some((r) => r === "ADMIN" || r === "SUPER_ADMIN")) return true;
  if (!roles.includes("SELLER")) return false;
  return !roles.some((r) => r === "CS" || r === "WAREHOUSE" || r === "ACCOUNTANT");
}

/** Create a sub-account for any account and discard a pending one: ADMIN / SUPER_ADMIN (CREATE_SUB_ACCOUNT_FOR). Reads also allow ACCOUNTANT. */
export function canCreateSubAccountFor(user: AuthUser | null | undefined): boolean {
  return Boolean(user?.roles?.some((r) => r === "ADMIN" || r === "SUPER_ADMIN"));
}

/** Run the dividend settlement of a quarter: SUPER_ADMIN only (CONFIG_MLM without approval). ADMIN / ACCOUNTANT read. */
export const canRunDividendSettlement = canWriteSettings;
