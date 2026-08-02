# FE Guide: In-app notifications (deep link)

BE returns `type` + `meta` so FE can navigate on click. **FE owns the final route map** — BE does not send `linkUrl`.

## Response shape

`GET /notifications` items and SSE `GET /notifications/stream` events share the same view:

```ts
{
  id: string;
  userId: string;
  title: string;
  body: string;
  type: NotificationType;           // enum string
  meta: Record<string, string> | null;
  readAt: string | null;            // ISO
  createdAt: string;                // ISO
}
```

SSE payload is the notification view object (same fields as list items), not the raw DB entity.

## Rules

1. Unknown `type` or missing required `meta` keys → treat as `GENERIC`: show toast/detail only, **do not navigate**.
2. On click: `markRead(id)` then `router.push(resolvedRoute)` (or open modal).
3. `meta` values are always strings (ids, status, amounts).

## Suggested route map

| `NotificationType` | Meta keys | Suggested FE route |
|---|---|---|
| `GENERIC` | — | none |
| `ACCOUNT_LOCKED` / `ACCOUNT_UNLOCKED` / `ACCOUNT_DELETED` | `userId` | `/account` or support |
| `STAFF_ROLE_ASSIGNED` | `userId`, `shopId` | `/shop/:shopId` or staff home |
| `PLATFORM_ADMIN_ACCOUNT` | `userId` | `/admin` |
| `DSAR_REQUEST_NEW` | `dsarRequestId` | `/admin/dsar/:dsarRequestId` |
| `REFERRAL_DOWNLINE_JOINED` | `downlineUserId` | `/mlm/network` |
| `SHOP_APPLICATION_NEW` | `shopId` | `/admin/shops/:shopId` |
| `SHOP_APPROVED` / `SHOP_REJECTED` / `SHOP_SUSPENDED` / `SHOP_REINSTATED` | `shopId` | `/seller/shop` or `/shops/:shopId` |
| `PRODUCT_APPROVED` / `PRODUCT_REJECTED` / `PRODUCT_HIDDEN` | `productId`, `shopId` | `/seller/products/:productId` |
| `ORDER_STATUS_UPDATED` | `orderId`, `shopId`, `status` | `/orders/:orderId` |
| `ORDER_NEW` | `orderId`, `shopId` | `/seller/orders/:orderId` |
| `ORDER_CANCELLED` | `orderId`, `shopId` | `/orders/:orderId` |
| `ORDER_CREATED_BY_ADMIN` / `ORDER_CREATED_PAYMENT_NEEDED` | `orderId`, `shopId` | `/orders/:orderId` (+ pay if needed) |
| `RMA_*` | `orderId`, `shopId`, `rmaId` | `/orders/:orderId/rma/:rmaId` |
| `REVIEW_NEW` | `productId`, `shopId`, `reviewId` | `/seller/products/:productId/reviews` |
| `REVIEW_SELLER_REPLIED` / `REVIEW_HIDDEN` / `REVIEW_UNHIDDEN` | `productId`, `reviewId` | `/products/:productId#review-:reviewId` |
| `PROMOTION_APPROVED` / `PROMOTION_REJECTED` | `promotionId`, `shopId` | `/seller/promotions/:promotionId` |
| `WALLET_PIN_UPDATED` | `userId` | `/wallet/security` |
| `WALLET_TRANSFER_SENT` / `WALLET_TRANSFER_RECEIVED` | counterpart ids / amount | `/wallet/transactions` |
| `WALLET_ADJUSTED` | `userId`, `amount`? | `/wallet` |
| `WALLET_WITHDRAW_*` | `payoutId`, `userId` | `/wallet/payouts/:payoutId` (user) or `/admin/payouts/:payoutId` (staff) |
| `COMMISSION_*_CREDITED` / `COMMISSION_REFERRAL_TRIGGERED` | `ledgerId`, `amount`? | `/wallet/commissions/:ledgerId` |
| `COMMISSION_REFERRAL_SKIPPED_NOT_BUYER` | — | `/wallet/commissions` |
| `COMMISSION_JOB_FAILED` | `orderId`? | `/admin/commission` |
| `MLM_RANK_UPGRADED` / `MLM_RANK_UPDATED` | `mlmRank`, `previousRank`? | `/mlm/rank` |
| `MLM_REFERRER_UPDATED` / `MLM_DOWNLINE_ASSIGNED` | related user ids | `/mlm/network` |
| `MLM_REFERRAL_RATE_UPDATED` | — | `/admin/mlm` |
| `INVENTORY_SLIP_PENDING` / `INVENTORY_SLIP_APPROVED` / `INVENTORY_SLIP_REJECTED` | `slipId`, `code` | `/seller/inventory` (seller) or `/admin/inventory` (staff) |
| `INVENTORY_TRANSFER_PENDING` / `INVENTORY_TRANSFER_APPROVED` / `INVENTORY_TRANSFER_RECEIVED` | `transferId`, `code` | `/seller/inventory/transfers/:transferId` (seller) or `/admin/transfers/:transferId` (staff) |

Exact paths are FE-owned; see `lib/notifications/routes.ts` for the live map (adjusted to this app’s router).

## Checklist

- [x] List + SSE parse `type` / `meta`
- [x] Click → `POST mark read` → navigate (`lib/notifications/routes.ts`)
- [x] Fallback for unknown type / incomplete meta (`null` route → no navigate)
- [x] Staff vs user surfaces for withdraw / DSAR / shop application
