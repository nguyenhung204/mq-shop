import type { AuthUser } from "@/lib/api/types";

/**
 * Approve/reject a seller payout: API requires scope ALL or APPROVE on PAYOUT_SELLER
 * (ALL or APPROVE scope; SELLER only has SHOP scope and is refused), so hide the buttons for it.
 */
export function canReviewSellerPayout(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  if (user.roles?.includes("SUPER_ADMIN")) return true;
  if (user.permissionScopes) {
    const scope = user.permissionScopes.PAYOUT_SELLER;
    return scope === "ALL" || scope === "APPROVE";
  }
  return Boolean(user.roles?.includes("ADMIN"));
}
