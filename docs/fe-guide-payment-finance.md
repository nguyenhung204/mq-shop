# 007 — Payment & Finance · Frontend Integration Guide

> **Base URL:** `http://localhost:3000/api/v1`  
> **Auth:** Cookie JWT — `credentials: 'include'`  
> **Implement branch:** `feat/010-payment-finance`  
> **Flows:** payout · finance config · landing cost · transaction reports  
> **Specs PNG:** `flow-01-payout.png` … `flow-04-transaction-reports.png`

---

## Decisions (MVP — locked)

| Topic | Decision |
|-------|----------|
| Bank / payment gateway | **Stub** — approve payout → `COMPLETED` + `gatewayRef`, **không** chuyển tiền thật |
| Seller payout source | Gom `SellerSettlement` status `PENDING_RECONCILE` trong kỳ |
| Dual-control config | Super Admin **submit** → `PENDING_APPROVAL`; Accountant **approve** → `ACTIVE` |
| Secrets | FE gửi `apiKey` / `secretKey` plain; BE encrypt AES-256-GCM. Response chỉ `hasApiKey` / `hasSecretKey` |
| Landing cost | Stateless calculator; FE tự truyền `discount` / `promoDiscount` (chưa apply KM DB) |
| Wallet withdraw | **Out of scope** — module **009** (`CREATE_PAYOUT` / wallet) |
| Commission credit | **Out of scope** — module **010**; FE chỉ hiển thị `commissionPercent` trên config |

---

## Table of Contents

