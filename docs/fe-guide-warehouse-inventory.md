# 004 — Inventory Module · Frontend Integration Guide

> **Base URL:** `http://localhost:3000/api/v1`  
> **Auth:** Cookie-based JWT — include `credentials: 'include'` on every request.  
> **Content-Type:** `application/json` (except image uploads = `multipart/form-data`).

> **Product ↔ Variant (003+004 redesign):** 1 Product : N Variants. Stock lives only on `variant.availableStock`. **Sell price lives on `variant.sellingPrice`** (product has no `price`). Listing `stock` = sum of variants; listing `price`/`minPrice`/`maxPrice` from variants. Create product with `variants: [{ sku, sellingPrice, options? }]` (no images in JSON); upload images via `POST /products/:id/images`. Create variant requires `productId` + `sellingPrice` (+ optional `costPrice`).

> **Product FE guide (full create/edit/listing):** [`../../003-product-listing/contracts/fe-guide-product-listing.md`](../../003-product-listing/contracts/fe-guide-product-listing.md)

---

## Table of Contents

1. [Roles & Permissions](#1-roles--permissions)
2. [Error Response Format](#2-error-response-format)
3. [Error Codes Reference](#3-error-codes-reference)
4. [Inventory Slip State Machine](#4-inventory-slip-state-machine)
5. [Warehouses](#5-warehouses)
6. [Variants (SKUs)](#6-variants-skus)
7. [Inventory Slips](#7-inventory-slips)
8. [Stock Ledger](#8-stock-ledger)
9. [Admin Endpoints](#9-admin-endpoints)
10. [TypeScript Types](#10-typescript-types)
11. [Workflow Walkthrough](#11-workflow-walkthrough)
12. [Seed Data (local FE testing)](#12-seed-data-local-fe-testing)

---

## 1. Roles & Permissions

| Role | Can do |
|------|--------|
| `SELLER` | Create warehouses, variants, slips for **own shop** — approve/reject own slips |
| `WAREHOUSE` | Same as SELLER but shop-agnostic (platform warehouse staff) |
| `ADMIN` | List/get any slip + approve/reject via `/admin/inventory/…` |
| `SUPER_ADMIN` | Full access |

> Seller-facing endpoints (`/inventory/…`) are **shop-scoped**: the API resolves the shop from the authenticated user. No `shopId` is needed in the request body — it is inferred server-side.

---

## 2. Error Response Format

All errors follow a consistent envelope:

```json
{
  "error": {
    "code": "WAREHOUSE_CODE_TAKEN",
    "message": "Warehouse code already exists in this shop"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `error.code` | `string` | Stable machine-readable code — use this for conditional UI logic |
| `error.message` | `string` | Human-readable — for dev debugging, **do not display to end users raw** |

---

## 3. Error Codes Reference

| Code | HTTP | When |
|------|------|------|
| `WAREHOUSE_NOT_FOUND` | 404 | `warehouseCode` in slip body does not exist in shop |
| `WAREHOUSE_CODE_TAKEN` | 409 | Duplicate warehouse code within same shop |
| `VARIANT_NOT_FOUND` | 404 | `sku` in slip body does not exist in shop |
| `VARIANT_SKU_TAKEN` | 409 | Duplicate SKU within same shop |
| `INVENTORY_SLIP_NOT_FOUND` | 404 | Slip ID not found (or belongs to a different shop) |
| `INVENTORY_SLIP_ALREADY_PROCESSED` | 409 | Slip is already `APPROVED` or `REJECTED` — cannot re-process |
| `INSUFFICIENT_STOCK` | 422 | `ADJUST_OUT` slip: `quantity > availableStock` at approve time |
| `SHOP_NOT_ELIGIBLE` | 403 | Shop not found, not approved, or suspended |
| `FORBIDDEN` | 403 | Missing required permission for this endpoint |

---

## 4. Inventory Slip State Machine

```
[Created]
    │
    ▼
 PENDING ──── approve ──►  APPROVED  (stock updated, ledger written)
    │
    └────────  reject  ──►  REJECTED  (stock unchanged)

APPROVED / REJECTED → terminal, cannot transition again (→ 409 ALREADY_PROCESSED)
```

**Stock only changes on `APPROVED`** — creating a slip has zero effect on `availableStock`.

---

## 5. Warehouses

### 5.1 Create Warehouse

```
POST /inventory/warehouses
```

**Permission:** `ADD_INVENTORY` (SELLER, WAREHOUSE)

**Request body:**

```json
{
  "code": "KHO-HN",
  "address": "123 Lê Lợi, Q.1, TP.HCM"
}
```

| Field | Type | Required | Constraint |
|-------|------|----------|-----------|
| `code` | string | ✅ | max 32 chars, pattern `^[A-Za-z0-9_-]+$` |
| `address` | string | ❌ | max 200 chars |

**Response `201`:**

```json
{
  "message": "Warehouse created successfully",
  "data": {
    "id": "wh-uuid",
    "shopId": "shop-uuid",
    "code": "KHO-HN",
    "address": "123 Lê Lợi, Q.1, TP.HCM",
    "createdAt": "2026-07-21T13:00:00.000Z"
  }
}
```

**Errors:**

| Status | Code | Note |
|--------|------|------|
| 409 | `WAREHOUSE_CODE_TAKEN` | Code already used in this shop |
| 403 | `SHOP_NOT_ELIGIBLE` | Shop not approved or suspended |

---

### 5.2 List Warehouses

```
GET /inventory/warehouses
```

**Permission:** `VIEW_INVENTORY`

**Response `200`:**

```json
{
  "message": "Warehouses retrieved successfully",
  "data": [
    {
      "id": "wh-uuid",
      "shopId": "shop-uuid",
      "code": "KHO-HN",
      "address": "123 Lê Lợi, Q.1, TP.HCM",
      "createdAt": "2026-07-21T13:00:00.000Z"
    }
  ]
}
```

---

## 6. Variants (SKUs)

A **Variant** belongs to a **Product** (`productId` required). `availableStock` is the **source of truth** for stock — it only changes when a slip is **approved**.

### 6.1 Create Variant

```
POST /inventory/variants
```

**Permission:** `ADD_INVENTORY`

**Request body:**

```json
{
  "productId": "prod-uuid",
  "sku": "MOUSE-001",
  "sellingPrice": 29.99,
  "options": { "color": "black" },
  "costPrice": 18.5,
  "isEnrollmentPackage": false
}
```

| Field | Type | Required | Constraint |
|-------|------|----------|-----------|
| `productId` | UUID | ✅ | Must belong to caller's shop |
| `sku` | string | ✅ | max 64, unique per shop |
| `sellingPrice` | number | ✅ | ≥ 0 — **sell price** |
| `options` | object | ❌ | e.g. `{ size, color }` |
| `costPrice` | number | ❌ | ≥ 0 — purchase/cost on SKU |
| `isEnrollmentPackage` | boolean | ❌ | default false |

> Prefer creating variants with the product: `POST /products` `{ variants: [{ sku, price, options? }] }` or `POST /products/:id/variants`. Images: `POST /products/:id/variants/:variantId/images` (multipart).

---

### 6.2 List Variants

```
GET /inventory/variants
```

**Permission:** `VIEW_INVENTORY`

**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `q` | string | — | Filter SKU (case-insensitive contains), e.g. `MOUSE` |
| `productId` | UUID | — | Filter by product |
| `page` | integer | `1` | Page number |
| `pageSize` | integer | `20` | Items per page (max 100) |

**Example:**

```
GET /inventory/variants?q=MOUSE&page=1&pageSize=20
```

**Response `200`:**

```json
{
  "message": "Variants retrieved successfully",
  "data": {
    "items": [
      {
        "id": "var-uuid",
        "shopId": "shop-uuid",
        "productId": "prod-uuid",
        "sku": "MOUSE-001",
        "sellingPrice": 29.99,
        "availableStock": 50,
        "costPrice": 18.5,
        "isEnrollmentPackage": false,
        "createdAt": "2026-07-21T13:00:00.000Z",
        "updatedAt": "2026-07-21T14:00:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20,
    "totalPages": 1
  }
}
```

> **FE tip:** Use this for SKU pickers when creating a slip, and for the stock overview table (`availableStock` is live after approvals).

---

## 7. Inventory Slips

A slip represents a **request** to change stock. It is `PENDING` until explicitly approved or rejected.

### 7.1 Create Slip

```
POST /inventory/slips
```

**Permission:** `ADD_INVENTORY`

> **Breaking:** 1 slip = **header + N items**. `sku` / `quantity` / `unitCost` live on `items[]`, not the header.

**Request body:**

```json
{
  "type": "IN",
  "warehouseCode": "KHO-HN",
  "locationNote": "Kệ A3, tầng 2",
  "items": [
    { "sku": "MOUSE-001", "quantity": 50, "unitCost": 18.5 },
    { "sku": "KB-001", "quantity": 20, "unitCost": 55.0 }
  ]
}
```

| Field | Type | Required | Values / Constraint |
|-------|------|----------|---------------------|
| `type` | enum | ✅ | `IN` · `ADJUST_IN` · `ADJUST_OUT` (applies to **all** items) |
| `items` | array | ✅ | min 1; each `{ sku, quantity, unitCost? }`; **no duplicate SKU** |
| `items[].sku` | string | ✅ | Must exist as a variant in this shop |
| `items[].quantity` | integer | ✅ | ≥ 1 (always positive — direction controlled by `type`) |
| `items[].unitCost` | number | ❌ | ≥ 0 — per-unit cost for this line (typical for `IN`) |
| `warehouseCode` | string | ❌ | Must exist in this shop if provided |
| `locationNote` | string | ❌ | max 300 chars |

**Slip types:**

| Type | Stock effect on approve (per item) | Use case |
|------|------------------------|----------|
| `IN` | `availableStock += quantity` | New goods received |
| `ADJUST_IN` | `availableStock += quantity` | Manual stock increase / correction |
| `ADJUST_OUT` | `availableStock -= quantity` | Stock write-off / damage / transfer out |

**Response `201`:**

```json
{
  "message": "Inventory slip created successfully",
  "data": {
    "id": "slip-uuid",
    "code": "PN-20260722-A1B2",
    "shopId": "shop-uuid",
    "type": "IN",
    "status": "PENDING",
    "warehouseCode": "KHO-HN",
    "locationNote": "Kệ A3, tầng 2",
    "createdByUserId": "user-uuid",
    "processedAt": null,
    "createdAt": "2026-07-21T13:00:00.000Z",
    "items": [
      { "id": "item-uuid-1", "sku": "MOUSE-001", "quantity": 50, "unitCost": 18.5 },
      { "id": "item-uuid-2", "sku": "KB-001", "quantity": 20, "unitCost": 55.0 }
    ]
  }
}
```

**Errors:**

| Status | Code | Note |
|--------|------|------|
| 404 | `VARIANT_NOT_FOUND` | SKU not found in this shop |
| 404 | `WAREHOUSE_NOT_FOUND` | warehouseCode not found in this shop |
| 409 | `INVENTORY_SLIP_DUPLICATE_SKU` | Same SKU twice in `items` |

---

### 7.2 List Slips

```
GET /inventory/slips
```

**Permission:** `VIEW_INVENTORY`

**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `status` | `PENDING` \| `APPROVED` \| `REJECTED` | — | Filter by status (omit for all) |
| `page` | integer | `1` | Page number |
| `pageSize` | integer | `20` | Items per page (max 100) |

**Example:**

```
GET /inventory/slips?status=PENDING&page=1&pageSize=20
```

**Response `200`:**

```json
{
  "message": "Inventory slips retrieved successfully",
  "data": {
    "items": [ /* InventorySlip[] */ ],
    "total": 42,
    "page": 1,
    "pageSize": 20,
    "totalPages": 3
  }
}
```

---

### 7.3 Get Slip Detail

```
GET /inventory/slips/:slipId
```

**Permission:** `VIEW_INVENTORY`

**Response `200`:** Single `InventorySlip` object (same shape as create response).

**Errors:**

| Status | Code | Note |
|--------|------|------|
| 404 | `INVENTORY_SLIP_NOT_FOUND` | Slip not found or belongs to another shop |

---

### 7.4 Approve Slip

```
POST /inventory/slips/:slipId/approve
```

**Permission:** `EDIT_INVENTORY` (SELLER, WAREHOUSE)

No request body.

**What happens server-side (atomic transaction — all-or-nothing):**
1. Load all `inventory_slip_items` for the slip
2. For each item (ordered by SKU): lock variant (`SELECT FOR UPDATE`)
3. Verify `availableStock >= quantity` for `ADJUST_OUT` (else 422 → rollback **entire** slip)
4. Update `availableStock` (+ optional `costPrice` from `unitCost` on IN/ADJUST_IN)
5. Insert **one** immutable ledger row per item (`slipItemId`, `quantityBefore`, `quantityAfter`)
6. Flip slip `status → APPROVED`, set `processedAt`
7. Commit

**Response `200`:**

```json
{
  "message": "Inventory slip approved and stock updated",
  "data": {
    "id": "slip-uuid",
    "status": "APPROVED",
    "processedAt": "2026-07-21T14:00:00.000Z",
    ...
  }
}
```

**Errors:**

| Status | Code | Note |
|--------|------|------|
| 404 | `INVENTORY_SLIP_NOT_FOUND` | Slip not found |
| 409 | `INVENTORY_SLIP_ALREADY_PROCESSED` | Already approved or rejected |
| 422 | `INSUFFICIENT_STOCK` | `ADJUST_OUT` — not enough stock |

---

### 7.5 Reject Slip

```
POST /inventory/slips/:slipId/reject
```

**Permission:** `EDIT_INVENTORY`

No request body. Stock is **not** changed.

**Response `200`:**

```json
{
  "message": "Inventory slip rejected",
  "data": {
    "id": "slip-uuid",
    "status": "REJECTED",
    "processedAt": "2026-07-21T14:00:00.000Z",
    ...
  }
}
```

**Errors:** same as approve (404 / 409).

---

## 8. Stock Ledger

The ledger is **immutable** — entries are never edited or deleted. Each approved slip produces exactly one ledger entry. Use it for stock history and audit.

### 8.1 List Ledger Entries

```
GET /inventory/ledger
```

**Permission:** `VIEW_INVENTORY`

**Query params:**

| Param | Type | Description |
|-------|------|-------------|
| `sku` | string | Filter by SKU (exact match) |
| `from` | ISO-8601 datetime | `recordedAt >= from` |
| `to` | ISO-8601 datetime | `recordedAt <= to` |
| `page` | integer | default `1` |
| `pageSize` | integer | default `20`, max `100` |

**Example:**

```
GET /inventory/ledger?sku=MOUSE-001&from=2026-07-01T00:00:00Z&page=1&pageSize=50
```

**Response `200`:**

```json
{
  "message": "Stock ledger retrieved successfully",
  "data": {
    "items": [
      {
        "id": "ledger-uuid",
        "slipId": "slip-uuid",
        "slipItemId": "item-uuid",
        "sku": "MOUSE-001",
        "type": "IN",
        "quantity": 50,
        "quantityBefore": 0,
        "quantityAfter": 50,
        "recordedAt": "2026-07-21T14:00:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20,
    "totalPages": 1
  }
}
```

> **Tip:** `quantityBefore + quantity = quantityAfter` for `IN`/`ADJUST_IN`. For `ADJUST_OUT`: `quantityBefore - quantity = quantityAfter`. Use this to reconstruct full stock history.

---

## 9. Admin Endpoints

Admins can **list / get / approve / reject** any slip regardless of shop. No shop ownership needed.

### 9.1 List Slips (Admin Inbox)

```
GET /admin/inventory/slips
```

**Permission:** `VIEW_INVENTORY` (ADMIN / SUPER_ADMIN)

**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `status` | `PENDING` \| `APPROVED` \| `REJECTED` | — | Filter by status (omit for all) |
| `shopId` | UUID | — | Filter by shop |
| `page` | integer | `1` | Page number |
| `pageSize` | integer | `20` | Items per page (max 100) |

**Example — pending inbox:**

```
GET /admin/inventory/slips?status=PENDING&page=1&pageSize=20
```

**Response `200`:** same paginated shape as seller `GET /inventory/slips`.

> **FE tip:** Admin review screen should call this with `status=PENDING`. After approve/reject, refresh the list (or remove the row optimistically then reconcile).

---

### 9.2 Get Slip Detail (Admin)

```
GET /admin/inventory/slips/:slipId
```

**Permission:** `VIEW_INVENTORY`

**Response `200`:** single `InventorySlip` (cross-shop — no ownership check).

**Errors:**

| Status | Code | Note |
|--------|------|------|
| 404 | `INVENTORY_SLIP_NOT_FOUND` | Slip ID does not exist |

---

### 9.3 Admin Approve Slip

```
POST /admin/inventory/slips/:slipId/approve
```

**Permission:** `EDIT_INVENTORY` (ADMIN / SUPER_ADMIN — `APPROVE` scope)

No request body. Same atomic logic as seller approve.

**Response `200`:** same shape as seller approve.

---

### 9.4 Admin Reject Slip

```
POST /admin/inventory/slips/:slipId/reject
```

**Permission:** `EDIT_INVENTORY` (APPROVE scope)

No request body.

**Response `200`:** same shape as seller reject.

---

## 10. TypeScript Types

Copy-paste ready types for the frontend:

```typescript
// Enums
export type InventorySlipType = 'IN' | 'ADJUST_IN' | 'ADJUST_OUT';
export type InventorySlipStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

// Entities
export interface Warehouse {
  id: string;
  shopId: string;
  code: string;
  address: string | null;
  createdAt: string; // ISO-8601
}

export interface Variant {
  id: string;
  shopId: string;
  productId: string;
  sku: string;
  sellingPrice: number; // sell price
  availableStock: number;
  options: Record<string, string> | null;
  images: string[];
  costPrice: number | null; // purchase/cost on SKU
  isEnrollmentPackage: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InventorySlipItem {
  id: string;
  sku: string;
  quantity: number;
  unitCost: number | null;
}

export interface InventorySlip {
  id: string;
  code: string;                 // auto PN-YYYYMMDD-XXXX
  shopId: string;
  type: InventorySlipType;
  status: InventorySlipStatus;
  warehouseCode: string | null;
  locationNote: string | null;
  createdByUserId: string;
  processedAt: string | null; // ISO-8601, null when PENDING
  createdAt: string;
  items: InventorySlipItem[];
}

export interface StockLedgerEntry {
  id: string;
  slipId: string;
  slipItemId: string;
  sku: string;
  type: InventorySlipType;
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  recordedAt: string;
}

// Paginated wrapper
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// API response wrappers
export interface ApiResponse<T> {
  message: string;
  data: T;
}

// Request DTOs
export interface CreateWarehouseRequest {
  code: string;        // max 32, pattern: ^[A-Za-z0-9_-]+$
  address?: string;    // max 200
}

export interface CreateVariantRequest {
  productId: string;
  sku: string;                    // max 64
  sellingPrice: number;           // sell price >= 0
  options?: Record<string, string>;
  costPrice?: number | null;       // purchase/cost on SKU
  isEnrollmentPackage?: boolean;  // default false
}

export interface CreateSlipItemRequest {
  sku: string;               // must exist in shop
  quantity: number;          // >= 1
  unitCost?: number | null;  // per-unit cost for this line
}

export interface CreateSlipRequest {
  type: InventorySlipType;
  items: CreateSlipItemRequest[]; // min 1, no duplicate SKU
  warehouseCode?: string;    // optional, max 32
  locationNote?: string;     // optional, max 300
}

export interface ListVariantsParams {
  q?: string;        // SKU contains (case-insensitive)
  page?: number;
  pageSize?: number;
}

export interface ListSlipsParams {
  status?: InventorySlipStatus;
  page?: number;
  pageSize?: number;
}

export interface AdminListSlipsParams {
  status?: InventorySlipStatus;
  shopId?: string;   // UUID
  page?: number;
  pageSize?: number;
}

export interface ListLedgerParams {
  sku?: string;
  from?: string;     // ISO-8601
  to?: string;       // ISO-8601
  page?: number;
  pageSize?: number;
}
```

---

## 11. Workflow Walkthrough

### Seller adds new stock (typical flow)

```
1. Create product (+ variants) once
   POST /products  { title, description, categoryId, variants: [{ sku, price, options? }] }
   — or add SKU later: POST /products/:id/variants { sku, sellingPrice, options? }
   — inventory shortcut: POST /inventory/variants { productId, sku, sellingPrice, costPrice?, … }

2. (Optional) Create warehouse (once per location)
   POST /inventory/warehouses  { code: "KHO-HN", address: "..." }

3. Create inventory slip (every time stock arrives)
   POST /inventory/slips  { type: "IN", warehouseCode: "KHO-HN", items: [{ sku: "MOUSE-001", quantity: 100, unitCost: 18.5 }, { sku: "KB-001", quantity: 20, unitCost: 55 }] }
   → status: "PENDING"

4. Approve the slip (seller self-approves or waits for admin)
   POST /inventory/slips/:slipId/approve
   → status: "APPROVED", availableStock += 100

5. Verify ledger
   GET /inventory/ledger?sku=MOUSE-001
   → quantityBefore: 0, quantityAfter: 100
```

### Admin review inbox → approve

```
1. List pending slips across shops
   GET /admin/inventory/slips?status=PENDING

2. Open detail (optional)
   GET /admin/inventory/slips/:slipId

3. Approve or reject
   POST /admin/inventory/slips/:slipId/approve
   POST /admin/inventory/slips/:slipId/reject
```

### Seller adjusts stock downward (write-off)

```
POST /inventory/slips  { type: "ADJUST_OUT", items: [{ sku: "MOUSE-001", quantity: 5 }] }
POST /inventory/slips/:slipId/approve
→ availableStock -= 5
→ 422 INSUFFICIENT_STOCK if availableStock < 5
```

---

## Notes for FE Implementation

- **Product catalog UI** is documented in `003` FE guide — inventory only owns stock slips / warehouses / ledger.
- **Poll vs real-time:** No WebSocket for slip status changes. Poll `GET /inventory/slips/:slipId` or list page to update UI after approve/reject actions.
- **Optimistic UI:** Avoid — stock changes are transactional server-side. Always reload slip detail after action.
- **`processedAt` null guard:** Always check `processedAt !== null` before displaying approval time.
- **`quantityAfter` on ledger** is the authoritative post-approve stock — use it for ledger display, not `variant.availableStock` snapshots in history.
- **Ledger is append-only** — never attempt to delete or edit ledger entries from FE.
- **Do not edit sell price via inventory slip** — use `PATCH /products/:id/variants/:variantId` `{ sellingPrice }`.
- **Cost:** `variant.costPrice` = current cost on SKU; `items[].unitCost` = cost for that line. On approve `IN`/`ADJUST_IN` with `unitCost`, BE sets `variant.costPrice = unitCost` per line.
- **Multi-SKU:** one slip header + N items; approve is **all-or-nothing**; ledger writes **one row per item**.
---

## 12. Seed Data (local FE testing)

Run once (with `DATABASE_URL` set, usually via `.env`):

```bash
pnpm seed:demo
```

Default password for most accounts: `Seed123456!`  
Admin: `admin@example.com` / `Admin123!` (or `SEED_ADMIN_*` env overrides)

### Accounts to use

| Email | Role | Inventory scope |
|-------|------|-----------------|
| `seller@example.com` | SELLER | Own approved shop — warehouses / variants / slips / ledger |
| `admin@example.com` | ADMIN | Cross-shop inbox `GET /admin/inventory/slips` |
| `warehouse@example.com` | WAREHOUSE | Staff account (no owned shop — seller endpoints need shop owner) |

### Seed inventory on seller shop (`Seed Electronics Store`)

**Warehouses**

| code | address |
|------|---------|
| `KHO-HN` | 12 Nguyễn Trãi, Thanh Xuân, Hà Nội |
| `KHO-HCM` | 45 Lê Lợi, Q.1, TP.HCM |

**Variants**

| sku | sellingPrice | availableStock | notes |
|-----|--------------|----------------|-------|
| `SEED-MOUSE-001` | 29.99 | 100 | After approved IN |
| `SEED-KB-001` | 89.00 | 0 | Out of stock |
| `SEED-TEE-M-BLK` | 15.50 | 10 | Multi-variant tee |
| `SEED-TEE-L-RED` | 16.50 | 10 | Different sell price |
| `SEED-TEE-001` | 15.50 | 20 | Included in multi-SKU approved slip |
| `PKG-GOLD` | 199.00 | 5 | `isEnrollmentPackage: true` |

**Slips** (re-seeded each run; `locationNote` starts with `[SEED]`)

| status | type | sku | qty | FE use |
|--------|------|-----|-----|--------|
| `PENDING` | `IN` | `SEED-MOUSE-001` | 30 | Happy-path approve → stock 100→130 |
| `PENDING` | `ADJUST_IN` | `SEED-KB-001` | 10 | Approve → stock 0→10 |
| `PENDING` | `ADJUST_OUT` | `SEED-KB-001` | 50 | Approve → **422 `INSUFFICIENT_STOCK`** |
| `APPROVED` | `IN` | `SEED-MOUSE-001` | 100 | History + ledger |
| `APPROVED` | `IN` | `SEED-TEE-001` | 20 | History + ledger |
| `REJECTED` | `ADJUST_OUT` | `SEED-MOUSE-001` | 15 | History only |

**Suggested FE smoke checklist**

1. Login `seller@example.com` → list warehouses / variants / pending slips / ledger  
2. Approve mouse `IN` 30 → variants stock becomes `130`, new ledger row  
3. Try approve keyboard `ADJUST_OUT` 50 → show `INSUFFICIENT_STOCK` toast  
4. Login `admin@example.com` → `GET /admin/inventory/slips?status=PENDING` → approve remaining  
5. Re-run `pnpm seed:demo` anytime to reset seed slips + stock snapshots  
