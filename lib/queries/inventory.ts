"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/client";
import { createIdempotencyKeyStore } from "@/lib/api/idempotency";
import {
  adminInventoryApi,
  inventoryApi,
  transferApi,
  type AdminListLedgerParams,
  type AdminListSlipsParams,
  type CreateSlipRequest,
  type CreateTransferRequest,
  type CreateVariantRequest,
  type CreateWarehouseRequest,
  type InventorySlip,
  type InventorySlipStatus,
  type InventoryVariant,
  type InventoryTransfer,
  type ListLedgerParams,
  type ListSlipsParams,
  type ListTransfersParams,
  type ListVariantsParams,
  type ListWarehouseStockParams,
  type ReceiveTransferRequest,
  type StockLedgerEntry,
  type Warehouse,
  type WarehouseStockItem,
} from "@/lib/api/inventory";
import { asArray, parsePage } from "@/lib/api/utils";
import { tt } from "@/lib/i18n/tt";
import { getErrorMessage } from "@/lib/queries/utils";

export const inventoryKeys = {
  all: ["inventory"] as const,
  warehouses: (shopId?: string) =>
    [...inventoryKeys.all, "warehouses", shopId ?? ""] as const,
  variants: (params: ListVariantsParams) =>
    [
      ...inventoryKeys.all,
      "variants",
      params.page ?? 1,
      params.pageSize ?? 20,
      params.q?.trim() || "",
      params.productId || "",
    ] as const,
  slips: (params: ListSlipsParams) =>
    [
      ...inventoryKeys.all,
      "slips",
      params.page ?? 1,
      params.pageSize ?? 20,
      params.status ?? "",
    ] as const,
  slip: (id: string) => [...inventoryKeys.all, "slip", id] as const,
  ledger: (params: ListLedgerParams) =>
    [
      ...inventoryKeys.all,
      "ledger",
      params.page ?? 1,
      params.pageSize ?? 20,
      params.sku?.trim() || "",
      params.from || "",
      params.to || "",
    ] as const,
  adminSlips: (params: {
    status?: InventorySlipStatus | "";
    shopId?: string;
    page?: number;
    pageSize?: number;
  }) =>
    [
      ...inventoryKeys.all,
      "admin-slips",
      params.page ?? 1,
      params.pageSize ?? 20,
      params.status ?? "",
      params.shopId ?? "",
    ] as const,
  adminLedger: (params: AdminListLedgerParams) =>
    [
      ...inventoryKeys.all,
      "admin-ledger",
      params.shopId,
      params.page ?? 1,
      params.pageSize ?? 20,
      params.sku?.trim() || "",
      params.from || "",
      params.to || "",
    ] as const,
  transfers: (params: ListTransfersParams) =>
    [
      ...inventoryKeys.all,
      "transfers",
      params.page ?? 1,
      params.pageSize ?? 20,
      params.status ?? "",
      params.fromWarehouseId ?? "",
      params.toWarehouseId ?? "",
    ] as const,
  transfer: (id: string) => [...inventoryKeys.all, "transfer", id] as const,
  warehouseStock: (warehouseId: string, params: ListWarehouseStockParams) =>
    [
      ...inventoryKeys.all,
      "warehouseStock",
      warehouseId,
      params.q?.trim() || "",
      params.page ?? 1,
      params.pageSize ?? 20,
    ] as const,
};

/**
 * Inventory-specific wording for codes whose generic copy would be misleading
 * here. Everything else falls through to the shared code → i18n key map.
 */
function inventoryErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof ApiError) {
    switch (e.code) {
      case "VARIANT_NOT_FOUND":
        // Generic copy talks about the cart; here the SKU must be created first.
        return tt("toast.skuNotFoundCreateFirst");
      case "PRODUCT_NOT_FOUND":
        return tt("toast.productNotFoundInShop");
      case "INSUFFICIENT_STOCK":
        return tt("toast.insufficientStockAdjustment");
      case "SHOP_NOT_ELIGIBLE":
        return tt("toast.shopNotEligible");
      default:
        break;
    }
  }
  return getErrorMessage(e, fallback);
}

function useInventoryInvalidate() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
}

/**
 * Warehouses of the caller's shop, or of `shopId` for WAREHOUSE/ADMIN staff.
 * Also used to resolve `warehouseId` → code in the ledger and on order lines.
 */
export function useWarehouses(
  options: { enabled?: boolean; shopId?: string } = {},
) {
  const shopId = options.shopId?.trim() || undefined;
  return useQuery({
    queryKey: inventoryKeys.warehouses(shopId),
    queryFn: async () =>
      asArray<Warehouse>(await inventoryApi.listWarehouses(shopId)),
    enabled: options.enabled ?? true,
  });
}

/**
 * Warehouse lookup by id. Transfers and stock ledger rows reference warehouses
 * by id only, so any surface that shows a warehouse name resolves it here.
 */
