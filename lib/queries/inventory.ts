"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/client";
import {
  adminInventoryApi,
  inventoryApi,
  type AdminListSlipsParams,
  type CreateSlipRequest,
  type CreateVariantRequest,
  type CreateWarehouseRequest,
  type InventorySlip,
  type InventorySlipStatus,
  type InventoryVariant,
  type ListLedgerParams,
  type ListSlipsParams,
  type ListVariantsParams,
  type StockLedgerEntry,
  type Warehouse,
} from "@/lib/api/inventory";
import { asArray, parsePage } from "@/lib/api/utils";
import { getErrorMessage } from "@/lib/queries/utils";

export const inventoryKeys = {
  all: ["inventory"] as const,
  warehouses: () => [...inventoryKeys.all, "warehouses"] as const,
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
};

function inventoryErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof ApiError) {
    switch (e.code) {
      case "WAREHOUSE_CODE_TAKEN":
        return "Warehouse code already exists in this shop.";
      case "VARIANT_SKU_TAKEN":
        return "SKU already exists in this shop.";
      case "VARIANT_NOT_FOUND":
        return "SKU not found. Create the variant first.";
      case "PRODUCT_NOT_FOUND":
        return "Product not found in this shop.";
      case "WAREHOUSE_NOT_FOUND":
        return "Warehouse code not found.";
      case "INVENTORY_SLIP_NOT_FOUND":
        return "Inventory slip not found.";
      case "INVENTORY_SLIP_ALREADY_PROCESSED":
        return "This slip was already approved or rejected.";
      case "INSUFFICIENT_STOCK":
        return "Not enough stock for this adjustment.";
      case "SHOP_NOT_ELIGIBLE":
        return "Shop must be approved and not suspended.";
      case "FORBIDDEN":
        return "You do not have permission for this action.";
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

export function useWarehouses() {
  return useQuery({
    queryKey: inventoryKeys.warehouses(),
    queryFn: async () => asArray<Warehouse>(await inventoryApi.listWarehouses()),
  });
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
      toast.success("Warehouse created");
    },
    onError: (e) => toast.error(inventoryErrorMessage(e, "Create warehouse failed")),
  });
}

export function useCreateVariant() {
  const invalidate = useInventoryInvalidate();
  return useMutation({
    mutationFn: (body: CreateVariantRequest) => inventoryApi.createVariant(body),
    onSuccess: () => {
      invalidate();
      toast.success("SKU created");
    },
    onError: (e) => toast.error(inventoryErrorMessage(e, "Create SKU failed")),
  });
}

export function useCreateSlip() {
  const invalidate = useInventoryInvalidate();
  return useMutation({
    mutationFn: (body: CreateSlipRequest) => inventoryApi.createSlip(body),
    onSuccess: () => {
      invalidate();
      toast.success("Slip created (pending approval)");
    },
    onError: (e) => toast.error(inventoryErrorMessage(e, "Create slip failed")),
  });
}

export function useApproveSlip() {
  const invalidate = useInventoryInvalidate();
  return useMutation({
    mutationFn: (slipId: string) => inventoryApi.approveSlip(slipId),
    onSuccess: () => {
      invalidate();
      toast.success("Slip approved — stock updated");
    },
    onError: (e) => toast.error(inventoryErrorMessage(e, "Approve failed")),
  });
}

export function useRejectSlip() {
  const invalidate = useInventoryInvalidate();
  return useMutation({
    mutationFn: (slipId: string) => inventoryApi.rejectSlip(slipId),
    onSuccess: () => {
      invalidate();
      toast.success("Slip rejected");
    },
    onError: (e) => toast.error(inventoryErrorMessage(e, "Reject failed")),
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

export function useAdminApproveSlip() {
  const invalidate = useInventoryInvalidate();
  return useMutation({
    mutationFn: (slipId: string) => adminInventoryApi.approveSlip(slipId),
    onSuccess: () => {
      invalidate();
      toast.success("Slip approved — stock updated");
    },
    onError: (e) => toast.error(inventoryErrorMessage(e, "Approve failed")),
  });
}

export function useAdminRejectSlip() {
  const invalidate = useInventoryInvalidate();
  return useMutation({
    mutationFn: (slipId: string) => adminInventoryApi.rejectSlip(slipId),
    onSuccess: () => {
      invalidate();
      toast.success("Slip rejected");
    },
    onError: (e) => toast.error(inventoryErrorMessage(e, "Reject failed")),
  });
}

export type { InventorySlipStatus };
