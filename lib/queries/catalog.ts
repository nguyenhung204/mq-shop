"use client";

import { useQuery } from "@tanstack/react-query";
import { catalogApi } from "@/lib/api";
import { mapListingCard } from "@/lib/api/mapProduct";
import type { ApiCategory, PageMeta, ShopStorefront } from "@/lib/api/types";
import type { Product } from "@/lib/data/products";
import { asArray } from "@/lib/api/utils";

export type CatalogListingParams = {
  q?: string;
  categoryId?: string;
  shopId?: string;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  pageSize?: number;
};

export const catalogKeys = {
  all: ["catalog"] as const,
  categories: () => [...catalogKeys.all, "categories"] as const,
  listing: (params: CatalogListingParams) =>
    [
      ...catalogKeys.all,
      "listing",
      params.q ?? "",
      params.categoryId ?? "",
      params.shopId ?? "",
      params.minPrice ?? "",
      params.maxPrice ?? "",
      params.page ?? 1,
      params.pageSize ?? 20,
    ] as const,
  shopStorefront: (shopId: string) =>
    [...catalogKeys.all, "shop-storefront", shopId] as const,
};

export function useCatalogCategories() {
  return useQuery({
    queryKey: catalogKeys.categories(),
    queryFn: async () => asArray<ApiCategory>(await catalogApi.categories()),
    staleTime: 5 * 60_000,
  });
}

/** Flat product list (header mega menu, etc.). */
export function useCatalogListing(
  params: CatalogListingParams & { enabled?: boolean } = {},
) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 12;
  const { q, categoryId, shopId, minPrice, maxPrice } = params;
  return useQuery({
    queryKey: catalogKeys.listing({
      q,
      categoryId,
      shopId,
      minPrice,
      maxPrice,
      page,
      pageSize,
    }),
    queryFn: async (): Promise<Product[]> => {
      const res = await catalogApi.listing({
        q,
        categoryId,
        shopId,
        minPrice,
        maxPrice,
        page,
        pageSize,
      });
      return res.items.map((p) => mapListingCard(p, categoryId || "all"));
    },
    enabled: params.enabled !== false,
    staleTime: 60_000,
  });
}

/** Paginated listing for shop storefront / catalog pages. */
export function useCatalogListingPage(
  params: CatalogListingParams & { enabled?: boolean } = {},
) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 24;
  const { q, categoryId, shopId, minPrice, maxPrice } = params;
  return useQuery({
    queryKey: [
      ...catalogKeys.listing({
        q,
        categoryId,
        shopId,
        minPrice,
        maxPrice,
        page,
        pageSize,
      }),
      "page",
    ],
    queryFn: async (): Promise<{ items: Product[]; meta?: PageMeta }> => {
      const res = await catalogApi.listing({
        q,
        categoryId,
        shopId,
        minPrice,
        maxPrice,
        page,
        pageSize,
      });
      return {
        items: res.items.map((p) => mapListingCard(p, categoryId || "all")),
        meta: res.meta,
      };
    },
    enabled: params.enabled !== false,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
}

export function useShopStorefront(shopId: string | undefined) {
  return useQuery({
    queryKey: catalogKeys.shopStorefront(shopId ?? ""),
    queryFn: (): Promise<ShopStorefront> => catalogApi.shopStorefront(shopId!),
    enabled: Boolean(shopId),
    staleTime: 5 * 60_000,
  });
}

/** Root categories first, then orphans treated as roots. */
export function rootCategories(cats: ApiCategory[]): ApiCategory[] {
  const roots = cats.filter((c) => !c.parentId);
  return roots.length ? roots : cats;
}

export function childCategories(
  cats: ApiCategory[],
  parentId: string,
): ApiCategory[] {
  return cats.filter((c) => c.parentId === parentId);
}
