import type { ApiNotification, NotificationType, Role } from "@/lib/api/types";

export type NotificationRouteContext = {
  roles: Role[];
};

function metaStr(
  meta: Record<string, string> | null | undefined,
  key: string,
): string | null {
  const v = meta?.[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function requireMeta(
  meta: Record<string, string> | null | undefined,
  keys: string[],
): Record<string, string> | null {
  if (!meta) return null;
  const out: Record<string, string> = {};
  for (const key of keys) {
    const v = metaStr(meta, key);
    if (!v) return null;
    out[key] = v;
  }
  return out;
}

function isAdminish(roles: Role[]): boolean {
  return (
    roles.includes("ADMIN") ||
    roles.includes("SUPER_ADMIN") ||
    roles.includes("ACCOUNTANT")
  );
}

function isSeller(roles: Role[]): boolean {
  return roles.includes("SELLER");
}

function isBuyerOnly(roles: Role[]): boolean {
  return roles.length === 1 && roles.includes("BUYER");
}

/**
 * Resolve in-app notification → app route.
 * Unknown type / missing required meta → `null` (toast/detail only, no navigate).
 */
export function resolveNotificationRoute(
  n: Pick<ApiNotification, "type" | "meta">,
  ctx: NotificationRouteContext,
): string | null {
  const type = (n.type || "GENERIC") as NotificationType;
  const meta = n.meta ?? null;
  const admin = isAdminish(ctx.roles);
  const seller = isSeller(ctx.roles);
  const buyerOnly = isBuyerOnly(ctx.roles);

  switch (type) {
    case "GENERIC":
      return null;

    case "ACCOUNT_LOCKED":
    case "ACCOUNT_UNLOCKED":
    case "ACCOUNT_DELETED":
      return "/account";

    case "STAFF_ROLE_ASSIGNED": {
      const m = requireMeta(meta, ["shopId"]);
      if (m) return `/seller/shop`;
      return seller ? "/seller" : "/account";
    }

    case "PLATFORM_ADMIN_ACCOUNT":
      return admin ? "/admin" : null;

    case "DSAR_REQUEST_NEW":
      return admin ? "/admin/dsar" : null;

    case "REFERRAL_DOWNLINE_JOINED":
      return buyerOnly ? null : "/mlm/network";

    case "SHOP_APPLICATION_NEW": {
      const m = requireMeta(meta, ["shopId"]);
      return m ? `/admin/shops/${m.shopId}` : "/admin/shops";
    }

    case "SHOP_APPROVED":
    case "SHOP_REJECTED":
    case "SHOP_SUSPENDED":
    case "SHOP_REINSTATED":
    case "SHOP_BANK_INFO_SETUP":
      return seller ? "/seller/shop" : "/account";

    case "PRODUCT_APPROVED":
    case "PRODUCT_REJECTED":
    case "PRODUCT_HIDDEN":
      return seller ? "/seller/products" : null;

    case "ORDER_NEW": {
      const m = requireMeta(meta, ["orderId"]);
      if (!m) return seller ? "/seller/orders" : "/orders";
      return `/orders/${m.orderId}`;
    }

    case "ORDER_STATUS_UPDATED":
    case "ORDER_CANCELLED":
    case "ORDER_CREATED_BY_ADMIN":
    case "ORDER_CREATED_PAYMENT_NEEDED": {
      const m = requireMeta(meta, ["orderId"]);
      return m ? `/orders/${m.orderId}` : "/orders";
    }

    case "RMA_NEW": {
      const m = requireMeta(meta, ["rmaId"]);
      if (admin && m) return `/admin/rma/${m.rmaId}`;
      const orderId = metaStr(meta, "orderId");
      if (orderId) return `/orders/${orderId}/rma`;
      return admin ? "/admin/rma" : "/rma";
    }

    case "RMA_APPROVED":
    case "RMA_REJECTED":
    case "RMA_REFUND_COMPLETED":
    case "RMA_APPROVED_EXTERNAL_REFUND": {
      const orderId = metaStr(meta, "orderId");
      const rmaId = metaStr(meta, "rmaId");
      if (admin && rmaId) return `/admin/rma/${rmaId}`;
      if (orderId) return `/orders/${orderId}/rma`;
      return admin ? "/admin/rma" : "/rma";
    }

    case "REVIEW_NEW":
      return seller ? "/seller/reviews" : null;

    case "REVIEW_SELLER_REPLIED":
    case "REVIEW_HIDDEN":
    case "REVIEW_UNHIDDEN": {
      const m = requireMeta(meta, ["productId"]);
      if (!m) return null;
      const reviewId = metaStr(meta, "reviewId");
      return reviewId
        ? `/product/${m.productId}#review-${reviewId}`
        : `/product/${m.productId}`;
    }

    case "PROMOTION_APPROVED":
    case "PROMOTION_REJECTED":
      return seller ? "/seller/promotions" : null;

    case "WALLET_PIN_UPDATED":
      return "/wallet";

    case "WALLET_TRANSFER_SENT":
    case "WALLET_TRANSFER_RECEIVED":
      return "/wallet";

    case "WALLET_ADJUSTED":
      return "/wallet";

    case "WALLET_WITHDRAW_NEW":
    case "WALLET_WITHDRAW_STAFF_APPROVED":
    case "WALLET_WITHDRAW_STAFF_REJECTED":
    case "WALLET_WITHDRAW_STAFF_PROCESSED":
    case "WALLET_WITHDRAW_STAFF_PAY_FAILED": {
      const m = requireMeta(meta, ["payoutId"]);
      if (admin) {
        return m ? `/admin/wallet/payouts/${m.payoutId}` : "/admin/wallet/payouts";
      }
      return m ? `/wallet/withdrawals/${m.payoutId}` : "/wallet/withdraw";
    }

    case "WALLET_WITHDRAW_REQUESTED":
    case "WALLET_WITHDRAW_APPROVED":
    case "WALLET_WITHDRAW_REJECTED":
    case "WALLET_WITHDRAW_COMPLETED":
    case "WALLET_WITHDRAW_PAY_FAILED": {
      const m = requireMeta(meta, ["payoutId"]);
      return m ? `/wallet/withdrawals/${m.payoutId}` : "/wallet/withdraw";
    }

    case "COMMISSION_REFERRAL_CREDITED":
    case "COMMISSION_TEAM_CREDITED":
    case "COMMISSION_GLOBAL_CREDITED":
    case "COMMISSION_LOYALTY_CREDITED":
    case "COMMISSION_REFERRAL_TRIGGERED":
      return buyerOnly ? null : "/wallet/commissions";

    case "COMMISSION_REFERRAL_SKIPPED_NOT_BUYER":
      return buyerOnly ? null : "/wallet/commissions";

    case "COMMISSION_JOB_FAILED":
      return admin ? "/admin/mlm" : null;

    case "MLM_RANK_UPGRADED":
    case "MLM_RANK_UPDATED":
      return buyerOnly ? null : "/wallet";

    case "MLM_REFERRER_UPDATED":
    case "MLM_DOWNLINE_ASSIGNED":
      return buyerOnly ? null : "/mlm/network";

    case "MLM_REFERRAL_RATE_UPDATED":
      return admin ? "/admin/mlm" : null;

    case "INVENTORY_SLIP_PENDING":
    case "INVENTORY_SLIP_APPROVED":
    case "INVENTORY_SLIP_REJECTED": {
      if (buyerOnly) return null;
      const base = seller ? "/seller/inventory" : "/admin/inventory";
      const m = requireMeta(meta, ["slipId"]);
      return m ? `${base}?tab=slips&slipId=${encodeURIComponent(m.slipId)}` : base;
    }

    case "INVENTORY_TRANSFER_PENDING":
    case "INVENTORY_TRANSFER_APPROVED":
    case "INVENTORY_TRANSFER_RECEIVED": {
      if (buyerOnly) return null;
      const m = requireMeta(meta, ["transferId"]);
      if (seller) {
        return m ? `/seller/inventory/transfers/${m.transferId}` : "/seller/inventory/transfers";
      }
      return m ? `/admin/transfers/${m.transferId}` : "/admin/transfers";
    }

    default:
      return null;
  }
}
