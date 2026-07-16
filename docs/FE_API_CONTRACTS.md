# Frontend API Contracts — MQ Shopping

> Payload / query / response chính xác theo DTO BE. Dùng kèm [FE_GUIDE.md](./FE_GUIDE.md) (nghiệp vụ) và [API_CATALOG.md](./API_CATALOG.md) (danh mục).  
> Prefix: `/api/v1` · `Content-Type: application/json`

**Cập nhật:** 2026-07-16

---

## Auth

### `POST /auth/register`
```json
{
  "email": "a@b.com",
  "password": "Password1",
  "phone": "+8490...",
  "fullName": "Nguyen Van A",
  "referralCode": "ABC123"
}
```
Response: `{ id, email, status, message }` — `status` thường `PENDING_VERIFY`.

### `POST /auth/verify-otp`
```json
{ "email": "a@b.com", "code": "123456" }
```

### `POST /auth/login`
```json
{ "identifier": "a@b.com", "password": "Password1" }
```
Response:
```json
{
  "user": {
    "id": "uuid",
    "email": "...",
    "fullName": "...",
    "roles": ["BUYER"],
    "permissions": []
  },
  "accessToken": "...",
  "refreshToken": "..."
}
```

### `POST /auth/refresh-token`
```json
{ "refreshToken": "..." }
```
→ `{ accessToken, refreshToken }`

### `POST /auth/forgot-password` / `POST /auth/reset-password`
Forgot: `{ "email" }`  
Reset: `{ "email", "code", "newPassword" }`

---

## Users

### `GET /users/me`
`{ id, email, phone, fullName, avatarUrl, dateOfBirth, status, roles, permissions, emailVerifiedAt, createdAt }`

### `PUT /users/me/profile`
```json
{ "fullName": "...", "avatarUrl": "https://...", "dateOfBirth": "1990-01-01" }
```

### `PUT /users/me/password`
```json
{ "currentPassword": "...", "newPassword": "Password1" }
```
Sau đổi mật khẩu: logout / bắt login lại.

### Change email
1. `POST /users/me/change-email/request-otp` → `{ "newEmail": "new@b.com" }`
2. `PUT /users/me/change-email/confirm` → `{ "code": "123456" }`

---

## Shops

### `POST /shops/apply`
```json
{
  "name": "Shop ABC",
  "taxCode": "0123456789",
  "countryCode": "VN",
  "pickupAddress": "...",
  "legalDocumentUrl": "https://..."
}
```

### Reject / Suspend (Admin)
```json
{
  "reason": { "vi": "Thiếu giấy tờ", "en": "Missing docs", "zh-TW": "..." }
}
```

**ShopStatus:** `PENDING` | `APPROVED` | `REJECTED` | `SUSPENDED`

---

## Products

### `POST /seller/products`
```json
{
  "categoryId": "uuid",
  "sku": "SKU-001",
  "priceUsd": 19.99,
  "stockSummary": "In stock",
  "translations": [
    { "locale": "vi", "name": "Áo", "description": "..." },
    { "locale": "en", "name": "Shirt" }
  ],
  "images": [{ "url": "https://...", "sortOrder": 0 }]
}
```
**Locale enum BE:** `vi` | `en` | `zh_TW`

### Search
`GET /products/search?q=&categoryId=&locale=vi&page=1&limit=20`  
→ `{ page, limit, total, items: [...] }`

**ProductStatus:** `PENDING` | `ACTIVE` | `REJECTED`

---

## Inventory

### `POST /inventory/requests`
```json
{
  "warehouseId": "uuid",
  "sku": "SKU-001",
  "quantity": 10,
  "requestType": "IN",
  "reason": "Nhập lô 1",
  "evidenceDocumentUrl": "https://..."
}
```
`requestType`: `IN` | `ADJUST_IN` | `ADJUST_OUT`  
`status`: `PENDING` | `APPROVED` | `REJECTED`

### Seller reject
```json
{ "reason": "Sai số lượng" }
```

---

## Cart & Orders

### Cart item
```json
{ "productId": "uuid", "quantity": 2 }
```

### Checkout
```json
{
  "paymentMethod": "COD",
  "shippingAddress": "123 Le Loi, Q1",
  "shippingCountry": "VN",
  "cartItemIds": ["uuid"]
}
```
`paymentMethod`: `COD` | `BANK_TRANSFER` | `CARD`

### Cancel
```json
{ "reason": "Đổi ý" }
```

