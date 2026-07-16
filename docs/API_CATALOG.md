# API Catalog — MQ Shopping

> Danh mục API đã ship. Cập nhật khi thêm endpoint.
> Prefix: `/api/v1` · Auth: Bearer JWT (trừ `@Public`)
>
> **FE:** nghiệp vụ UI → [FE_GUIDE.md](./FE_GUIDE.md) · payload → [FE_API_CONTRACTS.md](./FE_API_CONTRACTS.md)

**Cập nhật:** 2026-07-16 (Sprint 7)

---

## Auth (`auth/`) — Public trừ logout

| Method | Path | Auth | Sprint |
|--------|------|------|--------|
| POST | `/auth/register` | Public | 1 |
| POST | `/auth/verify-otp` | Public | 1 |
| POST | `/auth/login` | Public | 1 |
| POST | `/auth/refresh-token` | Public | 1 |
| POST | `/auth/logout` | JWT | 1 |
| POST | `/auth/forgot-password` | Public | 1 |
| POST | `/auth/reset-password` | Public | 1 |

## Users (`users/`)

| Method | Path | Auth | Sprint |
|--------|------|------|--------|
| GET | `/users/me` | JWT | 1 |
| PUT | `/users/me/profile` | JWT | 1 |
| PUT | `/users/me/password` | JWT | 1 |
| POST | `/users/me/change-email/request-otp` | JWT | 1 |
| PUT | `/users/me/change-email/confirm` | JWT | 1 |

## Admin / Super Admin (RBAC)

| Method | Path | Permission | Sprint |
|--------|------|------------|--------|
| PUT | `/admin/users/:id/lock` | `LOCK_USER` | 1 |
| PUT | `/admin/users/:id/unlock` | `UNLOCK_USER` | 1 |
| DELETE | `/admin/users/:id` | `DELETE_USER` | 1 |
| POST | `/admin/staff-accounts` | `CREATE_STAFF` | 1 |
| PUT | `/admin/staff-accounts/:id/permissions` | `ASSIGN_PERMISSIONS` | 1 |
| PUT | `/super-admin/staff-accounts/:id/approve` | `APPROVE_STAFF` | 1 |

## Shops

| Method | Path | Auth / Permission | Sprint |
|--------|------|-------------------|--------|
| POST | `/shops/apply` | JWT | 2 |
| GET | `/shops/me` | JWT | 2 |
| PUT | `/shops/me` | JWT | 2 |
| GET | `/admin/shops` | `APPROVE_SHOP` | 2 |
| GET | `/admin/shops/:id` | `APPROVE_SHOP` | 2 |
| PUT | `/admin/shops/:id/approve` | `APPROVE_SHOP` | 2 |
| PUT | `/admin/shops/:id/reject` | `REJECT_SHOP` | 2 |
| PUT | `/admin/shops/:id/suspend` | `SUSPEND_SHOP` | 2 |

## Products / Categories

| Method | Path | Auth / Permission | Sprint |
|--------|------|-------------------|--------|
| GET | `/categories` | Public | 2 |
| GET | `/products/search` | Public | 2 |
| GET | `/products/:id` | Public | 2 |
| POST | `/seller/products` | JWT (shop APPROVED) | 2 |
| GET | `/seller/products` | JWT | 2 |
| PUT | `/seller/products/:id` | JWT (shop APPROVED) | 2 |
| PUT | `/seller/products/:id/hide` | JWT | 2 |
| GET | `/admin/products` | `APPROVE_PRODUCT` | 2 |
| PUT | `/admin/products/:id/approve` | `APPROVE_PRODUCT` | 2 |
| PUT | `/admin/products/:id/reject` | `REJECT_PRODUCT` | 2 |
| PUT | `/admin/products/:id/hide` | `HIDE_PRODUCT` | 2 |

## Inventory / Warehouses

| Method | Path | Auth / Permission | Sprint |
|--------|------|-------------------|--------|
| POST | `/warehouses` | JWT (shop access) | 3 |
| GET | `/warehouses` | JWT (shop access) | 3 |
| PUT | `/warehouses/:id` | JWT (shop access) | 3 |
| POST | `/shops/me/staff` | JWT (owner) | 3 |
| GET | `/shops/me/staff` | JWT (owner) | 3 |
| GET | `/inventory` | JWT (shop access) | 3 |
| POST | `/inventory/requests` | JWT (owner auto-approve / staff PENDING) | 3 |
| GET | `/inventory/requests` | JWT (shop access) | 3 |
| GET | `/seller/inventory/requests` | JWT (shop owner) | 3 |
| PUT | `/seller/inventory/requests/:id/approve` | JWT (shop owner) | 3 |
| PUT | `/seller/inventory/requests/:id/reject` | JWT (shop owner) | 3 |

## Notifications (in-app)

| Method | Path | Auth / Permission | Sprint |
|--------|------|-------------------|--------|
| GET | `/notifications` | JWT | 3 |
| PUT | `/notifications/read-all` | JWT | 3 |
| PUT | `/notifications/:id/read` | JWT | 3 |
| WS | `{HOST}/notifications` (Socket.IO, JWT handshake) | JWT | realtime |

> Realtime: event `notification` / `connected` — xem [FE_GUIDE.md](./FE_GUIDE.md) §11. Namespace **không** có prefix `/api/v1`.

## Cart / Orders

