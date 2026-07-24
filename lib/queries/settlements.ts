"use client";

import { useQuery } from "@tanstack/react-query";
import {
  adminSettlementApi,
  settlementApi,
  type AdminListSettlementsParams,
  type ListSettlementsParams,
} from "@/lib/api/settlements";

export const settlementKeys = {
  all: ["settlements"] as const,
  seller: (params: ListSettlementsParams) =>
    [
      ...settlementKeys.all,
      "seller",
      params.status ?? "PENDING_RECONCILE",
      params.page ?? 1,
      params.pageSize ?? 20,
    ] as const,
  admin: (params: AdminListSettlementsParams) =>
    [
      ...settlementKeys.all,
      "admin",
      params.shopId ?? "",
      params.status ?? "PENDING_RECONCILE",
      params.page ?? 1,
      params.pageSize ?? 20,
    ] as const,
};

export function useSellerSettlements(params: ListSettlementsParams = {}) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const status = params.status ?? "PENDING_RECONCILE";
  return useQuery({
    queryKey: settlementKeys.seller({ status, page, pageSize }),
    queryFn: () => settlementApi.list({ status, page, pageSize }),
  });
}

export function useAdminSettlements(
  params: AdminListSettlementsParams = {},
  options?: { enabled?: boolean },
) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const status = params.status ?? "PENDING_RECONCILE";
  const shopId = params.shopId;
  return useQuery({
    queryKey: settlementKeys.admin({ status, shopId, page, pageSize }),
    queryFn: () => adminSettlementApi.list({ status, shopId, page, pageSize }),
    enabled: options?.enabled ?? true,
  });
}
