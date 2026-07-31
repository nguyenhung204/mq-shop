# FE Migration Guide — Multi-Warehouse Inventory (feat/023)

Tài liệu hướng dẫn FE cập nhật từ mô hình tồn kho **1 cấp** (stock trên variant) sang mô hình **multi-warehouse** (stock tách theo kho).

**Branch:** `feat/023-warehouse-inventory`
**Base:** `feat/022-seller-dashboard`

---

## Tổng quan thay đổi

### Trước (cũ)

```
Product
  └── Variant (sku, sellingPrice, availableStock, reservedStock)
```

### Sau (mới)

```
Product
  └── Variant (sku, sellingPrice, options, costPrice)
        └── WarehouseInventory[] (warehouseId, variantId, availableStock, reservedStock)

Warehouse (id, code, address, countryCode)
```

- Stock nằm ở bảng `warehouse_inventories` — mỗi dòng = 1 kho + 1 variant
- BE tự SUM stock khi trả response → **FE không cần thay đổi cách hiển thị**
- Phiếu nhập/xuất: `warehouseCode` **bắt buộc**
- Order item lưu `warehouseId` (kho xuất hàng, BE tự chọn)
- Stock ledger ghi `warehouseId` cho mỗi dòng biến động

---

## 1. Breaking changes — FE BẮT BUỘC sửa

### 1.1 Create Inventory Slip: `warehouseCode` bắt buộc

```diff
 POST /inventory/slips
 {
   type: "IN",
   items: [{ sku: "...", quantity: 100 }],
-  warehouseCode?: "KHO-HCM",  // optional trước đây
+  warehouseCode: "KHO-HCM",   // BẮT BUỘC — validation sẽ reject nếu thiếu
 }
```

**FE cần:**
1. Gọi `GET /inventory/warehouses` load danh sách kho
2. Hiện dropdown chọn kho trên form tạo phiếu
3. Nếu shop chưa có kho → prompt "Tạo kho trước"

### 1.2 Response thêm field mới (không breaking render, chỉ thêm)

| Endpoint | Field mới | Mô tả |
|----------|-----------|-------|
| `GET /inventory/ledger` | `warehouseId` | Kho bị ảnh hưởng |
| Order item (trong order detail) | `warehouseId` | Kho xuất hàng |

---

## 2. API response — stock ĐÃ trả đúng từ BE

BE đã tự SUM từ `warehouse_inventories`. FE **không cần thay đổi render logic**.

| Endpoint | Field | Nguồn |
|----------|-------|-------|
| `GET /inventory/variants` | `availableStock`, `reservedStock` | SUM warehouse_inventories |
| `GET /products/listing/:id` (PDP) | `variant.availableStock` | SUM warehouse_inventories |
| `GET /products/listing` (cards) | `stock` | SUM warehouse_inventories |
| `GET /products` (seller) | `stock`, `variant.availableStock` | SUM warehouse_inventories |
| Seller Dashboard low stock | `availableStock`, `reservedStock` | SUM warehouse_inventories |

---

## 3. Endpoint mới

### 3.1 Xem tồn kho theo kho cụ thể

```
GET /inventory/warehouses/:warehouseId/stock?q=&page=1&pageSize=20&shopId=
```

**Permission:** `VIEW_INVENTORY`

**Response:**
```ts
{
  message: "Warehouse stock retrieved successfully",
  data: Array<{
    warehouseInventoryId: string;
    variantId: string;
    sku: string;
    productId: string;
    productTitle: string;
    options: Record<string, string> | null;
    sellingPrice: string;
    availableStock: number;
    reservedStock: number;
    updatedAt: string;
  }>,
  meta: { page, pageSize, total, totalPages }
}
```

**Params:**
- `warehouseId` (path) — UUID kho
- `q` (query) — tìm theo SKU hoặc tên sản phẩm
- `page`, `pageSize` — pagination
- `shopId` (query) — cho WAREHOUSE/ADMIN

### 3.2 Tạo kho — thêm `countryCode`

```ts
POST /inventory/warehouses
{
  code: "KHO-TW",
  address: "台北市信義區...",
  countryCode: "TW"   // optional, default "VN" (ISO 3166-1 alpha-2)
}
```

**Response warehouse giờ có:**
```ts
{
  id: string;
  shopId: string;
  code: string;
  address: string | null;
  countryCode: string;     // "VN", "TW", "US"...
  warehouseType: string;   // luôn "SHOP" (bỏ qua field này)
  createdAt: string;
}
```