export function useWarehouseLookup(
  options: { enabled?: boolean; shopId?: string } = {},
) {
  const { data, isLoading } = useWarehouses(options);
  const warehouses = useMemo(() => data ?? [], [data]);
  const byId = useMemo(() => {
    const map = new Map<string, Warehouse>();
    for (const w of warehouses) map.set(w.id, w);
    return map;
  }, [warehouses]);
  return { warehouses, byId, isLoading };
}

export function useInventoryVariants(params: ListVariantsParams = {}) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const q = params.q?.trim() || undefined;
  const productId = params.productId || undefined;
  return useQuery({
    queryKey: inventoryKeys.variants({ page, pageSize, q, productId }),
    queryFn: async () =>
      parsePage<InventoryVariant>(
        await inventoryApi.listVariants({ page, pageSize, q, productId }),
      ),
    placeholderData: (prev) => prev,
  });
}

export function useInventorySlips(params: ListSlipsParams = {}) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const status = params.status;
  return useQuery({
    queryKey: inventoryKeys.slips({ page, pageSize, status }),
    queryFn: async () =>
      parsePage<InventorySlip>(
        await inventoryApi.listSlips({ page, pageSize, status }),
      ),
    placeholderData: (prev) => prev,
  });
}

export function useInventorySlip(slipId: string | null) {
  return useQuery({
    queryKey: inventoryKeys.slip(slipId ?? ""),
    queryFn: () => inventoryApi.getSlip(slipId!),
    enabled: !!slipId,
  });
}

export function useAdminInventorySlip(slipId: string | null) {
  return useQuery({
    queryKey: [...inventoryKeys.all, "admin-slip", slipId ?? ""] as const,
    queryFn: () => adminInventoryApi.getSlip(slipId!),
    enabled: !!slipId,
  });
}

export function useInventoryLedger(params: ListLedgerParams = {}) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const sku = params.sku?.trim() || undefined;
  const from = params.from || undefined;
  const to = params.to || undefined;
  return useQuery({
    queryKey: inventoryKeys.ledger({ page, pageSize, sku, from, to }),
    queryFn: async () =>
      parsePage<StockLedgerEntry>(
        await inventoryApi.listLedger({ page, pageSize, sku, from, to }),
      ),
    placeholderData: (prev) => prev,
  });
}

export function useCreateWarehouse() {
  const invalidate = useInventoryInvalidate();
  return useMutation({
    mutationFn: (body: CreateWarehouseRequest) => inventoryApi.createWarehouse(body),
    onSuccess: () => {
      invalidate();
      toast.success(tt("toast.warehouseCreated"));
    },
    onError: (e) =>
      toast.error(inventoryErrorMessage(e, tt("toast.createWarehouseFailed"))),
  });
}

export function useCreateVariant() {
  const invalidate = useInventoryInvalidate();
  return useMutation({
    mutationFn: (body: CreateVariantRequest) => inventoryApi.createVariant(body),
    onSuccess: () => {
      invalidate();
      toast.success(tt("toast.skuCreated"));
    },
    onError: (e) =>
      toast.error(inventoryErrorMessage(e, tt("toast.createSkuFailed"))),
  });
}

function onIdempotencyError(
  e: unknown,
  idempotency: ReturnType<typeof createIdempotencyKeyStore>,
) {
  if (e instanceof ApiError && e.code === "IDEMPOTENCY_KEY_REUSE_MISMATCH") {
    idempotency.invalidate();
  }
}

export function useCreateSlip() {
  const invalidate = useInventoryInvalidate();
  const idempotency = useMemo(() => createIdempotencyKeyStore(), []);
  return useMutation({
    mutationFn: (body: CreateSlipRequest) =>
      inventoryApi.createSlip(body, idempotency.keyFor(body)),
    onSuccess: () => {
      idempotency.invalidate();
      invalidate();
      toast.success(tt("toast.slipCreated"));
    },
    onError: (e) => {
      onIdempotencyError(e, idempotency);
      toast.error(inventoryErrorMessage(e, tt("toast.createSlipFailed")));
    },
  });
}

export function useApproveSlip() {
  const invalidate = useInventoryInvalidate();
  const idempotency = useMemo(() => createIdempotencyKeyStore(), []);
  return useMutation({
    mutationFn: (slipId: string) =>
      inventoryApi.approveSlip(slipId, idempotency.keyFor({ slipId, action: "approve" })),
    onSuccess: () => {
      idempotency.invalidate();
      invalidate();
      toast.success(tt("toast.slipApproved"));
    },
    onError: (e) => {
      onIdempotencyError(e, idempotency);
      toast.error(inventoryErrorMessage(e, tt("toast.approveFailed")));
    },
  });
}

export function useRejectSlip() {
  const invalidate = useInventoryInvalidate();
  return useMutation({
    mutationFn: (slipId: string) => inventoryApi.rejectSlip(slipId),
    onSuccess: () => {
      invalidate();
      toast.success(tt("toast.slipRejected"));
    },
    onError: (e) => toast.error(inventoryErrorMessage(e, tt("toast.rejectFailed"))),
  });
}

