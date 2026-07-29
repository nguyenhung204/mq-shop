"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { catalogApi, cmsApi, sellerApi, sellerDashboardApi, shopApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import type { RevenueChartRange, TopProductsRange } from "@/lib/api/seller-dashboard";
import type {
  AddProductVariantRequest,
  ApiCategory,
  ApiProduct,
  ApiShop,
  CreateProductRequest,
  PageMeta,
  UpdateProductRequest,
  UpdateProductVariantRequest,
} from "@/lib/api/types";
import { asArray, parsePage } from "@/lib/api/utils";
import { tt } from "@/lib/i18n/tt";
import { getErrorMessage } from "@/lib/queries/utils";
import { useOrders } from "@/lib/queries/orders";

export { useWarehouses } from "@/lib/queries/inventory";

export const sellerKeys = {
  all: ["seller"] as const,
  products: (status: string, page: number, pageSize = 20) =>
    [...sellerKeys.all, "products", status, page, pageSize] as const,
  product: (id: string) => [...sellerKeys.all, "product", id] as const,
  categories: () => [...sellerKeys.all, "categories"] as const,
  shop: () => [...sellerKeys.all, "shop"] as const,
  materials: () => [...sellerKeys.all, "materials"] as const,
  dashboard: (threshold?: number) =>
    [...sellerKeys.all, "dashboard", threshold] as const,
  revenueChart: (range?: string, compare?: boolean) =>
    [...sellerKeys.all, "revenueChart", range, compare] as const,
  topProducts: (range?: string, limit?: number) =>
    [...sellerKeys.all, "topProducts", range, limit] as const,
};

export type MarketingMaterialFolder = {
  id: string;
  name: string;
  description: string | null;
  assetCount: number;
};

export function useMarketingMaterials(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: [...sellerKeys.materials(), page, pageSize] as const,
    queryFn: async () =>
      parsePage<import("@/lib/api/promotions").MarketingFolder>(
        await cmsApi.folders({ page, pageSize }),
      ),
  });
}

export function useSellerDashboard(lowStockThreshold?: number) {
  return useQuery({
    queryKey: sellerKeys.dashboard(lowStockThreshold),
    queryFn: () =>
      sellerDashboardApi.get({
        sections: ["summary", "lowStock"],
        lowStockThreshold,
      }),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}

export function useSellerRevenueChart(
  range?: RevenueChartRange,
  comparePrevious = false,
) {
  return useQuery({
    queryKey: sellerKeys.revenueChart(range, comparePrevious),
    queryFn: () => sellerDashboardApi.revenueChart({ range, comparePrevious }),
    staleTime: 5 * 60_000,
  });
}

export function useSellerTopProducts(range?: TopProductsRange, limit = 10) {
  return useQuery({
    queryKey: sellerKeys.topProducts(range, limit),
    queryFn: () => sellerDashboardApi.topProducts({ range, limit }),
    staleTime: 5 * 60_000,
  });
}

function useSellerInvalidate() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: sellerKeys.all });
}

