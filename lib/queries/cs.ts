"use client";

import { useQuery } from "@tanstack/react-query";
import { csApi } from "@/lib/api";
import { parsePage } from "@/lib/api/utils";
import type { CsCustomerListItem, CsCustomerOrderItem } from "@/lib/api/cs";

export const csKeys = {
  all: ["cs"] as const,
  customers: (q?: string, page?: number) => [...csKeys.all, "customers", q, page] as const,
  customer: (id: string) => [...csKeys.all, "customer", id] as const,
  customerOrders: (id: string, page?: number) =>
    [...csKeys.all, "customerOrders", id, page] as const,
};

export function useCsCustomers(q?: string, page = 1, pageSize = 20) {
  return useQuery({
    queryKey: csKeys.customers(q, page),
    queryFn: async () =>
      parsePage<CsCustomerListItem>(
        await csApi.customers({ q: q || undefined, page, pageSize }),
      ),
    enabled: Boolean(q?.trim()),
  });
}

export function useCsCustomerDetail(userId: string) {
  return useQuery({
    queryKey: csKeys.customer(userId),
    queryFn: () => csApi.customerDetail(userId),
    enabled: Boolean(userId),
  });
}

export function useCsCustomerOrders(userId: string, page = 1, pageSize = 20) {
  return useQuery({
    queryKey: csKeys.customerOrders(userId, page),
    queryFn: async () =>
      parsePage<CsCustomerOrderItem>(
        await csApi.customerOrders(userId, { page, pageSize }),
      ),
    enabled: Boolean(userId),
  });
}
