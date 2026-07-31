import { api } from "./client";
import type { PageMeta, Paginated } from "./types";

/** Slip types a user can create — transfers move stock through `transferApi` instead. */
export type InventorySlipType = "IN" | "ADJUST_IN" | "ADJUST_OUT";
/** Ledger records slip movements plus the two transfer legs. */
export type StockLedgerType = InventorySlipType | "TRANSFER_OUT" | "TRANSFER_IN";
export type InventorySlipStatus = "PENDING" | "APPROVED" | "REJECTED";

export type Warehouse = {
  id: string;
  shopId: string;
  code: string;
  address: string | null;
  /** ISO 3166-1 alpha-2, defaults to "VN" server-side. */
  countryCode: string;
  /** Always "SHOP" — kept for response fidelity, not rendered. */
  warehouseType?: string;
  createdAt: string;
};

export type InventoryVariant = {
  id: string;
  shopId: string;
  productId: string;
  sku: string;
  /** Sell price. */
  sellingPrice: number;
  /** SUM over warehouse_inventories for this variant (BE-computed). */
  availableStock: number;
  /** SUM over warehouse_inventories for this variant (BE-computed). */
  reservedStock: number;
  options?: Record<string, string> | null;
  images?: string[];
  costPrice: number | null;
  isEnrollmentPackage: boolean;
  createdAt: string;
  updatedAt: string;
};

export type InventorySlipItem = {
  id: string;
  sku: string;
  quantity: number;
  unitCost: number | null;
};

export type InventorySlip = {
  id: string;
  code: string;
  shopId: string;
  type: InventorySlipType;
  status: InventorySlipStatus;
  /** Target warehouse — required since multi-warehouse (feat/023). */
  warehouseCode: string;
  locationNote: string | null;
  createdByUserId: string;
  processedAt: string | null;
  createdAt: string;
  items: InventorySlipItem[];
};

export type StockLedgerEntry = {
  id: string;
  /** Slip or transfer id, depending on `type`. */
  slipId: string;
  slipItemId: string;
  shopId?: string;
  sku: string;
  type: StockLedgerType;
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  /** Warehouse whose stock moved. */
  warehouseId: string;
  recordedAt: string;
};

export type CreateWarehouseRequest = {
  code: string;
  address?: string;
  countryCode?: string;
  shopId?: string;
};

export type CreateVariantRequest = {
  productId: string;
  sku: string;
  sellingPrice: number;
  options?: Record<string, string>;
  costPrice?: number | null;
  isEnrollmentPackage?: boolean;
  shopId?: string;
};

export type CreateSlipItemRequest = {
  sku: string;
  quantity: number;
  unitCost?: number | null;
};

export type CreateSlipRequest = {
  type: InventorySlipType;
  warehouseCode: string;
  locationNote?: string;
  items: CreateSlipItemRequest[];
  shopId?: string;
};

export type ListVariantsParams = {
  q?: string;
  productId?: string;
  shopId?: string;
  page?: number;
  pageSize?: number;
};

export type ListSlipsParams = {
  status?: InventorySlipStatus;
  shopId?: string;
  page?: number;
  pageSize?: number;
};

export type ListLedgerParams = {
  sku?: string;
  shopId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
};

export type AdminListSlipsParams = {
  status?: InventorySlipStatus;
  shopId?: string;
  page?: number;
  pageSize?: number;
};

export type AdminListLedgerParams = {
  /** Required by GET /admin/inventory/ledger */
  shopId: string;
  sku?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
};

type PageEnvelope<T> =
  | T[]
  | { data: T[]; meta?: PageMeta }
  | Paginated<T>;

export type WarehouseStockItem = {
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
};

export type ListWarehouseStockParams = {
  q?: string;
  shopId?: string;
  page?: number;
  pageSize?: number;
};