1. [Roles & permissions](#1-roles--permissions)
2. [Enums & status flows](#2-enums--status-flows)
3. [Finance config](#3-finance-config)
4. [Seller payouts](#4-seller-payouts)
5. [Settlements (liên quan 005)](#5-settlements-liên-quan-005)
6. [Landing cost](#6-landing-cost)
7. [Transactions & export](#7-transactions--export)
8. [TypeScript types](#8-typescript-types)
9. [Error codes](#9-error-codes)
10. [Seed demo](#10-seed-demo)
11. [FE checklist](#11-fe-checklist)

---

## 1. Roles & permissions

Matrix (GUEST…SUPER_ADMIN): xem `role-permission.matrix.ts`.

| Permission | Ai dùng UI | Scope gợi ý |
|------------|------------|-------------|
| `CONFIG_FEE` | Super Admin submit; Accountant approve/reject | SA=`ALL`, Accountant=`APPROVE`, **Admin=`NONE`** |
| `PAYOUT_SELLER` | Accountant/Admin tạo + duyệt payout | Accountant=`ALL`, Admin=`APPROVE`, Seller=`SHOP` |
| `VIEW_TRANSACT` | List TX + admin settlements | Buyer=`SELF`, Seller=`SHOP`, Acc/Admin/SA=`ALL` |
| `EXPORT_REPORT` | Export CSV/XLSX | Seller=`SHOP`, Acc/Admin/SA=`ALL` |
| `CALC_LAND_COST` | Calculator landing cost | Buyer=`SELF`, Seller=`SHOP`, CS+staff=`ALL` |

### UI gate gợi ý

| Màn | Role |
|-----|------|
| Submit finance config | `superadmin@example.com` |
| Approve / reject config | `accountant@example.com` |
| Create / list / approve payouts | Accountant (+ Admin approve) |
| Landing cost tool | Seller / Accountant / Admin |
| Transactions / export | Seller (shop mình) · Accountant/Admin (all) |
| Settlements pending | Seller `GET /settlements` · Admin `GET /admin/settlements` |

---

## 2. Enums & status flows

### FinanceConfigStatus

```
Super Admin POST ──► PENDING_APPROVAL
                         │
          Accountant approve │ Accountant reject
                             ▼                  ▼
                          ACTIVE            REJECTED
```

- Approve config đang `ACTIVE` khác → BE **deactivate** config ACTIVE cũ rồi activate config mới.
- Response **không** trả plaintext keys.

### PayoutStatus

```
Accountant POST create ──► PENDING
                              │
               Admin/Acc approve │ reject
                                 ▼         ▼
                            COMPLETED   REJECTED
```

| Action | Settlement side-effect |
|--------|------------------------|
| Create payout | Settlements → `INCLUDED_IN_PAYOUT` |
| Approve | → `PAID_OUT` + stub `gatewayRef` |
| Reject | → quay lại `PENDING_RECONCILE` |

### SettlementStatus (005, dùng bởi 007)

`PENDING_RECONCILE` → `INCLUDED_IN_PAYOUT` → `PAID_OUT`

Công thức net khi create payout (BE):

```
gross = Σ settlement.amount
platformFee = gross * activeConfig.platformFeePercent / 100
shipping = Σ order.shippingFee (các order trong items)
net = max(0, gross - platformFee - shipping)
```

---

## 3. Finance config

Base: `/admin/finance/configs` — cần `CONFIG_FEE`.

| Method | Path | Ai | Note |
|--------|------|----|------|
| `POST` | `/admin/finance/configs` | Super Admin | → `PENDING_APPROVAL` |
| `GET` | `/admin/finance/configs?status=&page=` | Acc / SA | Paginated |
| `GET` | `/admin/finance/configs/active` | Acc / SA | `data: null` nếu chưa có |
| `POST` | `/admin/finance/configs/:configId/approve` | Accountant (+ SA) | → `ACTIVE` |
| `POST` | `/admin/finance/configs/:configId/reject` | Accountant (+ SA) | body `{ "reason": "…" }` |

### Create body

```json
{
  "platformFeePercent": "5.00",
  "commissionPercent": "2.00",
  "gatewayName": "SEED_STUB",
  "apiKey": "optional-plain",
  "secretKey": "optional-plain"
}
```

### Response view (không có secrets)

```json
{
  "id": "uuid",
  "platformFeePercent": "5.0000",
  "commissionPercent": "2.0000",
  "gatewayName": "SEED_STUB",
  "hasApiKey": true,
  "hasSecretKey": true,
  "status": "ACTIVE",
  "rejectionReason": null,
  "createdByUserId": "uuid",
  "reviewedByUserId": "uuid",
  "reviewedAt": "…",
  "activatedAt": "…",
  "createdAt": "…",
  "updatedAt": "…"
}
```

### Dual-control UX

1. SA mở form → Submit → badge `PENDING_APPROVAL`
2. Accountant inbox `?status=PENDING_APPROVAL` → Approve / Reject (+ reason)
3. Màn “Active fee”: `GET …/active` — dùng khi preview phí payout

---

## 4. Seller payouts

Base: `/admin/payouts` — `PAYOUT_SELLER`.

| Method | Path | Note |
|--------|------|------|
| `POST` | `/admin/payouts` | Gom settlements `PENDING_RECONCILE` trong `[periodStart, periodEnd]` |
| `GET` | `/admin/payouts?shopId=&status=&page=` | |
| `GET` | `/admin/payouts/:payoutId` | Kèm `items[]` |
| `POST` | `/admin/payouts/:payoutId/approve` | Stub gateway → `COMPLETED` |
| `POST` | `/admin/payouts/:payoutId/reject` | `{ "reason": "…" }` → release settlements |

### Create body

```json
{
  "shopId": "uuid",
  "periodStart": "2026-07-01T00:00:00.000Z",
  "periodEnd": "2026-07-31T23:59:59.000Z"
}
```

- Không có settlement trong kỳ → `422` `PAYOUT_NO_SETTLEMENTS`
- Cần có finance config `ACTIVE` (nếu không → `FINANCE_CONFIG_NOT_FOUND`)

### Payout view

```ts
{
  id: string;
  shopId: string;
  periodStart: string;
  periodEnd: string;
  grossRevenue: string;
  platformFee: string;
  shippingFee: string;
  netAmount: string;
  currency: "USD";
  status: PayoutStatus;
  rejectionReason: string | null;
  createdByUserId: string;
  approvedByUserId: string | null;
  completedAt: string | null;
  gatewayRef: string | null;
  items: Array<{
    id: string;
    settlementId: string;
    orderId: string;
    amount: string;
  }>;
  createdAt: string;
  updatedAt: string;
}
```

### FE flow (payout)

1. `GET /admin/settlements?status=PENDING_RECONCILE&shopId=` — chọn shop / kỳ
2. `GET /admin/finance/configs/active` — hiện % phí
3. `POST /admin/payouts` → slip `PENDING`
4. Approve → hiện `gatewayRef` (stub) · Reject → settlements về `PENDING_RECONCILE`

---

## 5. Settlements (liên quan 005)

| Method | Path | Ai |
|--------|------|----|
| `GET` | `/settlements?status=&page=` | Seller (shop mình) |
| `GET` | `/admin/settlements?status=&shopId=&page=` | Accountant / Admin |

Default seller list thường filter `PENDING_RECONCILE` (doanh thu chờ đối soát).

Sau `DELIVERED`, BE tạo settlement — **chưa** chi tiền; payout (007) mới gắn vào slip.

---

## 6. Landing cost

`POST /finance/landing-cost` — `CALC_LAND_COST`.

### Request

```json
{
  "items": [
    { "unitPrice": "10.00", "quantity": 2, "discount": "1.00" }
  ],
  "shippingFee": "5.00",
  "vatAmount": "1.50",
  "packagingFee": "0.50",
  "promoDiscount": "0"
}
```

| Field | Required | Note |
|-------|----------|------|
| `items[]` | Yes (min 1) | `unitPrice` number-string; `quantity` ≥ 1 |
| `discount` | No | Giảm theo dòng |
| `shippingFee` / `vatAmount` / `packagingFee` / `promoDiscount` | No | Default `0` |

### Response `data`

```json
{
  "items": [
    {
      "index": 0,
      "unitPrice": "10.00",
      "quantity": 2,
      "discount": "1.00",
      "subtotal": "20.00",
      "lineTotal": "19.00"
    }
  ],
  "breakdown": {
    "itemsSubtotal": "19.00",
    "shippingFee": "5.00",
    "vatAmount": "1.50",
    "packagingFee": "0.50",
    "promoDiscount": "0.00"
  },
  "finalAmount": "26.00"
}
```

Công thức: `final = max(0, itemsSubtotal + ship + vat + packaging - promoDiscount)`.

**Không** gọi DB promo / voucher — FE tự điền số.

---

## 7. Transactions & export

### List

`GET /finance/transactions` — `VIEW_TRANSACT`

| Query | Note |
|-------|------|
| `startDate` / `endDate` | ISO date-string |
| `type` | `ORDER` \| `PAYOUT` \| `ALL` (default) |
| `shopId` | Admin filter; Seller bị scope shop mình |
| `page` / `pageSize` | |

Row:

```ts
{
  type: "ORDER" | "PAYOUT";
  id: string;
  shopId: string | null;
  buyerId: string | null;
  amount: string;
  currency: string;
  status: string;
  occurredAt: string;
  ref: string | null; // order.code hoặc payout.gatewayRef
}
```

Isolation:

- Buyer → chỉ ORDER của mình (không thấy PAYOUT)
- Seller → ORDER + PAYOUT của shop
- Acc/Admin → all (+ optional `shopId`)

### Export

`POST /finance/reports/export` — `EXPORT_REPORT`

```json
{
  "startDate": "2026-07-01T00:00:00.000Z",
  "endDate": "2026-07-31T23:59:59.000Z",
  "type": "ALL",
  "format": "CSV",
  "shopId": "uuid"
}
```

Response:

```json
{
  "fileUrl": "https://…/reports/finance/…",
  "format": "CSV",
  "rowCount": 42
}
```

> MVP: `format=XLSX` vẫn upload nội dung CSV (extension `.xlsx`) — stub cho đến khi gắn lib Excel.

---

## 8. TypeScript types

```ts
type FinanceConfigStatus = "PENDING_APPROVAL" | "ACTIVE" | "REJECTED";
type PayoutStatus = "PENDING" | "REJECTED" | "COMPLETED";
type SettlementStatus =
  | "PENDING_RECONCILE"
  | "INCLUDED_IN_PAYOUT"
  | "PAID_OUT";

type FinanceConfig = {
  id: string;
  platformFeePercent: string;
  commissionPercent: string;
  gatewayName: string | null;
  hasApiKey: boolean;
  hasSecretKey: boolean;
  status: FinanceConfigStatus;
  rejectionReason: string | null;
  createdByUserId: string;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  activatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type CreateFinanceConfigBody = {
  platformFeePercent: string;
  commissionPercent: string;
  gatewayName?: string;
  apiKey?: string;
  secretKey?: string;
};

type SellerPayout = {
  id: string;
  shopId: string;
  periodStart: string;
  periodEnd: string;
  grossRevenue: string;
  platformFee: string;
  shippingFee: string;
  netAmount: string;
  currency: string;
  status: PayoutStatus;
  rejectionReason: string | null;
  createdByUserId: string;
  approvedByUserId: string | null;
  completedAt: string | null;
  gatewayRef: string | null;
  items: Array<{
    id: string;
    settlementId: string;
    orderId: string;
    amount: string;
  }>;
  createdAt: string;
  updatedAt: string;
};

type FinanceTransaction = {
  type: "ORDER" | "PAYOUT";
  id: string;
  shopId: string | null;
  buyerId: string | null;
  amount: string;
  currency: string;
  status: string;
  occurredAt: string;
  ref: string | null;
};
```

---

## 9. Error codes

| HTTP | Code | Khi nào |
|------|------|---------|
| 404 | `FINANCE_CONFIG_NOT_FOUND` | Không có config / thiếu ACTIVE khi tạo payout |
| 409 | `FINANCE_CONFIG_NOT_PENDING` | Approve/reject khi không `PENDING_APPROVAL` |
| 404 | `PAYOUT_NOT_FOUND` | |
| 409 | `PAYOUT_NOT_PENDING` | Approve/reject khi không `PENDING` |
| 422 | `PAYOUT_NO_SETTLEMENTS` | Không có settlement `PENDING_RECONCILE` trong kỳ |
| 404 | `SHOP_NOT_FOUND` | `shopId` create payout sai |
| 403 | `FORBIDDEN` | Thiếu permission / sai scope (vd. Admin không có `CONFIG_FEE`) |

Map UI theo `data.code`.

---

## 10. Seed demo

`pnpm seed:demo` (section 8):

| Data | Giá trị |
|------|---------|
| Config ACTIVE | fee `5%`, commission `2%`, gateway `SEED_STUB` |
| Config PENDING_APPROVAL | dual-control demo |
| Config REJECTED | có `rejectionReason` |
| Payout PENDING | order `ORD-SEED-PAYOUT-PEND` · settlement `INCLUDED_IN_PAYOUT` |
| Payout COMPLETED | order `ORD-SEED-PAYOUT-DONE` · `PAID_OUT` · `gatewayRef=STUB-SEED-PAYOUT-001` |
| Settlement sẵn tạo payout | `ORD-SEED-DELIVERED` → `PENDING_RECONCILE` |

| Account | Password | Dùng để |
|---------|----------|---------|
| `superadmin@example.com` | `Seed123456!` | Submit config |
| `accountant@example.com` | `Seed123456!` | Approve config + create/approve payout |
| `admin@example.com` | `Admin123!` | Approve payout (scope APPROVE) |
| `seller@example.com` | `Seed123456!` | Settlements / TX shop / landing cost |

Shop: **Seed Electronics Store**.

---

## 11. FE checklist

### Finance config
- [ ] Form SA: `%` phí + `%` commission + optional gateway keys (mask sau submit)
- [ ] Inbox Accountant: `PENDING_APPROVAL` → approve / reject (+ reason)
- [ ] Banner “Active config” từ `GET …/active`
- [ ] **Không** expect Admin role gọi config APIs (`CONFIG_FEE` = NONE)

### Payouts
- [ ] Chọn shop + date range; preview settlements `PENDING_RECONCILE`
- [ ] Hiển thị gross / fee / shipping / net sau create
- [ ] Queue `PENDING` → Approve (stub) / Reject
- [ ] Detail: list `items` (settlement ↔ order)
- [ ] Empty state map `PAYOUT_NO_SETTLEMENTS`

### Landing cost
- [ ] Form multi-line items + optional fees / promo
- [ ] Render breakdown + `finalAmount`
- [ ] Không phụ thuộc promo API

### Reports
- [ ] Filter type / date / shop; table ORDER + PAYOUT
- [ ] Export → mở `fileUrl` (CSV)
- [ ] Seller chỉ thấy data shop mình

### Hook notes (sau này)
- **009** wallet withdraw ≠ `seller_payouts`
- **010** commission đọc `commissionPercent` ACTIVE lúc `DELIVERED`