**OrderStatus:** `PENDING` | `CONFIRMED` | `PROCESSING` | `SHIPPED` | `DELIVERED` | `CANCELLED` | `EXPIRED`  
**PaymentStatus:** `UNPAID` | `PAID` | `FAILED` | `REFUND_PENDING`

Amounts trong response thường là **string** decimal.

---

## RMA

### Create
```json
{
  "reason": "Hàng lỗi",
  "evidenceUrls": ["https://..."],
  "refundAccountInfo": "STK ..."
}
```

### Admin decision
```json
{ "decision": "APPROVED" }
```
```json
{ "decision": "REJECTED", "reason": "Không đủ điều kiện" }
```

### Seller confirm stock
```json
{
  "warehouseId": "uuid",
  "sku": "SKU-001",
  "quantity": 1,
  "kind": "RETURNED",
  "note": "Hàng về kho A"
}
```
`kind`: `RETURNED` | `NEW`  
**RmaStatus:** `REQUESTED` | `APPROVED` | `REJECTED` | `STOCK_RETURNED` | `WITHDRAWN`

---

## Finance

### Payout reject
```json
{ "reason": "Sai thông tin" }
```

### Gateway review
```json
{ "decision": "APPROVED" }
```
```json
{ "decision": "REJECTED", "reason": "..." }
```

**PayoutBatchStatus:** `PENDING` | `APPROVED` | `REJECTED` | `COMPLETED`  
**PaymentGatewayStatus:** `PENDING_REVIEW` | `ACTIVE` | `REJECTED`

### Commission override
```json
{ "commissionRate": 0.08 }
```

---

## Wallet

### Request P2P OTP
```json
{ "recipient": "user@email.com", "amountPoints": 10.5 }
```

### P2P transfer
```json
{
  "recipient": "user@email.com",
  "amountPoints": 10.5,
  "password": "Password1",
  "otpCode": "123456",
  "idempotencyKey": "fe-generated-uuid-or-key"
}
```

### Withdraw
```json
{
  "amountPoints": 100,
  "bankInfo": {
    "bankName": "VCB",
    "accountNumber": "0123456789",
    "accountName": "NGUYEN VAN A"
  }
}
```

### Admin withdraw decision
```json
{ "decision": "APPROVED" }
```
```json
{ "decision": "REJECTED", "reason": "Sai STK" }
```

**WalletPayoutStatus:** `PENDING` | `APPROVED` | `REJECTED` | `COMPLETED`

---

## CMS

### Create banner
```json
{
  "imageUrl": "https://...",
  "targetUrl": "https://...",
  "locale": "vi",
  "title": "Sale 7.7",
  "displayOrder": 0,
  "isActive": true
}
```

### Marketing material
```json
{
  "folderPath": "campaigns/2026-q3",
  "fileName": "poster.pdf",
  "fileUrl": "https://cdn/.../poster.pdf"
}
```

Public banners: `GET /banners?locale=vi`

---

## System

### Backup
```json
{ "backupType": "FULL" }
```
`backupType`: `FULL` | `PARTIAL`  
Poll: `GET /super-admin/backups/:id` — `RUNNING` | `COMPLETED` | `FAILED`

### Anonymization
```json
{ "targetUserId": "uuid" }
```
Execute: `PUT /super-admin/anonymization-requests/:id/execute`  
Status: `PENDING_CHECK` | `BLOCKED` | `COMPLETED` — nếu block đọc `blockedReason`.

### Audit logs
`GET /super-admin/audit-logs?from=&to=&actorEmail=&actionType=&ipAddress=`

---

## Notifications

`GET /notifications?unreadOnly=true`  
`PUT /notifications/:id/read`  
`PUT /notifications/read-all`

### Realtime (Socket.IO)

- Namespace: `{HOST}/notifications` (không dùng prefix `/api/v1`)
- Connect: `auth: { token: accessToken }`
- Event: `notification` → `{ notification, unreadCount }`
- Event: `connected` → `{ userId, room }`

Chi tiết FE: [FE_GUIDE.md](./FE_GUIDE.md) §11.

---

## HTTP errors (FE handling)

| Status | Hành vi FE |
|--------|------------|
| 400 | Hiện message validation / business BadRequest |
| 401 | Refresh token → retry; fail → login |
| 403 | Ẩn CTA / trang “Không có quyền” |
| 404 | Not found |
| 409 | Conflict: email trùng, đã có shop, SKU trùng, giỏ 2 shop, idempotency P2P |

ValidationPipe: field lạ / sai kiểu → 400.