export function useSellerProducts(status?: string, page = 1, pageSize = 20) {
  const statusKey = status || "";
  return useQuery({
    queryKey: sellerKeys.products(statusKey, page, pageSize),
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

export function useSellerOrders(params: {
  status?: import("@/lib/api/orders").OrderStatus;
  page?: number;
  pageSize?: number;
} = {}) {
  return useOrders({
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 20,
    status: params.status,
    view: "shop",
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

function productImageErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof ApiError) {
    switch (e.code) {
      case "INVALID_PRODUCT_IMAGE":
        return tt("toast.invalidProductImage");
      case "PRODUCT_IMAGE_TOO_LARGE":
      case "FILE_TOO_LARGE":
        return tt("toast.productImageTooLarge");
      case "SHOP_NOT_ELIGIBLE":
        return tt("toast.shopNotEligible");
      default:
        break;
    }
  }
  return getErrorMessage(e, fallback);
}

function productErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof ApiError) {
    switch (e.code) {
      case "SHOP_NOT_ELIGIBLE":
        return tt("toast.shopNotEligible");
      case "CATEGORY_NOT_FOUND":
        return "Category not found.";
      case "VARIANT_SKU_TAKEN":
        return "SKU already exists in this shop.";
      case "PRODUCT_NOT_FOUND":
        return "Product not found.";
      case "FORBIDDEN":
        return "You do not have permission for this action.";
      default:
        break;
    }
  }
  return productImageErrorMessage(e, fallback);
}

export function useUploadProductImages() {
  const invalidate = useSellerInvalidate();
  return useMutation({
    mutationFn: ({ productId, files }: { productId: string; files: File[] }) =>
      sellerApi.uploadProductImages(productId, files),
    onSuccess: () => {
      invalidate();
    },
  });
}

export function useDeleteProductImages() {
  const invalidate = useSellerInvalidate();
  return useMutation({
    mutationFn: ({ productId, urls }: { productId: string; urls: string[] }) =>
      sellerApi.deleteProductImages(productId, urls),
    onSuccess: () => {
      invalidate();
    },
  });
}

export function useUploadVariantImages() {
  const invalidate = useSellerInvalidate();
  return useMutation({
    mutationFn: ({
      productId,
      variantId,
      files,
    }: {
      productId: string;
      variantId: string;
      files: File[];
    }) => sellerApi.uploadVariantImages(productId, variantId, files),
    onSuccess: () => {
      invalidate();
      toast.success(tt("toast.skuImagesUploaded"));
    },
  });
}

export function useDeleteVariantImages() {
  const invalidate = useSellerInvalidate();
  return useMutation({
    mutationFn: ({
      productId,
      variantId,
      urls,
    }: {
      productId: string;
      variantId: string;
      urls: string[];
    }) => sellerApi.deleteVariantImages(productId, variantId, urls),
    onSuccess: () => {
      invalidate();
      toast.success(tt("toast.skuImageRemoved"));
    },
  });
}

export function useCreateSellerProduct() {
  const invalidate = useSellerInvalidate();
  return useMutation({
    mutationFn: (body: CreateProductRequest) => sellerApi.createProduct(body),
    onSuccess: () => {
      invalidate();
      toast.success(tt("toast.productCreatedPending"));
    },
  });
}

export function useUpdateSellerProduct() {
  const invalidate = useSellerInvalidate();
  return useMutation({
    mutationFn: ({
      id,
      body,
      silent,
    }: {
      id: string;
      body: UpdateProductRequest;
      silent?: boolean;
    }) => sellerApi.updateProduct(id, body),
    onSuccess: (_product, vars) => {
      invalidate();
      if (vars.silent) return;
      toast.success(tt("toast.productUpdated"));
    },
  });
}

export function useAddSellerVariant() {
  const invalidate = useSellerInvalidate();
  return useMutation({
    mutationFn: ({
      productId,
      body,
      silent,
    }: {
      productId: string;
      body: AddProductVariantRequest;
      silent?: boolean;
    }) => sellerApi.addVariant(productId, body),
    onSuccess: (_data, vars) => {
      invalidate();
      if (!vars.silent) toast.success(tt("toast.skuAdded"));
    },
  });
}

export function useUpdateSellerVariant() {
  const invalidate = useSellerInvalidate();
  return useMutation({
    mutationFn: ({
      productId,
      variantId,
      body,
      silent,
    }: {
      productId: string;
      variantId: string;
      body: UpdateProductVariantRequest;
      silent?: boolean;
    }) => sellerApi.updateVariant(productId, variantId, body),
    onSuccess: (_data, vars) => {
      invalidate();
      if (!vars.silent) toast.success(tt("toast.skuUpdated"));
    },
  });
}

export function useHideSellerProduct() {
  const invalidate = useSellerInvalidate();
  return useMutation({
    mutationFn: (id: string) => sellerApi.hideProduct(id),
    onSuccess: () => {
      invalidate();
      toast.success(tt("toast.productHidden"));
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
      toast.success(tt("toast.productUnhidden"));
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === "PRODUCT_NOT_HIDDEN") {
        toast.error(tt("toast.productNotHidden"));
        return;
      }
      toast.error(getErrorMessage(e));
    },
  });
}

export function useApplyShop() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) => shopApi.apply(formData),
    onSuccess: (shop: ApiShop) => {
      queryClient.setQueryData(sellerKeys.shop(), shop);
      toast.success(tt("toast.applicationSubmitted"));
    },
  });
}

function shopMediaErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof ApiError) {
    switch (e.code) {
      case "INVALID_SHOP_LOGO":
      case "INVALID_SHOP_BANNER":
      case "INVALID_SHOP_IMAGE":
        return tt("toast.invalidImageType");
      case "SHOP_LOGO_TOO_LARGE":
      case "SHOP_BANNER_TOO_LARGE":
      case "SHOP_IMAGE_TOO_LARGE":
        return tt("toast.imageTooLarge");
      case "SHOP_NOT_ELIGIBLE":
        return tt("toast.shopNotEligible");
      case "FORBIDDEN":
        return "You do not have permission to edit this shop.";
      default:
        break;
    }
  }
  return getErrorMessage(e, fallback);
}

export function useUploadShopLogo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => shopApi.uploadLogo(file),
    onSuccess: (shop: ApiShop) => {
      queryClient.setQueryData(sellerKeys.shop(), shop);
      toast.success(tt("toast.logoUpdated"));
    },
  });
}

export function useUploadShopBanner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => shopApi.uploadBanner(file),
    onSuccess: (shop: ApiShop) => {
      queryClient.setQueryData(sellerKeys.shop(), shop);
      toast.success(tt("toast.shopBannerUpdated"));
    },
  });
}

/** @deprecated Prefer `useDownloadMarketingFolder` from `@/lib/queries/promotions`. */
export function useDownloadMaterials() {
  return useMutation({
    mutationFn: async (folderId: string) => {
      const blob = await cmsApi.downloadFolderZip(folderId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `marketing-${folderId}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      return folderId;
    },
    onSuccess: () => toast.success(tt("toast.downloadStarted")),
    onError: (e) => toast.error(getErrorMessage(e, tt("toast.downloadFailed"))),
  });
}
