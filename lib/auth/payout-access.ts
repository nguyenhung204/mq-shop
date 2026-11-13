import type { AuthUser } from "@/lib/api/types";
import type { PayoutRequestStatus } from "@/lib/api/wallet";
import { canResolvePayoutStatus } from "@/lib/wallet/payout-resolve";

/**
 * Approve/reject a seller payout: API requires scope ALL or APPROVE on PAYOUT_SELLER
 * (SELLER only has SHOP scope and is refused), so hide the buttons for it.
 * Fails closed: a cached session without `permissionScopes` only passes as SUPER_ADMIN.
 */
export function canReviewSellerPayout(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  if (user.roles?.includes("SUPER_ADMIN")) return true;
  const scope = user.permissionScopes?.PAYOUT_SELLER;
  return scope === "ALL" || scope === "APPROVE";
}

/** Approve/reject buttons for one seller payout row/detail. */
export function canShowSellerPayoutReview(
  user: AuthUser | null | undefined,
  payoutStatus: string,
  canApprovePermission: boolean,
): boolean {
  return payoutStatus === "PENDING" && canApprovePermission && canReviewSellerPayout(user);
}

/**
 * Manual resolve of a wallet payout needs PROCESS_PAYOUT (SUPER_ADMIN only).
 * Fails closed when `permissionScopes` is missing from a cached session.
 */
export function canResolveWalletPayout(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  if (user.roles?.includes("SUPER_ADMIN")) return true;
  return user.permissionScopes?.PROCESS_PAYOUT === "ALL";
}

/** Resolve button: right role AND a stuck status. */
export function canShowPayoutResolve(
  user: AuthUser | null | undefined,
  status: PayoutRequestStatus,
): boolean {
  return canResolvePayoutStatus(status) && canResolveWalletPayout(user);
}
