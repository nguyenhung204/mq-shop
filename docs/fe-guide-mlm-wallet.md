# 009 — MLM Wallet · Frontend Integration Guide

> **Base URL:** `http://localhost:3000/api/v1`  
> **Auth:** Cookie JWT — `credentials: 'include'`  
> **Implement branch:** `feat/011-mlm-wallet`  
> **Flows:** referral register · network tree · PIN · P2P · personal withdraw  
> **≠** Finance seller payouts (`/admin/payouts`) — đây là **ví cá nhân** (`/wallet`, `/admin/wallet/payouts`)

---

## Decisions (MVP — locked)

| Topic | Decision |
|-------|----------|
| P2P lookup | **email** hoặc `userId` — **không** có phone |
| Tree | Closure table; API chỉ downline của actor (BR_02) |
| PIN | 6 số; OTP email trước khi set/đổi; hash Argon2 |
| Currency | USD 1:1 với order |
| Bank withdraw | **Stub** giống seller payout — approve/process không chuyển tiền thật |
| Đổi referrer | Không hỗ trợ sau register |

---

## Table of Contents

1. [Roles & permissions](#1-roles--permissions)
2. [Profile fields](#2-profile-fields)
3. [Register + referral](#3-register--referral)
4. [MLM network](#4-mlm-network)
5. [Wallet PIN](#5-wallet-pin)
6. [Wallet balance & transactions](#6-wallet-balance--transactions)
7. [P2P transfer](#7-p2p-transfer)
8. [Personal withdraw](#8-personal-withdraw)
9. [TypeScript types](#9-typescript-types)
10. [Error codes](#10-error-codes)
11. [Seed demo](#11-seed-demo)
12. [FE checklist](#12-fe-checklist)

---

## 1. Roles & permissions

| Permission | Buyer/Seller | Accountant | Admin | Super Admin |
|------------|--------------|------------|-------|-------------|
| `GET_REF_LINK` | SELF | — | — | ALL |
| `VIEW_MLM_TREE` | SELF | ALL | ALL | ALL |
| `SET_WALLET_PIN` | SELF | — | — | ALL |
| `VIEW_WALLET` | SELF | ALL* | ALL* | ALL |
| `TRANSFER_P2P` | SELF | — | — | ALL |
| `CREATE_PAYOUT` | SELF | — | — | ALL |
| `APPROVE_PAYOUT` | — | APPROVE | APPROVE | ALL |
| `PROCESS_PAYOUT` | — | ALL | — | ALL |

\* Matrix cho Acc/Admin `VIEW_WALLET` = ALL — MVP API hiện chỉ trả **ví của chính actor** (`GET /wallet`). Acc/Admin dùng list payout admin.

### UI gate gợi ý

| Màn | Ai thấy |
|-----|---------|
| Referral link / share | Buyer / Seller đã login |
| Network tree (downline) | Buyer / Seller; Acc/Admin có thể `?userId=` |
| Wallet balance / TX / PIN / P2P / Withdraw | Buyer / Seller (+ SA) |
| Admin wallet payouts approve/reject | Accountant / Admin |
| Process payout (stub bank) | Accountant / Super Admin |

---

## 2. Profile fields

`GET /users/me` (và auth session `data.user`) đã enrich:

| Field | Type | Note |
|-------|------|------|
| `referrerId` | `string \| null` | Upline trực tiếp |
| `referralCode` | `string \| null` | Mã share |
| `mlmRank` | `number` 1–10 | Cấp MLM |
| `hasWalletPin` | `boolean` | Gate UI: chưa set PIN → bắt flow OTP |

---

## 3. Register + referral

### `POST /auth/register`

Body thêm optional:

```json
{
  "email": "new@example.com",
  "password": "Password1!",
  "fullName": "New Buyer",
  "referrerCode": "MLMROOT1"
}
```

- `referrerCode` lưu Redis pending → verify OTP gắn `referrerId`
- Sai / không tồn tại → `REFERRER_NOT_FOUND` ngay lúc start register

### `POST /auth/register/verify-otp`

Không cần gửi lại `referrerCode`. Sau verify: user có `referralCode` mới + wallet + closure self-row.

Deep link FE: `{FRONTEND_URL}/register?ref=MLMROOT1` → prefill `referrerCode`.

---

## 4. MLM network

### `GET /mlm/referral-link` · `GET_REF_LINK`

```json
{
  "referralCode": "MLMROOT1",
  "referralLink": "http://localhost:3001/register?ref=MLMROOT1"
}
```

### `GET /mlm/network-tree` · `VIEW_MLM_TREE`

Query:

| Param | Default | Max |
|-------|---------|-----|
| `maxDepth` | 20 | 20 |
| `limit` | 500 | 500 |
| `userId` | — | Chỉ Acc/Admin/SA (scope ALL) |

Response:

```json
{
  "rootUserId": "…",
  "maxDepth": 20,
  "truncated": false,
  "totalDownline": 3,
  "nodes": [
    {
      "userId": "…",
      "depth": 1,
      "email": "mlm-f1a@example.com",
      "fullName": "MLM F1 A",
      "mlmRank": 3,
      "referrerId": "…"
    }
  ]
}
```

- `depth` 1 = F1, 2 = F2…
- Buyer thường **không** truyền `userId` (chỉ cây mình)
- Vượt limit cứng → `MLM_TREE_TOO_LARGE`

---

## 5. Wallet PIN

### `POST /wallet/pin/request-otp` · `SET_WALLET_PIN`

Gửi OTP email (`OTP_WALLET_PIN`).

### `POST /wallet/pin/confirm`

```json
{ "otp": "123456", "pin": "123456", "confirmPin": "123456" }
```

- PIN đúng 6 chữ số
- `pin !== confirmPin` hoặc OTP sai → `WALLET_PIN_INVALID` / `INVALID_OTP`
- Sau OK: `hasWalletPin: true` trên profile lần fetch sau

P2P / withdraw **bắt buộc** đã set PIN → không thì `WALLET_PIN_REQUIRED`.

---

## 6. Wallet balance & transactions

### `GET /wallet` · `VIEW_WALLET`

```json
{
  "id": "…",
  "userId": "…",
  "availableBalance": "500.00",
  "frozenBalance": "0.00",
  "currency": "USD",
  "updatedAt": "…"
}
```

UI: hiển thị **Available** vs **Frozen** (đang chờ rút).

### `GET /wallet/transactions?page=&pageSize=`

Mỗi dòng: `direction` `IN|OUT`, `reason`, `amount`, `availableAfter`, `frozenAfter`, `counterpartyUserId?`, `refType`/`refId`, `meta`, `createdAt`.

`reason` values: `P2P` · `WITHDRAW_FREEZE` · `WITHDRAW_RELEASE` · `WITHDRAW_COMPLETE` · `REFERRAL` · `TEAM` · `GLOBAL` · `LOYALTY` · `ADJUST`

---

## 7. P2P transfer

### `POST /wallet/transfer/preview` · `TRANSFER_P2P`

```json
{ "email": "buyer@example.com" }
```
hoặc `{ "userId": "uuid" }`

→ `{ userId, email, fullName }` — màn confirm trước khi nhập PIN.

### `POST /wallet/transfer`

```json
{
  "email": "buyer@example.com",
  "amount": 10.5,
  "pin": "123456"
}
```

- Không tự transfer · insufficient → `WALLET_INSUFFICIENT_BALANCE`
- Self → `WALLET_TRANSFER_SELF`
- PIN sai → `WALLET_PIN_INVALID`

---

## 8. Personal withdraw

**Khác** `POST /admin/payouts` (seller finance).

### Flow status

```
User create ──► PENDING ──► APPROVED ──► COMPLETED
                  │              │
                  └─ REJECTED    └─ (process fail → PAY_FAILED; stub hiện luôn COMPLETED)
```

Số dư:

1. Create: `available −` / `frozen +`
2. Reject / PAY_FAILED: `frozen −` / `available +`
3. Complete: `frozen −` only

### `POST /wallet/withdraw` · `CREATE_PAYOUT`

```json
{
  "amount": 50,
  "pin": "123456",
  "bankInfo": {
    "bankName": "Vietcombank",
    "accountNumber": "0123456789",
    "accountName": "NGUYEN VAN A"
  }
}
```

### Admin

| Method | Path | Permission |
|--------|------|------------|
| GET | `/admin/wallet/payouts?status=&userId=&page=` | `APPROVE_PAYOUT` |
| POST | `/admin/wallet/payouts/:id/approve` | `APPROVE_PAYOUT` |
| POST | `/admin/wallet/payouts/:id/reject` | body `{ "reason": "…" }` |
| POST | `/admin/wallet/payouts/:id/process` | `PROCESS_PAYOUT` → stub `gatewayRef` |

---

## 9. TypeScript types

```ts
type Wallet = {
  id: string;
  userId: string;
  availableBalance: string;
  frozenBalance: string;
  currency: "USD";
  updatedAt: string;
};

type WalletTxReason =
  | "P2P"
  | "WITHDRAW_FREEZE"
  | "WITHDRAW_RELEASE"
  | "WITHDRAW_COMPLETE"
  | "REFERRAL"
  | "TEAM"
  | "GLOBAL"
  | "LOYALTY"
  | "ADJUST";

type PayoutRequestStatus =
  | "PENDING"
  | "APPROVED"
  | "COMPLETED"
  | "REJECTED"
  | "PAY_FAILED";

type NetworkNode = {
  userId: string;
  depth: number;
  email: string | null;
  fullName: string | null;
  mlmRank: number | null;
  referrerId: string | null;
};
```

---

## 10. Error codes

| Code | Khi nào |
|------|---------|
| `REFERRER_NOT_FOUND` | `referrerCode` không tồn tại |
| `REFERRER_INVALID` | Referrer không hợp lệ |
| `WALLET_NOT_FOUND` | Ví thiếu (hiếm — auto-create lúc register) |
| `WALLET_PIN_REQUIRED` | Chưa set PIN |
| `WALLET_PIN_INVALID` | PIN / confirm sai |
| `WALLET_INSUFFICIENT_BALANCE` | Available không đủ |
| `WALLET_TRANSFER_SELF` | P2P chính mình |
| `WALLET_RECIPIENT_NOT_FOUND` | Email/userId không có |
| `MLM_TREE_TOO_LARGE` | Tree vượt limit |
| `MLM_USER_PAYOUT_NOT_FOUND` | Payout id sai |
| `MLM_USER_PAYOUT_INVALID_STATUS` | Sai bước approve/reject/process |
| `INVALID_OTP` | OTP PIN hết hạn / sai |

---

## 11. Seed demo

Password mặc định: `Seed123456!` · Wallet PIN demo: `123456`

| Account | Note |
|---------|------|
| `mlm-root@example.com` | Rank 5 · code `MLMROOT1` · available `500.00` |
| `mlm-f1a@example.com` | F1 of root · rank 3 |
| `mlm-f1b@example.com` | F1 of root |
| `mlm-f2@example.com` | F2 under f1a |
| `buyer@example.com` | Cũng gắn dưới root · available `100.00` |

Smoke:

1. Login `mlm-root` → `GET /mlm/referral-link` · `GET /mlm/network-tree`
2. `GET /wallet` → 500
3. Transfer preview/email `buyer@example.com` + PIN `123456`
4. Withdraw nhỏ → Acc `accountant@example.com` approve → process

---

## 12. FE checklist

### Buyer / Seller

- [ ] Register form optional `referrerCode` / `?ref=`
- [ ] Profile: `referralCode`, `mlmRank`, `hasWalletPin`
- [ ] Share referral link
- [ ] Network tree (depth badge F1/F2)
- [ ] Set PIN (OTP → confirm)
- [ ] Wallet available / frozen
- [ ] TX list filter theo `reason` (optional FE)
- [ ] P2P: preview → confirm PIN → success
- [ ] Withdraw form + bankInfo + status tracking

### Accountant / Admin

- [ ] `/admin/wallet/payouts` queue (≠ seller `/admin/payouts`)
- [ ] Approve / reject (+ reason)
- [ ] Process (Accountant / SA)
- [ ] Network tree `?userId=` (optional ops)

---

Chi tiết entity: `specs/009-mlm-wallet/entity-reference.md`  
Commission (thưởng): `specs/010-commission-calculation/contracts/fe-guide-commission.md`
