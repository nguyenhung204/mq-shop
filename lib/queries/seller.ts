"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { catalogApi, cmsApi, inventoryApi, sellerApi, shopApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import type { ApiCategory, ApiOrder, ApiProduct, ApiRma, ApiShop, PageMeta } from "@/lib/api/types";
import { asArray, parsePage } from "@/lib/api/utils";
import { getErrorMessage } from "@/lib/queries/utils";

export const sellerKeys = {
  all: ["seller"] as const,
  products: (status: string, page: number) =>
    [...sellerKeys.all, "products", status, page] as const,
  categories: () => [...sellerKeys.all, "categories"] as const,
  orders: () => [...sellerKeys.all, "orders"] as const,
  rma: () => [...sellerKeys.all, "rma"] as const,
  warehouses: () => [...sellerKeys.all, "warehouses"] as const,
  inventory: () => [...sellerKeys.all, "inventory"] as const,
  inventoryPending: () => [...sellerKeys.all, "inventory-pending"] as const,
  shop: () => [...sellerKeys.all, "shop"] as const,
  materials: () => [...sellerKeys.all, "materials"] as const,
};

export type Warehouse = { id: string; name: string; addressText?: string };
export type InvReq = { id: string; sku: string; quantity: number; requestType: string; status: string };
export type MarketingMaterial = { folderPath?: string; fileName?: string; fileUrl?: string };

function useSellerInvalidate() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: sellerKeys.all });
}

export function useSellerProducts(status?: string, page = 1, pageSize = 20) {
  const statusKey = status || "";
  return useQuery({
    queryKey: sellerKeys.products(statusKey, page),
    queryFn: async (): Promise<{ items: ApiProduct[]; meta?: PageMeta }> =>
      parsePage<ApiProduct>(
        await sellerApi.products({
          status: status || undefined,
          page,
          pageSize,
        }),
      ),
  });
}

export function useCategories() {
  return useQuery({
    queryKey: sellerKeys.categories(),
    queryFn: async () => asArray<ApiCategory>(await catalogApi.categories()),
    staleTime: 5 * 60_000,
  });
}

export function useSellerOrders() {
  return useQuery({
    queryKey: sellerKeys.orders(),
    queryFn: async () => asArray<ApiOrder>(await sellerApi.orders()),
  });
}

export function useSellerRma() {
  return useQuery({
    queryKey: sellerKeys.rma(),
    queryFn: async () => asArray<ApiRma>(await sellerApi.rma()),
  });
}

export function useWarehouses() {
  return useQuery({
    queryKey: sellerKeys.warehouses(),
    queryFn: async () => asArray<Warehouse>(await inventoryApi.warehouses()),
  });
}

export function useSellerInventory() {
  return useQuery({
    queryKey: sellerKeys.inventory(),
    queryFn: async () => {
      const [warehouses, inventory, pending] = await Promise.all([
        inventoryApi.warehouses(),
        inventoryApi.list(),
        sellerApi.inventoryRequests("PENDING"),
      ]);
      return {
        warehouses: asArray<Warehouse>(warehouses),
        inventory: asArray(inventory),
        pending: asArray<InvReq>(pending),
      };
    },
  });
}

export function useSellerShop() {
  return useQuery({
    queryKey: sellerKeys.shop(),
    queryFn: async () => {
      try {
        return await shopApi.me();
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return null;
        throw e;
      }
    },
    retry: (count, e) => !(e instanceof ApiError && e.status === 404) && count < 1,
  });
}

export function useMarketingMaterials() {
  return useQuery({
    queryKey: sellerKeys.materials(),
    queryFn: async () => asArray<MarketingMaterial>(await cmsApi.materials()),
  });
}

function productImageErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof ApiError) {
    switch (e.code) {
      case "INVALID_PRODUCT_IMAGE":
        return "Invalid image type. Use JPEG, PNG, WebP, or GIF.";
      case "PRODUCT_IMAGE_TOO_LARGE":
        return "Each image must be ≤ 5MB.";
      case "SHOP_NOT_ELIGIBLE":
        return "Shop must be APPROVED and not suspended.";
      default:
        break;
    }
  }
  return getErrorMessage(e, fallback);
}

