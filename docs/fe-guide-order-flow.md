# 005 — Order Flow · Frontend Integration Guide

> **Base URL:** `http://localhost:3000/api/v1`  
> **Auth:** Cookie JWT — `credentials: 'include'`  
> **Implement branch:** `feat/006-order-flow`  
> **Flows:** place order · shipping · cancel · RMA

---

## Decisions (MVP — locked)

| Topic | Decision |
|-------|----------|
| Cart | **No BE cart** — FE gửi `items[]` lúc checkout |
| Multi-shop | **Forbidden** — mọi `variantId` phải cùng 1 `shopId` |
| Own shop | **Seller/buyer không mua shop mình** (`owner_id` hoặc `user.shopId`) — admin tạo hộ cũng check theo **buyer đích** |
| Admin checkout | **Có** — `POST /admin/orders/checkout` + `buyerId` (scope `CREATE_ORDER` ALL) |
| Admin list | **Có** — `GET /admin/orders` cross-shop (`VIEW_ORDER` ALL; filter `status`/`shopId`) |
| Currency | **USD** (order + settlement + shippingFee stub) |
| Shipping fee | **Stub** flat fee USD (vd. `5.00`) — FE preview qua `POST /orders/shipping-quote`; checkout quote lại khi đặt |
| Payment | **Stub:** `COD` → `PENDING`; `MOCK` → `PAID` |
| RMA refund | Approve → order `REFUND_APPROVED` — **không** gọi payment gateway; KT chuyển ngoài |
| RMA evidence | **Optional** multipart upload max **5** ảnh (giống product gallery) |
| Cancel window | Chỉ `PENDING` \| `PAID` \| `CONFIRMED` \| `PACKED` |
| Stock | Checkout: `available → reserved`; cancel/expire: hoàn lại; `DELIVERED`: trừ dứt `reserved` |
| Restock after RMA | Seller tạo phiếu **004** (`IN` / `ADJUST_IN`) — không auto |
| SellerSettlement | Bút toán chờ đối soát / payout khi `DELIVERED` (chưa chi tiền) |

---

## Table of Contents