---

## 4. Notification in-app (MỚI)

Hệ thống giờ gửi notification realtime (SSE `/notifications/stream`) cho inventory events:

| Event | Ai nhận | Type |
|-------|---------|------|
| Phiếu tạo mới (PENDING) | Staff kho + Seller (trừ người tạo) | `INVENTORY_SLIP_PENDING` |
| Phiếu được duyệt | Người tạo phiếu | `INVENTORY_SLIP_APPROVED` |
| Phiếu bị từ chối | Người tạo phiếu | `INVENTORY_SLIP_REJECTED` |
| Chuyển kho tạo mới | Staff kho (trừ người tạo) | `INVENTORY_TRANSFER_PENDING` |
| Chuyển kho duyệt (IN_TRANSIT) | Người tạo + NV kho | `INVENTORY_TRANSFER_APPROVED` |
| Kho nhận xác nhận | Người tạo + người duyệt | `INVENTORY_TRANSFER_RECEIVED` |

**Meta trả về:** `{ slipId, code }` hoặc `{ transferId, code }` — FE dùng để deep-link đến chi tiết.

---

## 5. Flow nghiệp vụ đầy đủ

### 5.1 Nhập hàng

```
1. GET /inventory/warehouses        → load dropdown kho
2. POST /inventory/slips            → tạo phiếu PENDING (warehouseCode bắt buộc)
   → Notification tới approvers
3. POST /inventory/slips/:id/approve → stock tăng ở kho đó
   → Notification tới người tạo
```

### 5.2 Điều chỉnh tồn

```
POST /inventory/slips { type: "ADJUST_OUT", warehouseCode: "KHO-HCM", items: [...] }
→ Approve → stock giảm ở KHO-HCM
```

### 5.3 Chuyển kho

```
1. POST /inventory/transfers { fromWarehouseId, toWarehouseId, items }
   → Notification tới approvers
2. POST /inventory/transfers/:id/approve
   → Kho xuất -= qty (TRANSFER_OUT)
   → Notification tới NV kho nhận
3. POST /inventory/transfers/:id/receive { items: [{ sku, receivedQuantity }] }
   → Kho nhận += receivedQuantity (TRANSFER_IN)
   → Notification tới người tạo + người duyệt
```

### 5.4 Đặt hàng (checkout — tự động)

```
POST /checkout → BE tự chọn kho có đủ stock → reserve
FE KHÔNG cần truyền warehouseId
```

### 5.5 Hủy đơn / Giao thành công

```
Cancel → release stock về đúng kho (từ order_items.warehouse_id)
Delivered → consume reserved ở đúng kho
```

---

## 6. Stock Ledger response

```ts
GET /inventory/ledger?sku=&page=1&pageSize=20

// Response item:
{
  id: string;
  slipId: string;
  slipItemId: string;
  sku: string;
  type: "IN" | "ADJUST_IN" | "ADJUST_OUT" | "TRANSFER_OUT" | "TRANSFER_IN";
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  warehouseId: string;     // MỚI — kho bị ảnh hưởng
  recordedAt: string;
}
```

FE hiển thị tên kho = resolve `warehouseId` từ danh sách kho đã load (`GET /inventory/warehouses`).

---

## 7. Type changes tổng hợp (TypeScript)

```diff
// CreateSlipInput
 interface CreateSlipInput {
   type: "IN" | "ADJUST_IN" | "ADJUST_OUT";
   items: Array<{ sku: string; quantity: number; unitCost?: number }>;
-  warehouseCode?: string | null;
+  warehouseCode: string;
   locationNote?: string | null;
 }

// WarehouseView (response)
 interface WarehouseView {
   id: string;
   shopId: string;
   code: string;
   address: string | null;
+  countryCode: string;
+  warehouseType: string;
   createdAt: string;
 }

// StockLedgerView (response)
 interface StockLedgerView {
   ...existing fields...
+  warehouseId: string;
 }

// OrderItemView (response)
 interface OrderItemView {
   ...existing fields...
+  warehouseId: string;
 }

// VariantView — KHÔNG ĐỔI shape, chỉ đổi nguồn tính
 interface VariantView {
   id: string;
   sku: string;
   sellingPrice: number;
   availableStock: number;   // BE tính SUM từ warehouse_inventories
   reservedStock: number;    // BE tính SUM từ warehouse_inventories
   options: Record<string, string> | null;
   images: string[];
   costPrice: number | null;
   isEnrollmentPackage: boolean;
   createdAt: string;
   updatedAt: string;
 }
```

