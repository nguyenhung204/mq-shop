# 003 — Product & Listing · Frontend Integration Guide

> **Base URL:** `http://localhost:3000/api/v1`  
> **Auth:** Cookie JWT — `credentials: 'include'`  
> **Images:** `multipart/form-data` field name `images` (not JSON URLs)

---

## Breaking changes (FE must migrate)

| Before (old) | After (current) |
|--------------|-----------------|
| `product.price` sell price | **`variant.price`** sell price (SoT) |
| `product.stock` / `product.sku` | **Removed** — stock = `SUM(variants.availableStock)` |
| Create with `images: [url, …]` | Create **without** images → upload via multipart |
| Create without variants | **`variants[]` min 1** required on create |
| Single price on product form | Price **per SKU**; listing shows min (+ range) |

### Mental model

```
Product (title, description, category, images[], status)
  └── Variant[]  (sku, price, options?, images[], availableStock)
```

- **Simple product (no options UI):** still create **1 default variant** with `sku` + `price`.
- **Variant images empty:** FE falls back to `product.images`.
- **Listing card `price`:** = `minPrice` across variants; also return `minPrice` / `maxPrice`.

---

## Table of Contents

1. [Seller create / edit flow](#1-seller-create--edit-flow)
2. [Product endpoints](#2-product-endpoints)
3. [Variants nested under product](#3-variants-nested-under-product)
4. [Images (avatar-style multipart)](#4-images-avatar-style-multipart)
5. [Public listing](#5-public-listing)
6. [Admin review](#6-admin-review)
7. [TypeScript types](#7-typescript-types)
8. [Seed data for FE](#8-seed-data-for-fe)
9. [FE checklist](#9-fe-checklist)

---

## 1. Seller create / edit flow

### Create (recommended UX)

```
1. POST /products
   body: { title, description, categoryId, attributes?, variants: [{ sku, price, options? }, ...] }
   → product PENDING, variants stock=0, images=[]

2. POST /products/:productId/images          (multipart field "images")
   → append product gallery URLs

3. (optional) POST /products/:id/variants/:variantId/images
   → per-SKU photos; else FE uses product.images
```

### Edit

| Change | Endpoint |
|--------|----------|
| Title / description / category / attributes | `PATCH /products/:id` |
| Sell price / options of a SKU | `PATCH /products/:id/variants/:variantId` `{ price?, options? }` |
| Add SKU | `POST /products/:id/variants` `{ sku, price, options? }` |
| Gallery | `POST` / `DELETE …/images` |
| Stock | **Inventory slips** (004) — not product PATCH |

### Sensitive fields → re-review

If product is `REJECTED` and seller changes sensitive data → status becomes `PENDING` again:

- Product: `title`, `description`, `categoryId`, `attributes`, **images**
- Variant: **`price`** (sell price change)

---

## 2. Product endpoints

Auth: seller with eligible **APPROVED** shop (not suspended).

### 2.1 Create product + variants

```
POST /products
```

```json
{
  "title": "Cotton T-Shirt",
  "description": "Soft cotton tee",
  "categoryId": "cat-fashion",
  "attributes": { "material": "cotton" },
  "variants": [
    { "sku": "TEE-M-BLK", "price": 15.5, "options": { "size": "M", "color": "black" } },
    { "sku": "TEE-L-RED", "price": 16.5, "options": { "size": "L", "color": "red" } }
  ]
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `title` | ✅ | 3–200 |
| `description` | ✅ | |
| `categoryId` | ✅ | e.g. `cat-electronics` from `GET /categories` |
| `attributes` | ❌ | free-form object |
| `variants` | ✅ | **min 1** |
| `variants[].sku` | ✅ | unique per shop |
| `variants[].price` | ✅ | sell price ≥ 0 |
| `variants[].options` | ❌ | `{ size, color, … }` |

**Do not send:** `price`, `stock`, `sku`, `images` on the product root.

**Response `201` (shape):**

```json
{
  "message": "Product created successfully",
  "data": {
    "id": "prod-uuid",
    "shopId": "shop-uuid",
    "title": "Cotton T-Shirt",
    "description": "Soft cotton tee",
    "categoryId": "cat-fashion",
    "price": 15.5,
    "minPrice": 15.5,
    "maxPrice": 16.5,
    "stock": 0,
    "images": [],
    "attributes": { "material": "cotton" },
    "status": "PENDING",
    "rejectionReason": null,
    "variants": [
      {
        "id": "var-uuid",
        "productId": "prod-uuid",
        "shopId": "shop-uuid",
        "sku": "TEE-M-BLK",
        "price": 15.5,
        "availableStock": 0,
        "options": { "size": "M", "color": "black" },
        "images": [],
        "unitPrice": null,
        "isEnrollmentPackage": false,
        "createdAt": "...",
        "updatedAt": "..."
      }
    ],
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

> Product-level `price` / `minPrice` / `maxPrice` are **derived** from variants (convenience for cards). Checkout must use **selected `variant.price`**.

### 2.2 List / get own products

```
GET /products?status=PENDING&page=1&pageSize=20
GET /products/:productId
```

Same product view as create (includes nested `variants`).

### 2.3 Update product metadata

```
PATCH /products/:productId
```

```json
{
  "title": "Cotton T-Shirt V2",
  "description": "...",
  "categoryId": "cat-fashion",
  "attributes": { "material": "organic cotton" }
}
```

**Do not send:** `price`, `stock`, `images`, `variants`.

### 2.4 Hide / unhide

```
POST /products/:productId/hide     → HIDDEN
POST /products/:productId/unhide   → PENDING (back to review queue)
```

---

## 3. Variants nested under product

### 3.1 Add variant

```
POST /products/:productId/variants
```

```json
{
  "sku": "TEE-XL-WHT",
  "price": 17.0,
  "options": { "size": "XL", "color": "white" }
}
```

### 3.2 Update variant (price / options)

```
PATCH /products/:productId/variants/:variantId
```

```json
{
  "price": 14.9,
  "options": { "size": "M", "color": "navy" }
}
```

Stock is **not** editable here — use inventory slips (`POST /inventory/slips`).

### 3.3 Inventory module alternative

```
POST /inventory/variants
{ "productId", "sku", "price", "options?", "unitPrice?", "isEnrollmentPackage?" }
```

Same sell-price rule. Prefer product nested APIs when building the product form.

---

## 4. Images (avatar-style multipart)

Same pattern as shop logo/banner.

| | |
|--|--|
| Field name | `images` |
| Max files / request | 10 |
| Max size / file | 5 MB |
| Server | converts → WebP → MinIO → persists URL on entity |

### Product gallery

```
POST /products/:productId/images
Content-Type: multipart/form-data
images: <file>, <file>, …
```

```
DELETE /products/:productId/images
{ "urls": ["https://…/a.webp", "https://…/b.webp"] }
```

### Variant gallery (optional)

```
POST /products/:productId/variants/:variantId/images
DELETE /products/:productId/variants/:variantId/images
{ "urls": ["…"] }
```

**Display rule:**

```ts
const thumbs =
  variant.images?.length > 0 ? variant.images : product.images;
```

---

## 5. Public listing & PDP

### 5.1 Browse / search

```
GET /products/listing?q=mouse&categoryId=cat-electronics&shopId=<uuid>&minPrice=10&maxPrice=100&page=1&pageSize=20
```

No auth. Only `ACTIVE` products of **APPROVED**, non-suspended shops.

**Query filters (additive AND):**

| Param | Notes |
|-------|--------|
| `q` | Title search |
| `categoryId` | `cat-…` |
| `shopId` | Shop storefront; non-public shop → empty list |
| `minPrice` / `maxPrice` | ≥ 0; `minPrice > maxPrice` → 400 |
| `page` / `pageSize` | Pagination |

**Card:**

```json
{
  "id": "prod-uuid",
  "shopId": "shop-uuid",
  "title": "Wireless Mouse Pro",
  "price": 29.99,
  "minPrice": 29.99,
  "maxPrice": 29.99,
  "thumbnailUrl": "https://…/mouse.webp",
  "stock": 100,
  "displayMode": "NORMAL",
  "watermarkText": null
}
```

| Field | Meaning |
|-------|---------|
| `shopId` | Seller shop (link to `/shops/:shopId`) |
| `price` | Same as `minPrice` (backward-friendly) |
| `minPrice` / `maxPrice` | Range when multi-variant pricing differs |
| `stock` | Sum of variant `availableStock` |
| `displayMode` | `NORMAL` \| `OUT_OF_STOCK_WATERMARK` |
| `watermarkText` | `{ vi, zh, en }` when OOS; else `null` |

**UI tip:** if `minPrice !== maxPrice`, show e.g. `Từ {minPrice}` / `{minPrice} – {maxPrice}`.

### 5.1b Public shop storefront

```
GET /shops/:shopId/storefront
```

No auth. Only `APPROVED` + not suspended → else `404 SHOP_NOT_FOUND`.

```json
{
  "id": "shop-uuid",
  "name": "Seed Electronics",
  "logoUrl": "https://…/logo.webp",
  "bannerUrl": "https://…/banner.webp",
  "countryCode": "VN"
}
```

FE route: `/shops/[id]` — search (`q`), category, `minPrice`/`maxPrice`, sort (client), pagination via listing `?shopId=`.

### 5.2 Product detail (PDP)

```
GET /products/listing/:productId
```

No auth. Same visibility rules as listing (`ACTIVE` + approved shop). `404` if missing / not public.

Also returns nested `shop` when the seller shop is public:

```json
"shop": { "id": "shop-uuid", "name": "Seed Electronics", "logoUrl": "https://…" }
```

or `"shop": null` (still keep `shopId`).

```json
{
  "message": "Product retrieved successfully",
  "data": {
    "id": "prod-uuid",
    "shopId": "shop-uuid",
    "shop": { "id": "shop-uuid", "name": "Seed Electronics", "logoUrl": null },
    "title": "Cotton T-Shirt",
    "description": "Soft cotton tee",
    "categoryId": "cat-fashion",
    "price": 15.5,
    "minPrice": 15.5,
    "maxPrice": 16.5,
    "stock": 20,
    "images": ["https://…/tshirt.webp"],
    "attributes": { "material": "cotton" },
    "variants": [
      {
        "id": "var-uuid",
        "productId": "prod-uuid",
        "sku": "TEE-M-BLK",
        "price": 15.5,
        "availableStock": 10,
        "options": { "size": "M", "color": "black" },
        "images": [],
        "isEnrollmentPackage": false
      }
    ],
    "displayMode": "NORMAL",
    "watermarkText": null,
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

**FE PDP rules:**

- Pick a variant → show that `variant.price` + `availableStock`
- Image: `variant.images` if non-empty, else `product.images`
- Checkout must use selected `variant.id` / `variant.price` (not product-level `price`)
- Public payload **omits** `rejectionReason`, `status`, `unitPrice`

Categories (public):

```
GET /categories
```

---

## 6. Admin review

```
GET  /admin/products?status=PENDING&page=1
POST /admin/products/:productId/approve
POST /admin/products/:productId/reject   { "reason": "…" }
POST /admin/products/:productId/hide
```

> Body optional / ignored today — hide has no `reason` field in the current API.

---

## 7. TypeScript types

```ts
export type ProductStatus =
  | 'PENDING'
  | 'ACTIVE'
  | 'REJECTED'
  | 'HIDDEN';

export type DisplayMode = 'NORMAL' | 'OUT_OF_STOCK_WATERMARK';

export interface ProductVariant {
  id: string;
  productId: string;
  shopId: string;
  sku: string;
  /** Sell price (SoT for checkout). */
  price: number;
  availableStock: number;
  options: Record<string, string> | null;
  images: string[];
  /** Purchase/cost — inventory reporting only. */
  unitPrice: number | null;
  isEnrollmentPackage: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  shopId: string;
  title: string;
  description: string;
  categoryId: string;
  /** Derived: min(variant.price). Do not treat as editable SoT. */
  price: number;
  minPrice: number;
  maxPrice: number;
  /** Derived: sum(variant.availableStock). */
  stock: number;
  images: string[];
  attributes: Record<string, unknown> | null;
  status: ProductStatus;
  rejectionReason: string | null;
  variants: ProductVariant[];
  createdAt: string;
  updatedAt: string;
}

export interface ListingCard {
  id: string;
  title: string;
  price: number;
  minPrice: number;
  maxPrice: number;
  thumbnailUrl: string | null;
  stock: number;
  displayMode: DisplayMode;
  watermarkText: { vi: string; zh: string; en: string } | null;
}

/** Customer PDP — GET /products/listing/:productId */
export interface PublicProductVariant {
  id: string;
  productId: string;
  sku: string;
  price: number;
  availableStock: number;
  options: Record<string, string> | null;
  images: string[];
  isEnrollmentPackage: boolean;
}

export interface PublicProductDetail {
  id: string;
  shopId: string;
  title: string;
  description: string;
  categoryId: string;
  price: number;
  minPrice: number;
  maxPrice: number;
  stock: number;
  images: string[];
  attributes: Record<string, unknown> | null;
  variants: PublicProductVariant[];
  displayMode: DisplayMode;
  watermarkText: { vi: string; zh: string; en: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductRequest {
  title: string;
  description: string;
  categoryId: string;
  attributes?: Record<string, unknown>;
  variants: Array<{
    sku: string;
    price: number;
    options?: Record<string, string>;
  }>;
}

export interface UpdateProductRequest {
  title?: string;
  description?: string;
  categoryId?: string;
  attributes?: Record<string, unknown> | null;
}

export interface AddProductVariantRequest {
  sku: string;
  price: number;
  options?: Record<string, string>;
}

export interface UpdateProductVariantRequest {
  price?: number;
  options?: Record<string, string> | null;
}

export interface RemoveImagesRequest {
  urls: string[];
}
```

---

## 8. Seed data for FE

```bash
pnpm seed:demo
```

| Email | Password | Use |
|-------|----------|-----|
| `seller@example.com` | `Seed123456!` | Own catalog + inventory |
| `admin@example.com` | `Admin123!` | Review queue |

Shop: **Seed Electronics Store** (approved).

| Product | Status | Variant SKUs | Sell price | Stock notes |
|---------|--------|--------------|------------|-------------|
| Wireless Mouse Pro | ACTIVE | `SEED-MOUSE-001` | 29.99 | 100 |
| Mechanical Keyboard | ACTIVE | `SEED-KB-001` | 89.00 | 0 (OOS watermark) |
| Cotton T-Shirt | PENDING | `SEED-TEE-M-BLK` / `SEED-TEE-L-RED` | 15.50 / 16.50 | multi-price range |
| Face Serum | REJECTED | `SEED-SERUM-001` | 24.00 | re-edit → PENDING |
| Building Blocks Set | HIDDEN | `SEED-BLOCKS-001` | 39.90 | unhide → PENDING |
| Desk Lamp | ACTIVE | `SEED-LAMP-001` | 45.00 | |
| Gold Enrollment Package | ACTIVE | `PKG-GOLD` | 199.00 | MLM flag |

---

## 9. FE checklist

- [ ] Remove product form fields: root `price`, `stock`, `sku`, image URL array
- [ ] Create always sends `variants` (≥1) with `sku` + `price`
- [ ] Simple products: one hidden “default” variant still created
- [ ] After create: multipart upload to `POST …/images`
- [ ] Edit price on variant PATCH, not product PATCH
- [ ] Listing: use `minPrice`/`maxPrice`; OOS via `displayMode`
- [ ] PDP: `GET /products/listing/:productId` → pick variant → `variant.price` + stock; image fallback
- [ ] Stock adjustments only via inventory module (004)
- [ ] OpenAPI: `specs/003-product-listing/contracts/product-api.yaml`
- [ ] Related inventory guide: `specs/004-warehouse-inventory/contracts/fe-guide-warehouse-inventory.md`
