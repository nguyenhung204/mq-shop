import { api } from "./client";
import type { PageMeta, Paginated } from "./types";

export type InventorySlipType = "IN" | "ADJUST_IN" | "ADJUST_OUT";
export type InventorySlipStatus = "PENDING" | "APPROVED" | "REJECTED";

export type Warehouse = {
  id: string;
  shopId: string;
  code: string;
  address: string | null;
  createdAt: string;
};

export type InventoryVariant = {
  id: string;
  shopId: string;
  productId: string;
  sku: string;
  /** Sell price. */
  sellingPrice: number;
  availableStock: number;
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
  warehouseCode: string | null;
  locationNote: string | null;
  createdByUserId: string;
  processedAt: string | null;
  createdAt: string;
  items: InventorySlipItem[];
};

export type StockLedgerEntry = {
  id: string;
  slipId: string;
  slipItemId: string;
  sku: string;
  type: InventorySlipType;
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  recordedAt: string;
};

export type CreateWarehouseRequest = {
  code: string;
  address?: string;
};

export type CreateVariantRequest = {
  productId: string;
  sku: string;
  sellingPrice: number;
  options?: Record<string, string>;
  costPrice?: number | null;
  isEnrollmentPackage?: boolean;
};

export type CreateSlipItemRequest = {
  sku: string;
  quantity: number;
  unitCost?: number | null;
};

export type CreateSlipRequest = {
  type: InventorySlipType;
  warehouseCode?: string;
  locationNote?: string;
  items: CreateSlipItemRequest[];
};

export type ListVariantsParams = {
  q?: string;
  productId?: string;
  page?: number;
  pageSize?: number;
};

export type ListSlipsParams = {
  status?: InventorySlipStatus;
  page?: number;
  pageSize?: number;
};

export type ListLedgerParams = {
  sku?: string;
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

export const inventoryApi = {
  listWarehouses: () => api.get<Warehouse[]>("/inventory/warehouses"),

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