---

## 8. Checklist FE implementation

| # | Task | Priority | Ghi chú |
|---|------|----------|---------|
| 1 | Form tạo phiếu: thêm dropdown chọn kho (required) | **Cao** | Load từ `GET /inventory/warehouses` |
| 2 | Nếu shop chưa có kho → hiện prompt tạo kho trước | Cao | UX guard |
| 3 | Tạo kho: thêm field chọn quốc gia (`countryCode`) | Trung bình | Dropdown country |
| 4 | Trang tồn kho theo kho: `GET /warehouses/:id/stock` | Trung bình | Trang mới hoặc tab |
| 5 | Ledger: hiển thị tên kho bên cạnh mỗi dòng | Thấp | Resolve từ warehouse list |
| 6 | Order detail: hiển thị kho xuất (optional) | Thấp | Dùng `warehouseId` trên item |
| 7 | Notification badge: handle new notification types | Thấp | Deep-link tới slip/transfer |
| 8 | Transfer flow UI: giữ nguyên (API không đổi) | — | Không cần sửa |
| 9 | Checkout: KHÔNG sửa gì | — | BE tự chọn kho |
| 10 | PDP / Listing: KHÔNG sửa gì | — | BE đã trả stock đúng |

---

## 9. FAQ

| Câu hỏi | Trả lời |
|----------|---------|
| Checkout cần truyền warehouseId? | **Không** — BE tự chọn |
| Tạo phiếu không chọn kho được không? | **Không** — server reject 400 |
| `availableStock` trên variant response là gì? | Tổng SUM từ tất cả kho (BE tính) |
| PDP/Listing cần sửa gì? | Không — stock đã trả đúng |
| Transfer API đổi gì? | Không đổi contract |
| Low stock alert đổi gì? | Không — BE SUM tự động |
| Kho có quốc gia không? | Có — field `countryCode` |
| Notification có realtime không? | Có — qua SSE `/notifications/stream` |

---

## 10. Entity / DB Schema Reference (cho FE hiểu data model)

### Warehouse (bảng `warehouses`)

```ts
interface Warehouse {
  id: string;              // UUID
  shopId: string;          // UUID — kho thuộc shop nào
  code: string;            // Mã kho unique trong shop (vd: "KHO-HCM")
  address: string | null;  // Địa chỉ kho
  countryCode: string;     // ISO 3166-1 alpha-2 (vd: "VN", "TW") — default "VN"
  warehouseType: string;   // "SHOP" (luôn là SHOP, bỏ qua field này)
  createdAt: string;       // ISO datetime
}
```

### Variant (bảng `inventory_variants`)

```ts
interface Variant {
  id: string;              // UUID
  shopId: string;          // UUID — variant thuộc shop nào
  productId: string;       // UUID — thuộc product nào
  sku: string;             // Mã SKU unique trong shop
  sellingPrice: number;    // Giá bán (source of truth cho checkout)
  options: Record<string, string> | null; // { size: "M", color: "black" }
  images: string[];        // Gallery riêng variant (FE fallback product.images nếu rỗng)
  costPrice: number | null; // Giá nhập hiện tại trên SKU (chỉ seller/admin thấy)
  isEnrollmentPackage: boolean; // Gói gia nhập MLM
  createdAt: string;
  updatedAt: string;
}
// LƯU Ý: Variant KHÔNG còn availableStock/reservedStock
// Stock lấy từ warehouse_inventories (BE tự SUM khi trả response)
```

### WarehouseInventory (bảng `warehouse_inventories`) — SOURCE OF TRUTH cho stock

```ts
interface WarehouseInventory {
  id: string;              // UUID
  warehouseId: string;     // UUID — kho nào
  variantId: string;       // UUID — variant nào
  availableStock: number;  // Số lượng có sẵn (bán được)
  reservedStock: number;   // Số lượng đã giữ cho đơn hàng (chưa giao)
  updatedAt: string;
}
// Unique constraint: (warehouseId + variantId) — mỗi variant chỉ 1 row/kho
```

### InventorySlip (bảng `inventory_slips`) — Phiếu nhập/xuất/điều chỉnh

