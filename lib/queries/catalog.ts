"use client";

import { useQuery } from "@tanstack/react-query";
import { catalogApi } from "@/lib/api";
import { mapListingCard } from "@/lib/api/mapProduct";
import type { ApiCategory } from "@/lib/api/types";
import type { Product } from "@/lib/data/products";
import { asArray } from "@/lib/api/utils";

export const catalogKeys = {
  all: ["catalog"] as const,
  categories: () => [...catalogKeys.all, "categories"] as const,
  listing: (params: {
    q?: string;
    categoryId?: string;
    page?: number;
    pageSize?: number;
  }) =>
    [
      ...catalogKeys.all,
      "listing",
      params.q ?? "",
      params.categoryId ?? "",
      params.page ?? 1,
      params.pageSize ?? 20,
    ] as const,
};

export function useCatalogCategories() {
  return useQuery({
    queryKey: catalogKeys.categories(),
    queryFn: async () => asArray<ApiCategory>(await catalogApi.categories()),
    staleTime: 5 * 60_000,
  });
}

export function useCatalogListing(params: {
  q?: string;
  categoryId?: string;
  page?: number;
  pageSize?: number;
  enabled?: boolean;
} = {}) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 12;
  const categoryId = params.categoryId;
  const q = params.q;
  return useQuery({
    queryKey: catalogKeys.listing({ q, categoryId, page, pageSize }),
    queryFn: async (): Promise<Product[]> => {
      const res = await catalogApi.listing({ q, categoryId, page, pageSize });
      return res.items.map((p) => mapListingCard(p, categoryId || "all"));
    },
    enabled: params.enabled !== false,
    staleTime: 60_000,
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
