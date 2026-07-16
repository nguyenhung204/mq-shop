"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orderApi } from "@/lib/api";
import type { ApiOrder, ApiRma } from "@/lib/api/types";
import { asArray } from "@/lib/api/utils";

export const orderKeys = {
  all: ["orders"] as const,
  mine: () => [...orderKeys.all, "me"] as const,
  detail: (id: string) => [...orderKeys.all, id] as const,
  rma: () => [...orderKeys.all, "rma"] as const,
};

export function useMyOrders() {
  return useQuery({
    queryKey: orderKeys.mine(),
    queryFn: async () => asArray<ApiOrder>(await orderApi.myOrders()),
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: orderKeys.detail(id),
    queryFn: () => orderApi.get(id),
    enabled: Boolean(id),
  });
}

export function useMyRma() {
  return useQuery({
    queryKey: orderKeys.rma(),
    queryFn: async () => asArray<ApiRma>(await orderApi.myRma()),
  });
}

export function useCancelOrder(orderId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reason: string) => orderApi.cancel(orderId, { reason }),
    onSuccess: (order: ApiOrder) => {
      queryClient.setQueryData(orderKeys.detail(orderId), order);
      void queryClient.invalidateQueries({ queryKey: orderKeys.mine() });
    },
  });
}

export function useWithdrawRma() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => orderApi.withdrawRma(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orderKeys.rma() });
    },
  });
}