| Method | Path | Auth / Permission | Sprint |
|--------|------|-------------------|--------|
| GET | `/cart` | JWT | 4 |
| POST | `/cart/items` | JWT | 4 |
| PUT | `/cart/items/:id` | JWT | 4 |
| DELETE | `/cart/items/:id` | JWT | 4 |
| DELETE | `/cart` | JWT | 4 |
| POST | `/checkout` | JWT | 4 |
| GET | `/orders/me` | JWT | 4 |
| GET | `/orders/:id` | JWT (buyer / shop owner / Admin) | 4 |
| GET | `/seller/orders` | JWT (shop owner) | 4 |
| PUT | `/orders/:id/cancel` | JWT (buyer / shop owner) | 4 |
| PUT | `/admin/orders/:id/force-cancel` | `FORCE_CANCEL_ORDER` | 4 |
| PUT | `/admin/orders/:id/confirm-cod` | `CONFIRM_ORDER` | 4 |
| GET | `/admin/finance/daily-refund-report` | `VIEW_REFUND_REPORT` | 4 |
| POST | `/webhooks/payment` | Public (`x-webhook-secret` nếu set) | 4 |
| POST | `/webhooks/shipping` | Public (`x-webhook-secret` nếu set) | 4 |

## RMA

| Method | Path | Auth / Permission | Sprint |
|--------|------|-------------------|--------|
| POST | `/orders/:orderId/rma` | JWT (buyer) | 5 |
| PUT | `/rma/:id/withdraw` | JWT (buyer) | 5 |
| GET | `/rma/me` | JWT (buyer) | 5 |
| GET | `/rma/:id` | JWT (buyer / seller / Admin) | 5 |
| GET | `/seller/rma` | JWT (shop owner) | 5 |
| GET | `/admin/rma` | `MANAGE_RMA` | 5 |
| PUT | `/admin/rma/:id/decision` | `MANAGE_RMA` | 5 |
| PUT | `/seller/rma/:id/confirm-stock-return` | JWT (shop owner) | 5 |

## Finance

| Method | Path | Auth / Permission | Sprint |
|--------|------|-------------------|--------|
| POST | `/finance/payout-batches` | `MANAGE_PAYOUT` | 5 |
| GET | `/finance/payout-batches` | JWT (owner / Admin) | 5 |
| PUT | `/finance/payout-batches/:id/approve` | `MANAGE_PAYOUT` | 5 |
| PUT | `/finance/payout-batches/:id/reject` | `MANAGE_PAYOUT` | 5 |
| PUT | `/finance/payout-batches/:id/mark-completed` | `MANAGE_PAYOUT` | 5 |
| PUT | `/admin/shops/:shopId/commission-override` | `SET_COMMISSION_OVERRIDE` | 5 |
| POST | `/admin/payment-gateway-configs` | `MANAGE_PAYMENT_GATEWAY` | 5 |
| PUT | `/finance/payment-gateway-configs/:id/review` | `REVIEW_PAYMENT_GATEWAY` | 5 |
| GET | `/payment-gateway-configs` | JWT | 5 |
| GET | `/transactions` | JWT (isolation theo role) | 5 |
| POST | `/transactions/export` | JWT | 5 |
| GET | `/seller/landing-cost` | JWT (seller / Admin) | 5 |

## Wallet / MLM

| Method | Path | Auth / Permission | Sprint |
|--------|------|-------------------|--------|
| GET | `/wallet/affiliate-link` | JWT | 6 |
| GET | `/wallet/network-tree` | JWT | 6 |
| GET | `/wallet/commission-stats` | JWT | 6 |
| GET | `/wallet/balance` | JWT | 6 |
| POST | `/wallet/p2p-transfer/request-otp` | JWT | 6 |
| POST | `/wallet/p2p-transfer` | JWT (password + OTP) | 6 |
| POST | `/wallet/withdraw` | JWT | 6 |
| GET | `/wallet/withdraw-requests/me` | JWT | 6 |
| GET | `/finance/withdraw-requests` | `MANAGE_WALLET_WITHDRAW` | 6 |
| PUT | `/finance/withdraw-requests/:id/decision` | `MANAGE_WALLET_WITHDRAW` | 6 |
| PUT | `/finance/withdraw-requests/:id/mark-completed` | `MANAGE_WALLET_WITHDRAW` | 6 |

---

## CMS / Marketing materials

| Method | Path | Auth / Permission | Sprint |
|--------|------|-------------------|--------|
| GET | `/banners?locale=` | Public | 7 |
| GET | `/admin/banners` | `MANAGE_BANNERS` | 7 |
| POST | `/admin/banners` | `MANAGE_BANNERS` | 7 |
| PUT | `/admin/banners/:id` | `MANAGE_BANNERS` | 7 |
| POST | `/admin/marketing-materials` | `MANAGE_MARKETING_MATERIALS` | 7 |
| GET | `/marketing-materials?folder=` | `VIEW_MKT_MAT` | 7 |
| GET | `/marketing-materials/download?folder=` | `VIEW_MKT_MAT` | 7 |

---

## System Admin (Audit / Backup / Anonymize)

| Method | Path | Auth / Permission | Sprint |
|--------|------|-------------------|--------|
| GET | `/super-admin/audit-logs` | `VIEW_AUDIT_LOGS` | 7 |
| POST | `/super-admin/backups` | `MANAGE_BACKUPS` | 7 |
| GET | `/super-admin/backups` | `MANAGE_BACKUPS` | 7 |
| GET | `/super-admin/backups/:id` | `MANAGE_BACKUPS` | 7 |
| POST | `/super-admin/anonymization-requests` | `MANAGE_ANONYMIZATION` | 7 |
| PUT | `/super-admin/anonymization-requests/:id/execute` | `MANAGE_ANONYMIZATION` | 7 |

---

## Planned (chưa ship)

Marketing & Promotion (Module 6) — OUT OF SCOPE MVP. I18n/FX toàn hệ thống — xem [PROGRESS.md](./PROGRESS.md).