export function useAdminInventorySlips(params: AdminListSlipsParams = {}) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const status = params.status;
  const shopId = params.shopId;
  return useQuery({
    queryKey: inventoryKeys.adminSlips({ page, pageSize, status, shopId }),
    queryFn: async () =>
      parsePage<InventorySlip>(
        await adminInventoryApi.listSlips({ page, pageSize, status, shopId }),
      ),
    placeholderData: (prev) => prev,
  });
}

export function useAdminInventoryLedger(params: Partial<AdminListLedgerParams> = {}) {
  const shopId = params.shopId?.trim() || "";
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const sku = params.sku?.trim() || undefined;
  const from = params.from || undefined;
  const to = params.to || undefined;
  return useQuery({
    queryKey: inventoryKeys.adminLedger({
      shopId,
      page,
      pageSize,
      sku,
      from,
      to,
    }),
    queryFn: async () =>
      parsePage<StockLedgerEntry>(
        await adminInventoryApi.listLedger({
          shopId,
          page,
          pageSize,
          sku,
          from,
          to,
        }),
      ),
    enabled: Boolean(shopId),
    placeholderData: (prev) => prev,
  });
}

export function useAdminApproveSlip() {
  const invalidate = useInventoryInvalidate();
  const idempotency = useMemo(() => createIdempotencyKeyStore(), []);
  return useMutation({
    mutationFn: (slipId: string) =>
      adminInventoryApi.approveSlip(
        slipId,
        idempotency.keyFor({ slipId, action: "admin-approve" }),
      ),
    onSuccess: () => {
      idempotency.invalidate();
      invalidate();
      toast.success(tt("toast.slipApproved"));
    },
    onError: (e) => {
      onIdempotencyError(e, idempotency);
      toast.error(inventoryErrorMessage(e, tt("toast.approveFailed")));
    },
  });
}

export function useAdminRejectSlip() {
  const invalidate = useInventoryInvalidate();
  return useMutation({
    mutationFn: (slipId: string) => adminInventoryApi.rejectSlip(slipId),
    onSuccess: () => {
      invalidate();
      toast.success(tt("toast.slipRejected"));
    },
    onError: (e) => toast.error(inventoryErrorMessage(e, tt("toast.rejectFailed"))),
  });
}

export type { InventorySlipStatus };

// ---------------------------------------------------------------------------
// Transfer hooks
// ---------------------------------------------------------------------------

export function useTransfers(params: ListTransfersParams = {}) {
  return useQuery({
    queryKey: inventoryKeys.transfers(params),
    queryFn: async () =>
      parsePage<InventoryTransfer>(await transferApi.list(params)),
  });
}

export function useTransferDetail(id: string | null) {
  return useQuery({
    queryKey: inventoryKeys.transfer(id ?? ""),
    queryFn: () => transferApi.get(id!),
    enabled: Boolean(id),
  });
}

export function useCreateTransfer() {
  const invalidate = useInventoryInvalidate();
  return useMutation({
    mutationFn: (body: CreateTransferRequest) => transferApi.create(body),
    onSuccess: () => {
      invalidate();
      toast.success(tt("toast.transferCreated"));
    },
    onError: (e) => toast.error(inventoryErrorMessage(e, tt("toast.transferFailed"))),
  });
}

export function useApproveTransfer() {
  const invalidate = useInventoryInvalidate();
  return useMutation({
    mutationFn: (id: string) => transferApi.approve(id),
    onSuccess: () => {
      invalidate();
      toast.success(tt("toast.transferApproved"));
    },
    onError: (e) => toast.error(inventoryErrorMessage(e, tt("toast.transferFailed"))),
  });
}

export function useReceiveTransfer() {
  const invalidate = useInventoryInvalidate();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ReceiveTransferRequest }) =>
      transferApi.receive(id, body),
    onSuccess: () => {
      invalidate();
      toast.success(tt("toast.transferReceived"));
    },
    onError: (e) => toast.error(inventoryErrorMessage(e, tt("toast.transferFailed"))),
  });
}

export function useCancelTransfer() {
  const invalidate = useInventoryInvalidate();
  return useMutation({
    mutationFn: (id: string) => transferApi.cancel(id),
    onSuccess: () => {
      invalidate();
      toast.success(tt("toast.transferCancelled"));
    },
    onError: (e) => toast.error(inventoryErrorMessage(e, tt("toast.transferFailed"))),
  });
}

export function useWarehouseStock(
  warehouseId: string | null,
  params: ListWarehouseStockParams = {},
) {
  return useQuery({
    queryKey: inventoryKeys.warehouseStock(warehouseId ?? "", params),
    queryFn: async () =>
      parsePage<WarehouseStockItem>(
        await inventoryApi.warehouseStock(warehouseId!, params),
      ),
    enabled: Boolean(warehouseId),
  });
}