1. [Status model](#1-status-model)
2. [Checkout (Flow 01)](#2-checkout-flow-01)
3. [List / detail](#3-list--detail)
4. [Shipping progress (Flow 02)](#4-shipping-progress-flow-02)
5. [Cancel (Flow 03)](#5-cancel-flow-03)
6. [RMA (Flow 04–05)](#6-rma-flow-04-05)
7. [Admin](#7-admin)
8. [TypeScript types](#8-typescript-types)
9. [Error codes](#9-error-codes)
10. [FE checklist](#10-fe-checklist)

---

## 1. Status model

```
PENDING → PAID → CONFIRMED → PACKED → SHIPPED → DELIVERED
  └──────── cancel (before SHIPPED) ──────────► CANCELLED

DELIVERED → (RMA approve) → REFUND_APPROVED → (later/007) REFUNDED
```

| Status | Ai set | Ghi chú FE |
|--------|--------|------------|
| `PENDING` | Checkout `COD` | Hiện “chờ thanh toán”; cron hủy sau **30 ngày** |
| `PAID` | Checkout `MOCK` | |
| `CONFIRMED` / `PACKED` / `SHIPPED` | Seller/NV | `PATCH …/status` |
| `DELIVERED` | Seller/NV | Mốc **7 ngày** mở RMA |
| `CANCELLED` | Buyer/Seller/Admin | Stock hoàn reserved |
| `REFUND_APPROVED` | Admin/KT | UI: “đã duyệt hoàn — chờ KT chuyển khoản” |

---

## 2. Checkout (Flow 01)

### 2.1 Preview phí ship (không tạo đơn)

```
POST /orders/shipping-quote
```

**Permission:** `CREATE_ORDER` (BUYER)  
**Khi nào gọi:** màn checkout — user đổi địa chỉ / đổi `items[]` (debounce ~300–500ms). Không tạo order, không reserve stock.

**Request** (giống checkout, **không** có `paymentMethod` / `note`):

```json
{
  "items": [{ "variantId": "uuid", "quantity": 2 }],
  "shippingAddress": {
    "fullName": "Nguyen Van A",
    "phone": "0901234567",
    "line1": "123 Nguyen Hue",
    "city": "HCM",
    "district": "Q1",
    "country": "VN"
  }
}
```

**Response `200` (envelope chuẩn):**

```json
{
  "message": "Shipping quote retrieved successfully",
  "data": {
    "shopId": "uuid",
    "itemCount": 2,
    "shippingFee": 5,
    "currency": "USD"
  }
}
```

| Field | FE dùng |
|-------|---------|
| `shippingFee` | Hiện dòng “Phí vận chuyển” |
| `currency` | Luôn `USD` (MVP) |
| `shopId` | Optional — assert 1 shop / debug |
| `itemCount` | Debug / copy “N sản phẩm” |

**Rule giống checkout:** 1 shop; `ORDER_OWN_SHOP_FORBIDDEN` nếu mua shop mình; `ORDER_MULTI_SHOP` / `VARIANT_NOT_FOUND` tương tự.

**Lưu ý UX:**

- Tổng tạm = `sum(lineTotal)` (FE tính từ giá listing) + `data.shippingFee`
- Khi bấm đặt hàng, gọi `POST /orders/checkout` — BE **quote lại**; lấy `data.shippingFee` / `data.total` từ order response làm nguồn đúng (có thể lệch nếu sau này carrier đổi giá giữa preview và checkout)
- MVP stub luôn `5` USD → preview gần như cố định; vẫn gọi API để sẵn sàng khi gắn GHN/GHTK

### 2.2 Đặt hàng

```
POST /orders/checkout
```

**Permission:** `CREATE_ORDER` (BUYER)

```json
{
  "items": [
    { "variantId": "uuid", "quantity": 2 }
  ],
  "shippingAddress": {
    "fullName": "Nguyen Van A",
    "phone": "0901234567",
    "line1": "123 Nguyen Hue",
    "city": "HCM",
    "district": "Q1",
    "country": "VN"
  },
  "paymentMethod": "MOCK",
  "note": "Giao giờ hành chính"
}
```

**BE làm:**

1. Resolve variants → assert **cùng một shop**  
2. `ShippingQuote` stub → `shippingFee`  
3. TX: `SELECT FOR UPDATE` → check `availableStock` → reserve  
4. Tạo order + items (snapshot `sku`, `title`, `unitPrice = sellingPrice`)  
5. `COD` → `PENDING`; `MOCK` → `PAID`

**Response `201` (shape):**

```json
{
  "message": "Order placed successfully",
  "data": {
    "id": "order-uuid",
    "code": "ORD-20260722-0001",
    "status": "PAID",
    "shopId": "shop-uuid",
    "subtotal": 59.98,
    "shippingFee": 5.00,
    "total": 64.98,
    "currency": "USD",
    "paymentMethod": "MOCK",
    "items": [
      {
        "variantId": "…",
        "sku": "MOUSE-001",
        "titleSnapshot": "Wireless Mouse Pro",
        "unitPrice": 29.99,
        "quantity": 2,
        "lineTotal": 59.98
      }
    ],
    "createdAt": "…"
  }
}
```

> Tiền tệ: **`currency: "USD"`** mặc định. `shippingFee` stub cùng đơn vị USD.

**Errors (checkout + shipping-quote):**

| HTTP | Code | Khi nào |
|------|------|---------|
| 400 | `ORDER_MULTI_SHOP` | Items nhiều shop |
| 403 | `ORDER_OWN_SHOP_FORBIDDEN` | Buyer là owner / staff (`shopId`) của shop đó |
| 400 | `INSUFFICIENT_STOCK` | Không đủ `availableStock` (**chỉ checkout**) |
| 404 | `VARIANT_NOT_FOUND` | SKU không tồn tại |

---

## 3. List / detail

```
GET /orders?status=&page=&pageSize=
GET /orders/:orderId
```

- **Buyer:** chỉ đơn của mình  
- **Seller / WAREHOUSE / CS:** đơn của shop (qua owner hoặc `user.shopId`)

---

## 4. Shipping progress (Flow 02)

```
PATCH /orders/:orderId/status
{ "status": "CONFIRMED" | "PACKED" | "SHIPPED" | "DELIVERED", "note?": "…" }
```

**Permission:** `UPDATE_ORDER`

| Target | Side effect |
|--------|-------------|
| `CONFIRMED` / `PACKED` / `SHIPPED` | Đổi status + history |
| `DELIVERED` | Trừ dứt `reservedStock`; tạo **SellerSettlement** (`PENDING_RECONCILE`, amount ≈ subtotal USD); set `deliveredAt` |

**SellerSettlement (hiểu nhanh):** sổ “shop được bao nhiêu từ đơn này — chưa chi trả”. Không cộng ví ngay; module 007 dùng để đối soát / payout.

Chỉ cho phép **tiến tới** đúng transition (không nhảy cóc — matrix cứng trên BE).

### Doanh thu chờ đối soát (MVP — read-only)

```
GET /settlements?status=PENDING_RECONCILE&page=&pageSize=
GET /admin/settlements?shopId=&status=&page=&pageSize=
```

| Actor | Path | Scope |
|-------|------|-------|
| Seller | `GET /settlements` | `VIEW_TRANSACT` **SHOP** — chỉ shop mình |
| Admin / Accountant | `GET /admin/settlements` | `VIEW_TRANSACT` **ALL** — optional `shopId` |

- Default `status` = `PENDING_RECONCILE`
- Chưa có API đánh dấu đã đối soát / payout

**Wire sau ResponseInterceptor** (giống orders — `summary` sibling bị flatten mất, nên tổng nằm trên `meta`):

```ts
{
  statusCode: number;
  message: string;
  data: SettlementView[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    pendingTotal: number; // tổng mọi trang cùng filter
    status: 'PENDING_RECONCILE';
    currency: 'USD';
  };
}

interface SettlementView {
  id: string;
  shopId: string;
  orderId: string;
  orderCode: string | null;
  amount: number;
  currency: 'USD';
  status: 'PENDING_RECONCILE';
  createdAt: string;
}
```

**FE:** đọc `meta.pendingTotal` (fallback shape cũ `{ items, meta, summary }` nếu cần).

---

## 5. Cancel (Flow 03)

```
POST /orders/:orderId/cancel
{ "reason": "Đổi ý" }
```

**Permission:** `CANCEL_ORDER`

| Actor | Hành vi |
|-------|---------|
| Buyer | Hủy đơn của mình (trong cửa sổ status) |
| Seller | Hủy đơn shop |
| Admin | `POST /admin/orders/:orderId/cancel` — không cần duyệt thêm |

BE: status `CANCELLED` + `reserved → available`.  
**Không** auto hoàn tiền qua gateway.

---

## 6. RMA (Flow 04–05)

### Buyer tạo

```
POST /orders/:orderId/rma
```

```json
{
  "reason": "Sản phẩm lỗi",
  "bankInfo": {
    "bankName": "VCB",
    "accountNumber": "0123456789",
    "accountName": "NGUYEN VAN A"
  }
}
```

Điều kiện: order `DELIVERED` và ≤ **7 ngày** kể từ `deliveredAt`.  
→ RMA `PENDING`, `evidenceUrls: []`; notify Seller + CS.

### Evidence ảnh (optional — giống product)

```
POST /rma/:rmaId/evidence
Content-Type: multipart/form-data
field: images  (max 5 files)
```

- Chỉ buyer chủ RMA, chỉ khi RMA còn `PENDING`
- WebP → MinIO; append URL vào `evidenceUrls` (tổng ≤ 5)
- Xóa: `DELETE /rma/:rmaId/evidence` `{ "urls": ["…"] }`

Không bắt buộc upload — admin vẫn duyệt được RMA không ảnh.

### Admin / Accountant

```
GET  /admin/rma?status=PENDING
POST /admin/rma/:rmaId/approve   { "note?": "…" }
POST /admin/rma/:rmaId/reject    { "note": "…" }
```

- **Approve:** RMA `APPROVED`, order `REFUND_APPROVED` — KT hoàn **ngoài** hệ thống theo `bankInfo`  
- **Reject:** RMA `REJECTED`  
- Seller nhập lại kho bằng **inventory slip** (004)

---

## 7. Admin

| UI | Method | Path |
|----|--------|------|
| Quote ship (hộ buyer) | `POST` | `/admin/orders/shipping-quote` |
| Tạo đơn hộ buyer | `POST` | `/admin/orders/checkout` |
| Orders inbox | `GET` | `/admin/orders?status&shopId&page&pageSize` — cross-shop (`VIEW_ORDER` ALL) |
| Force cancel | `POST` | `/admin/orders/:orderId/cancel` |
| RMA inbox | `GET` | `/admin/rma?status=` |
| Approve / reject RMA | `POST` | `/admin/rma/:id/approve\|reject` |
| Settlements (pending reconcile) | `GET` | `/admin/settlements?shopId&status&page&pageSize` — `meta.pendingTotal` |

### Admin tạo đơn hộ khách

```
POST /admin/orders/checkout
```

**Permission:** `CREATE_ORDER` với scope **ALL** (Admin / Super Admin). Buyer thường gọi `/orders/checkout` — **không** gửi `buyerId`.

```json
{
  "buyerId": "uuid-of-customer",
  "items": [{ "variantId": "uuid", "quantity": 1 }],
  "shippingAddress": {
    "fullName": "Nguyen Van A",
    "phone": "0901234567",
    "line1": "123 Nguyen Hue",
    "city": "HCM",
    "country": "VN"
  },
  "paymentMethod": "COD",
  "note": "CS tạo hộ — gọi điện xác nhận"
}
```

**BE:**

1. Verify `buyerId` tồn tại + `ACTIVE`  
2. Own-shop / multi-shop check theo **buyer đích** (không theo admin)  
3. Reserve stock + tạo order với `order.buyerId = buyerId`  
4. History `actorId` = admin; note “on behalf of buyer”  
5. **Notify buyer** (in-app + email soft-fail): nếu `PENDING` → nhắc thanh toán; nếu đã `PAID` (MOCK) → chỉ báo đơn đã tạo  
6. Response giống checkout buyer (`201` + `OrderView`)

**Errors thêm (checkout / quote hộ):**

| HTTP | Code | Khi nào |
|------|------|---------|
| 404 | `USER_NOT_FOUND` | `buyerId` không tồn tại / deleted |
| 403 | `FORBIDDEN` | Buyer không `ACTIVE`, hoặc actor không phải ALL |

**Preview phí:**

```
POST /admin/orders/shipping-quote
{ "buyerId": "…", "items": […], "shippingAddress": {…} }
```

Cùng shape `ShippingQuoteView` như `/orders/shipping-quote`.

### Admin list cross-shop

```
GET /admin/orders?status=PENDING&shopId=<uuid>&page=1&pageSize=20
```

- Scope: `VIEW_ORDER` **ALL** (Admin / CS / Warehouse / Accountant) — seller dùng `GET /orders` (shop-scoped)
- Optional filters: `status`, `shopId`; pagination như list buyer
- Response: cùng paginated `OrderView` như `GET /orders`
- `403` nếu actor không có scope ALL

---

## 8. TypeScript types

```ts
type OrderStatus =
  | 'PENDING'
  | 'PAID'
  | 'CONFIRMED'
  | 'PACKED'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUND_APPROVED'
  | 'REFUNDED';

type PaymentMethod = 'COD' | 'MOCK';

type RmaStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CLOSED';

interface ShippingAddress {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  district?: string;
  postalCode?: string;
  country?: string; // default BE: 'VN'
}

interface ShippingQuoteRequest {
  items: { variantId: string; quantity: number }[];
  shippingAddress: ShippingAddress;
}

interface ShippingQuoteView {
  shopId: string;
  itemCount: number;
  shippingFee: number;
  currency: 'USD';
}

interface CheckoutRequest {
  items: { variantId: string; quantity: number }[];
  shippingAddress: ShippingAddress;
  paymentMethod: PaymentMethod;
  note?: string;
}

interface AdminCheckoutRequest extends CheckoutRequest {
  buyerId: string; // required — target customer
}

interface AdminShippingQuoteRequest extends ShippingQuoteRequest {
  buyerId: string;
}

interface OrderItemView {
  id: string;
  variantId: string;
  productId: string;
  sku: string;
  titleSnapshot: string;
  /** Snapshot at checkout: variant.images[0] → product.images[0] → null */
  imageSnapshot: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

interface OrderView {
  id: string;
  code: string;
  buyerId: string;
  shopId: string;
  status: OrderStatus;
  subtotal: number;
  shippingFee: number;
  total: number;
  currency: 'USD';
  paymentMethod: PaymentMethod;
  shippingAddress: ShippingAddress;
  items: OrderItemView[];
  cancelReason: string | null;
  paidAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface RmaView {
  id: string;
  orderId: string;
  status: RmaStatus;
  reason: string;
  evidenceUrls: string[]; // filled via multipart upload, max 5, optional
  bankInfo: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
  reviewNote: string | null;
  decidedAt: string | null;
  createdAt: string;
}
```

---

## 9. Error codes (dự kiến)

| Code | HTTP | Meaning |
|------|------|---------|
| `ORDER_MULTI_SHOP` | 400 | Checkout nhiều shop |
| `ORDER_OWN_SHOP_FORBIDDEN` | 403 | Mua hàng shop của chính mình |
| `INSUFFICIENT_STOCK` | 400 | Không đủ tồn available |
| `ORDER_NOT_CANCELLABLE` | 400 | Đã ship/delivered hoặc status sai |
| `ORDER_INVALID_TRANSITION` | 400 | PATCH status nhảy cóc |
| `RMA_WINDOW_EXPIRED` | 400 | > 7 ngày sau DELIVERED |
| `RMA_NOT_ALLOWED` | 400 | Order chưa DELIVERED |
| `RMA_ALREADY_EXISTS` | 409 | Đã có RMA active |
| `ORDER_NOT_FOUND` | 404 | |
| `USER_NOT_FOUND` | 404 | Admin checkout — `buyerId` không tồn tại |
| `RMA_NOT_FOUND` | 404 | |

---

## 10. FE checklist

- [ ] Checkout UI: gọi `POST /orders/shipping-quote` khi đổi địa chỉ / items (debounce); hiện `shippingFee` + tổng tạm
- [ ] Đặt hàng: `POST /orders/checkout` — dùng `data.total` / `data.shippingFee` từ response (không tin preview cứng)
- [ ] Checkout: validate 1 shop trước khi gọi API (UX); vẫn handle `ORDER_MULTI_SHOP` / `ORDER_OWN_SHOP_FORBIDDEN`
- [ ] Chọn `COD` vs `MOCK` (dev); currency hiển thị **USD**
- [ ] Buyer order list + detail + cancel button theo status
- [ ] Seller: pipeline CONFIRMED → … → DELIVERED
- [ ] Sau DELIVERED: nút RMA nếu còn ≤ 7 ngày
- [ ] RMA: tạo JSON (reason + bank) → optional upload max 5 ảnh multipart
- [ ] Admin: inbox `GET /admin/orders` (filter status/shopId) + form tạo đơn hộ (`checkout` / `shipping-quote`)
- [ ] Admin: cancel + RMA inbox approve/reject
- [ ] Copy UI khi `REFUND_APPROVED`: “Chờ kế toán hoàn tiền ngoài hệ thống”
- [ ] Restock: deep-link tạo phiếu kho 004, không expect BE tự cộng stock

---

## 11. Phase 6 — Seed & smoke

Sau `pnpm seed:demo` (truncate orders + inventory mỗi lần chạy):

| Code | Status | Dùng để |
|------|--------|---------|
| `ORD-SEED-PENDING` | `PENDING` | Cancel buyer/admin; expiry cron |
| `ORD-SEED-PAID` | `PAID` | Seller confirm → pack |
| `ORD-SEED-SHIPPED` | `SHIPPED` | Mark `DELIVERED` |
| `ORD-SEED-DELIVERED` | `DELIVERED` | + RMA `PENDING` sample |

SKU: `SEED-MOUSE-001` @ Seed Electronics Store. Buyer: `buyer@example.com`. Password: seed default.

**Smoke (cookie session):**

```bash
# Buyer
curl -b cookies.txt "$API/orders"
curl -b cookies.txt -X POST "$API/orders/shipping-quote" -H 'Content-Type: application/json' \
  -d '{"items":[{"variantId":"<mouse>","quantity":1}],"shippingAddress":{...}}'

# Seller pipeline
curl -b cookies.txt -X PATCH "$API/orders/<ORD-SEED-PAID-id>/status" \
  -H 'Content-Type: application/json' -d '{"status":"CONFIRMED"}'

# Admin inbox + on-behalf
curl -b cookies.txt "$API/admin/orders?status=PENDING"
curl -b cookies.txt -X POST "$API/admin/orders/checkout" -H 'Content-Type: application/json' \
  -d '{"buyerId":"<buyer>","items":[...],"shippingAddress":{...},"paymentMethod":"COD"}'

# Admin RMA
curl -b cookies.txt "$API/admin/rma?status=PENDING"
```

Worker: `OrderExpiryJob` daily 03:00 → `cancelExpiredPending` (PENDING > 30 ngày).

---

## Related specs

- Flowcharts: `specs/005-order-flow/flow-0*.png`
- Entities: `specs/005-order-flow/entity-reference.md`
- OpenAPI: `specs/005-order-flow/contracts/order-api.yaml`
- Inventory restock: `specs/004-warehouse-inventory`