```ts
interface InventorySlip {
  id: string;
  code: string;            // Auto-generated: "PN-20260731-A1B2"
  shopId: string;
  type: "IN" | "ADJUST_IN" | "ADJUST_OUT";
  status: "PENDING" | "APPROVED" | "REJECTED";
  warehouseCode: string;   // Mã kho target (BẮT BUỘC)
  locationNote: string | null; // Ghi chú vị trí
  createdByUserId: string;
  processedAt: string | null; // Thời điểm approve/reject
  createdAt: string;
}
```

### InventorySlipItem (bảng `inventory_slip_items`) — Dòng trong phiếu

```ts
interface InventorySlipItem {
  id: string;
  slipId: string;          // Thuộc phiếu nào
  sku: string;             // SKU
  quantity: number;        // Số lượng nhập/xuất
  unitCost: number | null; // Giá nhập/unit (dùng cho IN/ADJUST_IN)
}
// Unique: (slipId + sku) — không trùng SKU trong cùng phiếu
```

### InventoryTransfer (bảng `inventory_transfers`) — Phiếu chuyển kho

```ts
interface InventoryTransfer {
  id: string;
  code: string;            // Auto-generated: "TF-20260731-A1B2"
  fromWarehouseId: string; // UUID kho xuất
  toWarehouseId: string;   // UUID kho nhận
  status: "PENDING" | "IN_TRANSIT" | "RECEIVED" | "CANCELLED";
  createdByUserId: string;
  approvedByUserId: string | null;
  receivedByUserId: string | null;
  shippingNote: string | null;
  processedAt: string | null;  // Thời điểm approve
  receivedAt: string | null;   // Thời điểm receive
  createdAt: string;
  updatedAt: string;
}
```

### InventoryTransferItem (bảng `inventory_transfer_items`)

```ts
interface InventoryTransferItem {
  id: string;
  transferId: string;
  sku: string;
  quantity: number;         // Số lượng yêu cầu chuyển
  receivedQuantity: number; // Số lượng thực nhận (có thể < quantity nếu hao hụt)
}
// Unique: (transferId + sku)
```

### StockLedger (bảng `stock_ledger`) — Sổ cái tồn kho (audit trail)

```ts
interface StockLedger {
  id: string;
  slipId: string;          // ID phiếu (slip hoặc transfer)
  slipItemId: string;      // ID dòng item
  shopId: string;
  warehouseId: string;     // Kho bị ảnh hưởng
  sku: string;
  type: "IN" | "ADJUST_IN" | "ADJUST_OUT" | "TRANSFER_OUT" | "TRANSFER_IN";
  quantity: number;        // Số lượng thay đổi
  quantityBefore: number;  // Tồn trước
  quantityAfter: number;   // Tồn sau
  recordedAt: string;      // Thời điểm ghi
}
// Immutable — chỉ INSERT, không bao giờ UPDATE/DELETE
```

### OrderItem (bảng `order_items`) — Dòng trong đơn hàng

```ts
interface OrderItem {
  id: string;
  orderId: string;
  variantId: string;
  warehouseId: string;     // MỚI — kho xuất hàng (BE tự chọn khi checkout)
  productId: string;
  sku: string;
  titleSnapshot: string;   // Tên SP tại thời điểm đặt (immutable)
  imageSnapshot: string | null;
  unitPrice: string;       // Giá tại thời điểm đặt
  quantity: number;
  lineTotal: string;       // unitPrice × quantity
  createdAt: string;
}
```

---

## 11. Quan hệ giữa các entity (diagram)

```
Shop
 └── Warehouse[] (nhiều kho)
 └── Product[]
      └── Variant[] (nhiều SKU)

WarehouseInventory = Warehouse × Variant (stock mỗi SKU trong mỗi kho)

InventorySlip → target 1 Warehouse (nhập/xuất stock vào kho cụ thể)
 └── InventorySlipItem[] (nhiều dòng SKU)

InventoryTransfer → from Warehouse → to Warehouse
 └── InventoryTransferItem[] (nhiều dòng SKU)

StockLedger → ghi lại MỌI thay đổi stock (immutable audit trail)
 ├── reference slip/transfer
 └── ghi warehouseId + before/after

Order
 └── OrderItem[] → mỗi item ghi warehouseId (kho xuất)
```

**Quy tắc:**
- `Product` / `Variant` = thông tin sản phẩm (tên, giá, SKU, options) — **KHÔNG chứa stock**
- `WarehouseInventory` = source of truth cho stock
- Tổng tồn hiển thị = SUM(`warehouse_inventories.available_stock`) WHERE `variant_id` = X
- Mọi thay đổi stock **phải** đi qua phiếu (slip/transfer) → approve → ghi ledger