export const inventoryApi = {
  listWarehouses: (shopId?: string) =>
    api.get<Warehouse[]>("/inventory/warehouses", {
      query: shopId ? { shopId } : undefined,
    }),

  warehouseStock: (warehouseId: string, query?: ListWarehouseStockParams) =>
    api.get<PageEnvelope<WarehouseStockItem>>(
      `/inventory/warehouses/${warehouseId}/stock`,
      { query, withMeta: true },
    ),

  createWarehouse: (body: CreateWarehouseRequest) =>
    api.post<Warehouse>("/inventory/warehouses", body),

  listVariants: (query?: ListVariantsParams) =>
    api.get<PageEnvelope<InventoryVariant>>("/inventory/variants", {
      query,
      withMeta: true,
    }),

  createVariant: (body: CreateVariantRequest) =>
    api.post<InventoryVariant>("/inventory/variants", body),

  listSlips: (query?: ListSlipsParams) =>
    api.get<PageEnvelope<InventorySlip>>("/inventory/slips", {
      query,
      withMeta: true,
    }),

  getSlip: (slipId: string) =>
    api.get<InventorySlip>(`/inventory/slips/${slipId}`),

  createSlip: (body: CreateSlipRequest, idempotencyKey: string) =>
    api.post<InventorySlip>("/inventory/slips", body, {
      headers: { "Idempotency-Key": idempotencyKey },
    }),

  approveSlip: (slipId: string, idempotencyKey: string) =>
    api.post<InventorySlip>(`/inventory/slips/${slipId}/approve`, {}, {
      headers: { "Idempotency-Key": idempotencyKey },
    }),

  rejectSlip: (slipId: string) =>
    api.post<InventorySlip>(`/inventory/slips/${slipId}/reject`, {}),

  listLedger: (query?: ListLedgerParams) =>
    api.get<PageEnvelope<StockLedgerEntry>>("/inventory/ledger", {
      query,
      withMeta: true,
    }),
};

export const adminInventoryApi = {
  listSlips: (query?: AdminListSlipsParams) =>
    api.get<PageEnvelope<InventorySlip>>("/admin/inventory/slips", {
      query,
      withMeta: true,
    }),

  getSlip: (slipId: string) =>
    api.get<InventorySlip>(`/admin/inventory/slips/${slipId}`),

  listLedger: (query: AdminListLedgerParams) =>
    api.get<PageEnvelope<StockLedgerEntry>>("/admin/inventory/ledger", {
      query,
      withMeta: true,
    }),

  approveSlip: (slipId: string, idempotencyKey: string) =>
    api.post<InventorySlip>(`/admin/inventory/slips/${slipId}/approve`, {}, {
      headers: { "Idempotency-Key": idempotencyKey },
    }),

  rejectSlip: (slipId: string) =>
    api.post<InventorySlip>(`/admin/inventory/slips/${slipId}/reject`, {}),
};

// ---------------------------------------------------------------------------
// Cross-warehouse Transfer (Section 5.2d)
// ---------------------------------------------------------------------------

export type TransferStatus = "PENDING" | "IN_TRANSIT" | "RECEIVED" | "CANCELLED";

export type TransferItem = {
  id?: string;
  sku: string;
  quantity: number;
  receivedQuantity?: number | null;
};

export type InventoryTransfer = {
  id: string;
  /** Human-readable code, e.g. "TF-20260731-A1B2". */
  code: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  fromWarehouse?: Warehouse;
  toWarehouse?: Warehouse;
  status: TransferStatus;
  shippingNote: string | null;
  receiveNote?: string | null;
  items: TransferItem[];
  createdByUserId: string;
  approvedByUserId?: string | null;
  receivedByUserId?: string | null;
  /** Approve timestamp (stock left the source warehouse). */
  processedAt?: string | null;
  /** Receive timestamp (stock landed in the destination warehouse). */
  receivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateTransferRequest = {
  fromWarehouseId: string;
  toWarehouseId: string;
  items: Array<{ sku: string; quantity: number }>;
  shippingNote?: string;
};

export type ReceiveTransferRequest = {
  items: Array<{ sku: string; receivedQuantity: number }>;
  note?: string;
};

export type ListTransfersParams = {
  status?: TransferStatus;
  fromWarehouseId?: string;
  toWarehouseId?: string;
  page?: number;
  pageSize?: number;
};

export const transferApi = {
  list: (query?: ListTransfersParams) =>
    api.get<PageEnvelope<InventoryTransfer>>("/inventory/transfers", {
      query,
      withMeta: true,
    }),

  get: (id: string) =>
    api.get<InventoryTransfer>(`/inventory/transfers/${id}`),

  create: (body: CreateTransferRequest) =>
    api.post<InventoryTransfer>("/inventory/transfers", body),

  approve: (id: string) =>
    api.post<InventoryTransfer>(`/inventory/transfers/${id}/approve`, {}),

  receive: (id: string, body: ReceiveTransferRequest) =>
    api.post<InventoryTransfer>(`/inventory/transfers/${id}/receive`, body),

  cancel: (id: string) =>
    api.post<InventoryTransfer>(`/inventory/transfers/${id}/cancel`, {}),
};
