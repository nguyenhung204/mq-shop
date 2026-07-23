"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { catalogApi, cmsApi, sellerApi, shopApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
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
};

export type MarketingMaterial = { folderPath?: string; fileName?: string; fileUrl?: string };

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
      case "FILE_TOO_LARGE":
        return "Each image must be ≤ 5MB.";
      case "SHOP_NOT_ELIGIBLE":
        return "Shop must be APPROVED and not suspended.";
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
        return "Shop must be APPROVED and not suspended.";
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
    onError: (e) => toast.error(productImageErrorMessage(e, "Image upload failed")),
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
    onError: (e) => toast.error(productImageErrorMessage(e, "Remove images failed")),
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
      toast.success("SKU images uploaded");
    },
    onError: (e) => toast.error(productImageErrorMessage(e, "SKU image upload failed")),
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
      toast.success("SKU image removed");
    },
    onError: (e) => toast.error(productImageErrorMessage(e, "Remove SKU images failed")),
  });
}

export function useCreateSellerProduct() {
  const invalidate = useSellerInvalidate();
  return useMutation({
    mutationFn: (body: CreateProductRequest) => sellerApi.createProduct(body),
    onSuccess: () => {
      invalidate();
      toast.success("Product created — Pending review");
    },
    onError: (e) => toast.error(productErrorMessage(e, "Create failed")),
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
      toast.success("Product updated");
    },
    onError: (e) => toast.error(productErrorMessage(e, "Update failed")),
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
      if (!vars.silent) toast.success("SKU added");
    },
    onError: (e) => toast.error(productErrorMessage(e, "Add SKU failed")),
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
      if (!vars.silent) toast.success("SKU updated");
    },
    onError: (e) => toast.error(productErrorMessage(e, "Update SKU failed")),
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

function shopMediaErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof ApiError) {
    switch (e.code) {
      case "INVALID_SHOP_LOGO":
      case "INVALID_SHOP_BANNER":
      case "INVALID_SHOP_IMAGE":
        return "Invalid image type. Use JPEG, PNG, WebP, or GIF.";
      case "SHOP_LOGO_TOO_LARGE":
      case "SHOP_BANNER_TOO_LARGE":
      case "SHOP_IMAGE_TOO_LARGE":
        return "Image must be ≤ 5MB.";
      case "SHOP_NOT_ELIGIBLE":
        return "Shop must be APPROVED and not suspended.";
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
      toast.success("Logo updated");
    },
    onError: (e) => toast.error(shopMediaErrorMessage(e, "Logo upload failed")),
  });
}

export function useUploadShopBanner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => shopApi.uploadBanner(file),
    onSuccess: (shop: ApiShop) => {
      queryClient.setQueryData(sellerKeys.shop(), shop);
      toast.success("Banner updated");
    },
    onError: (e) => toast.error(shopMediaErrorMessage(e, "Banner upload failed")),
  });
}

export function useDownloadMaterials() {
  return useMutation({
    mutationFn: (folder: string) => cmsApi.downloadMaterials(folder),
    onSuccess: () => toast.success("Download info loaded"),
    onError: (e) => toast.error(getErrorMessage(e, "Download failed")),
  });
}