export function useUploadProductImages() {
  return useMutation({
    mutationFn: (files: File[]) => sellerApi.uploadImages(files),
    onError: (e) => toast.error(productImageErrorMessage(e, "Image upload failed")),
  });
}

export function useCreateSellerProduct() {
  const invalidate = useSellerInvalidate();
  return useMutation({
    mutationFn: (body: unknown) => sellerApi.createProduct(body),
    onSuccess: () => {
      invalidate();
      toast.success("Product created (PENDING)");
    },
    onError: (e) => toast.error(getErrorMessage(e, "Create failed")),
  });
}

export function useUpdateSellerProduct() {
  const invalidate = useSellerInvalidate();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: unknown }) =>
      sellerApi.updateProduct(id, body),
    onSuccess: () => {
      invalidate();
      toast.success("Product updated");
    },
    onError: (e) => toast.error(getErrorMessage(e, "Update failed")),
  });
}

export function useHideSellerProduct() {
  const invalidate = useSellerInvalidate();
  return useMutation({
    mutationFn: (id: string) => sellerApi.hideProduct(id),
    onSuccess: () => {
      invalidate();
      toast.success("Product hidden");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}

export function useUnhideSellerProduct() {
  const invalidate = useSellerInvalidate();
  return useMutation({
    mutationFn: (id: string) => sellerApi.unhideProduct(id),
    onSuccess: () => {
      invalidate();
      toast.success("Product unhidden — pending review");
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === "PRODUCT_NOT_HIDDEN") {
        toast.error("Product is not hidden.");
        return;
      }
      toast.error(getErrorMessage(e));
    },
  });
}

export function useConfirmStockReturn() {
  const invalidate = useSellerInvalidate();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: {
        warehouseId: string;
        sku: string;
        quantity: number;
        kind: "RETURNED" | "NEW";
        note?: string;
      };
    }) => sellerApi.confirmStockReturn(id, body),
    onSuccess: () => {
      invalidate();
      toast.success("Stock return confirmed");
    },
    onError: (e) => toast.error(getErrorMessage(e, "Confirm failed")),
  });
}

export function useCreateWarehouse() {
  const invalidate = useSellerInvalidate();
  return useMutation({
    mutationFn: (body: { name: string; addressText: string }) =>
      inventoryApi.createWarehouse(body),
    onSuccess: () => {
      invalidate();
      toast.success("Warehouse created");
    },
    onError: (e) => toast.error(getErrorMessage(e, "Create warehouse failed")),
  });
}

export function useCreateInventoryRequest() {
  const invalidate = useSellerInvalidate();
  return useMutation({
    mutationFn: (body: {
      warehouseId: string;
      sku: string;
      quantity: number;
      requestType: "IN" | "ADJUST_IN" | "ADJUST_OUT";
      reason?: string;
    }) => inventoryApi.createRequest(body),
    onSuccess: () => {
      invalidate();
      toast.success("Stock request created");
    },
    onError: (e) => toast.error(getErrorMessage(e, "Request failed")),
  });
}

export function useApproveInventory() {
  const invalidate = useSellerInvalidate();
  return useMutation({
    mutationFn: (id: string) => sellerApi.approveInventory(id),
    onSuccess: () => {
      invalidate();
      toast.success("Request approved");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}

export function useRejectInventory() {
  const invalidate = useSellerInvalidate();
  return useMutation({
    mutationFn: (id: string) => sellerApi.rejectInventory(id, { reason: "Rejected by seller" }),
    onSuccess: () => {
      invalidate();
      toast.success("Request rejected");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}

export function useApplyShop() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) => shopApi.apply(formData),
    onSuccess: (shop: ApiShop) => {
      queryClient.setQueryData(sellerKeys.shop(), shop);
      toast.success("Application submitted. Waiting for Admin approval.");
    },
    onError: (e) => toast.error(getErrorMessage(e, "Apply failed")),
  });
}

export function useDownloadMaterials() {
  return useMutation({
    mutationFn: (folder: string) => cmsApi.downloadMaterials(folder),
    onSuccess: () => toast.success("Download info loaded"),
    onError: (e) => toast.error(getErrorMessage(e, "Download failed")),
  });
}
