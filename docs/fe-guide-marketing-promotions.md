# 006 — Marketing Promotions · Frontend Integration Guide

> **Base URL:** `http://localhost:3000/api/v1`  
> **Auth:** Cookie JWT — `credentials: 'include'` (trừ public banners)  
> **Implement branch:** `feat/009-marketing-promotions`  
> **Flows:** create/update promo · admin approve · banner/content · media ZIP

---

## Decisions (MVP — locked)

| Topic | Decision |
|-------|----------|
| Promo types | `PERCENT` \| `FIXED` \| `FREE_SHIP` \| `VOUCHER` |
| Admin scope | `PLATFORM` (toàn sàn) **hoặc** `TARGETED` (bắt buộc ≥1 SKU **và/hoặc** category) |
| Seller scope | Luôn `TARGETED`; SKU phải thuộc shop |
| Checkout apply KM | **Chưa có** — FE chỉ CRUD / duyệt / hiển thị, chưa nhập mã lúc checkout |
| Media | Admin upload; Seller/CS/Admin download (`VIEW_MKT_MAT`) |
| Expiry | Cron hourly: `ACTIVE` + `endAt < now` → `EXPIRED` |
| Banner cache | Public list cache Redis; admin mutate → invalidate |

---

## Table of Contents

1. [Roles & permissions](#1-roles--permissions)
2. [Enums & models](#2-enums--models)
3. [Seller promotions](#3-seller-promotions)
4. [Admin promotions](#4-admin-promotions)
5. [Public & admin banners](#5-public--admin-banners)
6. [Marketing media library](#6-marketing-media-library)
7. [TypeScript types](#7-typescript-types)
8. [Error codes](#8-error-codes)
9. [FE checklist](#9-fe-checklist)

---

## 1. Roles & permissions

| UI | Role / permission | Ghi chú |
|----|-------------------|---------|
| Seller KM | `MANAGE_PROMO` (SHOP) | Chỉ shop `APPROVED`, không suspended |
| Admin tạo/sửa KM | `MANAGE_PROMO` (ALL) | `ADMIN` / `SUPER_ADMIN` |
| Duyệt KM | `APPROVE_PROMO` | Admin list pending + approve/reject |
| Banner CRUD | `MANAGE_CONTENT` | Admin |
| Media upload | `MANAGE_CONTENT` | Admin |
| Media list/download | `VIEW_MKT_MAT` | Seller, CS, Admin… — **Guest/Buyer không** |
| Public banners | — | Không auth |

Guest/Buyer gọi media → `403` `FORBIDDEN`.

---

## 2. Enums & models

### PromotionType

| Type | UI | `discountValue` | `code` |
|------|-----|-----------------|--------|
| `PERCENT` | Giảm % | Bắt buộc (0–100) | `null` |
| `FIXED` | Giảm số tiền | Bắt buộc (vd. `"5.00"`) | `null` |
| `FREE_SHIP` | Free ship | BE lưu `"0"` — FE **không cần** gửi | `null` |
| `VOUCHER` | Mã voucher | Bắt buộc = **số tiền** giảm | **Bắt buộc** (3–40, `[A-Za-z0-9_-]`) |

`code` được BE normalize **UPPERCASE** (vd. `summer10` → `SUMMER10`).

### PromotionScope

| Value | Ai dùng | Rule |
|-------|---------|------|
| `PLATFORM` | Admin only | Không gửi `skus` / `categoryIds` |
| `TARGETED` | Seller luôn; Admin optional | ≥1 `skus[]` **hoặc** `categoryIds[]` |

### PromotionStatus

```
Seller create ──────────────► PENDING
                                 │
                    Admin approve │ Admin reject
                                 ▼              ▼
                              ACTIVE         REJECTED
                                 │
                         endAt < now (cron)
                                 ▼
                              EXPIRED

Admin create ───────────────► ACTIVE (bỏ qua PENDING)
```

| Status | UI gợi ý |
|--------|----------|
| `PENDING` | Chờ duyệt — seller được PATCH; admin approve/reject |
| `ACTIVE` | Đang / sẽ chạy (xem thêm `startAt`/`endAt`) |
| `REJECTED` | Hiện `rejectionReason` |
| `EXPIRED` | Hết hạn (cron) |

### BannerLang

`VI` \| `EN` \| `TW`

| Code | Ngôn ngữ |
|------|----------|
| `VI` | Tiếng Việt |
| `EN` | English |
| `TW` | Tiếng Đài Loan (繁體中文／台灣) |

---

## 3. Seller promotions

**Base:** `/promotions`  
**Permission:** `MANAGE_PROMO`

### 3.1 Create → `PENDING`

```
POST /promotions
Content-Type: application/json
```

```json
{
  "name": "Summer sale",
  "type": "PERCENT",
  "discountValue": "10",
  "budget": "1000.00",
  "startAt": "2026-08-01T00:00:00.000Z",
  "endAt": "2026-08-31T23:59:59.000Z",
  "skus": ["SKU-MOUSE-01"],
  "categoryIds": []
}
```

**FREE_SHIP** — bỏ `discountValue`:

```json
{
  "name": "Free ship T8",
  "type": "FREE_SHIP",
  "startAt": "2026-08-01T00:00:00.000Z",
  "endAt": "2026-08-31T23:59:59.000Z",
  "skus": ["SKU-MOUSE-01"]
}
```

**VOUCHER**:

```json
{
  "name": "Voucher 5$",
  "type": "VOUCHER",
  "code": "SUMMER10",
  "discountValue": "5.00",
  "startAt": "2026-08-01T00:00:00.000Z",
  "endAt": "2026-08-31T23:59:59.000Z",
  "skus": ["SKU-MOUSE-01"]
}
```

**Response `201`:**

```json
{
  "statusCode": 201,
  "message": "Promotion saved",
  "data": {
    "id": "uuid",
    "shopId": "uuid",
    "createdByUserId": "uuid",
    "name": "Summer sale",
    "type": "PERCENT",
    "discountValue": "10",
    "code": null,
    "budget": "1000.00",
    "startAt": "2026-08-01T00:00:00.000Z",
    "endAt": "2026-08-31T23:59:59.000Z",
    "scopeType": "TARGETED",
    "skus": ["SKU-MOUSE-01"],
    "categoryIds": [],
    "status": "PENDING",
    "rejectionReason": null,
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

### 3.2 List / get / update

```
GET  /promotions?status=PENDING&page=1&pageSize=20
GET  /promotions/:promotionId
PATCH /promotions/:promotionId
```

- List chỉ KM của **shop mình**.
- `PATCH` chỉ khi `status === PENDING`.
- Body PATCH: field optional (giống create).

---

## 4. Admin promotions

**Base:** `/admin/promotions`

### 4.1 Create → `ACTIVE` (`MANAGE_PROMO` ALL)

```
POST /admin/promotions
```

**Toàn sàn:**

```json
{
  "name": "Platform 5%",
  "type": "PERCENT",
  "discountValue": "5",
  "scopeType": "PLATFORM",
  "startAt": "2026-08-01T00:00:00.000Z",
  "endAt": "2026-08-31T23:59:59.000Z"
}
```

**TARGETED** (SKU / category bắt buộc):

```json
{
  "name": "Category electronics",
  "type": "FIXED",
  "discountValue": "2.00",
  "scopeType": "TARGETED",
  "categoryIds": ["electronics"],
  "startAt": "...",
  "endAt": "..."
}
```

`shopId` trong response = `null` (platform promo).

### 4.2 List / detail / update

```
GET   /admin/promotions?status=PENDING&page=1&pageSize=20   → APPROVE_PROMO
GET   /admin/promotions/:promotionId                       → APPROVE_PROMO
PATCH /admin/promotions/:promotionId                       → MANAGE_PROMO ALL
```

Màn duyệt: filter `status=PENDING`, hiện budget + `skus` / `categoryIds`.

### 4.3 Approve / Reject

```
POST /admin/promotions/:promotionId/approve
```

→ `ACTIVE`, notify seller. Không body.

```
POST /admin/promotions/:promotionId/reject
Content-Type: application/json

{ "reason": "Budget vượt hạn mức shop" }
```

- `reason` bắt buộc, 1–500 ký tự.
- → `REJECTED` + lưu `rejectionReason`, notify seller.

Cả hai trả `200`.

---

## 5. Public & admin banners

### 5.1 Public list (homepage)

```
GET /banners?lang=VI
```

**Không auth.** `lang` mặc định `VI`.

**Response `200`:**

```json
{
  "message": "Banners retrieved successfully",
  "data": [
    {
      "id": "uuid",
      "title": "Flash sale",
      "imageUrl": "https://…/banners/….webp",
      "linkUrl": "https://app.example/sale",
      "lang": "VI",
      "sortOrder": 0,
      "isActive": true,
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

FE sort theo `sortOrder` ASC (BE đã sort). Chỉ banner `isActive=true`.

### 5.2 Admin CRUD (`MANAGE_CONTENT`)

```
GET    /admin/banners?lang=VI&page=1&pageSize=20
GET    /admin/banners/:bannerId
POST   /admin/banners          multipart
PATCH  /admin/banners/:bannerId multipart (image optional)
DELETE /admin/banners/:bannerId
```

**Create multipart** field names:

| Field | Required | Note |
|-------|----------|------|
| `image` | create: **yes** | jpeg/png/webp/gif ≤ 5MB → BE convert webp |
| `title` | yes | string |
| `lang` | yes | `VI` \| `EN` \| `TW` |
| `linkUrl` | no | URL |
| `sortOrder` | no | int ≥ 0, default 0 |
| `isActive` | no | `"true"` / `"false"`, default true |

```ts
const fd = new FormData();
fd.append("image", file);
fd.append("title", "Flash sale");
fd.append("lang", "VI");
fd.append("linkUrl", "https://…");
fd.append("sortOrder", "0");
fd.append("isActive", "true");
await api.post("/admin/banners", fd); // không set Content-Type tay
```

Sau create/update/delete → public `GET /banners` cập nhật ngay (cache clear).

---

## 6. Marketing media library

### 6.1 Seller / staff — list & download (`VIEW_MKT_MAT`)

```
GET /marketing/folders?page=1&pageSize=20
GET /marketing/folders/:folderId
GET /marketing/folders/:folderId/download   → application/zip (binary stream)
```

**Download:** không dùng JSON envelope — pipe blob:

```ts
const res = await api.get(`/marketing/folders/${id}/download`, {
  responseType: "blob",
});
const url = URL.createObjectURL(res.data);
const a = document.createElement("a");
a.href = url;
a.download = "media.zip"; // hoặc parse Content-Disposition
a.click();
```

Folder rỗng → `400` `MEDIA_FOLDER_EMPTY`.

### 6.2 Admin — folders & upload (`MANAGE_CONTENT`)

```
GET    /admin/marketing/folders
POST   /admin/marketing/folders
PATCH  /admin/marketing/folders/:folderId
GET    /admin/marketing/folders/:folderId
POST   /admin/marketing/folders/:folderId/assets   multipart field `file` ≤ 20MB
DELETE /admin/marketing/assets/:assetId
```

**Create folder:**

```json
{ "name": "Seller kit Q3", "description": "Banner + social assets" }
```

**Upload asset:**

```ts
const fd = new FormData();
fd.append("file", file); // field name: file
await api.post(`/admin/marketing/folders/${folderId}/assets`, fd);
```

Folder view:

```json
{
  "id": "uuid",
  "name": "Seller kit Q3",
  "description": "...",
  "assetCount": 3,
  "assets": [
    {
      "id": "uuid",
      "folderId": "uuid",
      "fileName": "poster.png",
      "fileUrl": "https://…",
      "contentType": "image/png",
      "sizeBytes": 12345,
      "createdAt": "..."
    }
  ],
  "createdAt": "...",
  "updatedAt": "..."
}
```

---

## 7. TypeScript types

```ts
type PromotionType = "PERCENT" | "FIXED" | "FREE_SHIP" | "VOUCHER";
type PromotionScope = "PLATFORM" | "TARGETED";
type PromotionStatus = "PENDING" | "ACTIVE" | "REJECTED" | "EXPIRED";
type BannerLang = "VI" | "EN" | "TW";

type Promotion = {
  id: string;
  shopId: string | null;
  createdByUserId: string;
  name: string;
  type: PromotionType;
  discountValue: string;
  code: string | null;
  budget: string | null;
  startAt: string;
  endAt: string;
  scopeType: PromotionScope;
  skus: string[];
  categoryIds: string[];
  status: PromotionStatus;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
};

type CreatePromotionBody = {
  name: string;
  type: PromotionType;
  discountValue?: string; // required except FREE_SHIP
  code?: string; // required if VOUCHER
  budget?: string;
  startAt: string;
  endAt: string;
  scopeType?: PromotionScope; // admin only
  skus?: string[];
  categoryIds?: string[];
};

type Banner = {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl: string | null;
  lang: BannerLang;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type MarketingFolder = {
  id: string;
  name: string;
  description: string | null;
  assetCount: number;
  createdAt: string;
  updatedAt: string;
};

type MarketingAsset = {
  id: string;
  folderId: string;
  fileName: string;
  fileUrl: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
};
```

---

## 8. Error codes

| HTTP | Code | Khi nào |
|------|------|---------|
| 403 | `PROMO_INVALID_SKU` | Seller: SKU không thuộc shop; Admin TARGETED: SKU không tồn tại |
| 400 | `PROMO_INVALID_SCOPE` | TARGETED thiếu SKU/category; PLATFORM kèm SKU; seller dùng PLATFORM |
| 400 | `PROMO_INVALID_WINDOW` | `endAt` ≤ `startAt` |
| 400 | `PROMO_CODE_REQUIRED` | `type=VOUCHER` thiếu `code` |
| 409 | `PROMO_CODE_TAKEN` | Mã voucher trùng |
| 400 | `PROMO_DISCOUNT_REQUIRED` | Thiếu `discountValue` (PERCENT/FIXED/VOUCHER) |
| 404 | `PROMO_NOT_FOUND` | |
| 409 | `PROMO_NOT_PENDING` | Approve/reject/seller-update khi không PENDING |
| 404 | `BANNER_NOT_FOUND` | |
| 400 | `INVALID_BANNER_IMAGE` | |
| 413 | `BANNER_IMAGE_TOO_LARGE` | > 5MB |
| 404 | `MEDIA_FOLDER_NOT_FOUND` | |
| 404 | `MEDIA_ASSET_NOT_FOUND` | |
| 400 | `MEDIA_FOLDER_EMPTY` | Download ZIP folder trống |
| 400 | `INVALID_MEDIA_ASSET` | |
| 413 | `MEDIA_ASSET_TOO_LARGE` | > 20MB |
| 403 | `FORBIDDEN` | Thiếu permission / Guest-Buyer media |
| 409 | `SHOP_NOT_APPROVED` | Seller shop chưa duyệt / suspended |
| 404 | `CATEGORY_NOT_FOUND` | `categoryIds` không hợp lệ |

Map UI theo `data.code` trong error envelope.

---

## 9. FE checklist

### Seller center
- [ ] Form tạo KM: switch UI theo `type` (ẩn/hiện `discountValue`, `code`)
- [ ] Picker SKU (shop variants) + optional category
- [ ] List filter `status`; badge PENDING / ACTIVE / REJECTED / EXPIRED
- [ ] Edit chỉ `PENDING`; hiện `rejectionReason` khi REJECTED
- [ ] Media folders list + nút Download ZIP

### Admin
- [ ] Queue `GET /admin/promotions?status=PENDING` → approve / reject (+ modal reason)
- [ ] Form admin: radio `PLATFORM` vs `TARGETED` (TARGETED bắt buộc SKU/category)
- [ ] Banner manager: multipart create/update, toggle `isActive`, `lang` tabs VI/EN/TW
- [ ] Media: tạo folder, upload `file`, xóa asset

### Public / storefront
- [ ] Homepage: `GET /banners?lang=` theo locale app
- [ ] **Không** apply voucher/promo lúc checkout (MVP)

### Multipart field names

| Endpoint | Field | Max |
|----------|-------|-----|
| `POST/PATCH /admin/banners` | `image` | 5MB |
| `POST /admin/marketing/folders/:id/assets` | `file` | 20MB |
