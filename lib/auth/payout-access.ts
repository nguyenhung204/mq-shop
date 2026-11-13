import type { AuthUser } from "@/lib/api/types";

/**
 * Approve/reject a seller payout: API requires scope ALL on PAYOUT_SELLER
 * (SELLER only has SHOP scope and is refused), so hide the buttons for it.
 */
export function canReviewSellerPayout(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  if (user.roles?.includes("SUPER_ADMIN")) return true;
  if (user.permissionScopes) return user.permissionScopes.PAYOUT_SELLER === "ALL";
  return Boolean(user.roles?.includes("ADMIN"));
}
