"use client";

import { useMemo } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { dividendCreditsApi, dividendSettlementsApi, type ItemStatus } from "@/lib/api/dividend-settlements";
import { createKeyedRunners } from "@/lib/queries/idempotent-run";
import { tt } from "@/lib/i18n/tt";
import { getErrorMessage } from "@/lib/queries/utils";

/** One Idempotency-Key lifecycle per quarter run. */
export const settlementRunOpKey = (quarter: string) => `${quarter}:run`;

export const settlementKeys = {
  all: ["dividend-settlements"] as const,
  list: (page: number) => [...settlementKeys.all, "list", page] as const,
  detail: (q: string, page: number, status: string) => [...settlementKeys.all, "detail", q, page, status] as const,
  credits: (page: number) => [...settlementKeys.all, "credits", page] as const,
  credit: (id: string) => [...settlementKeys.all, "credit", id] as const,
};

const PAGE = 20;

export function useDividendSettlements(page: number, enabled = true) {
  return useQuery({
    queryKey: settlementKeys.list(page),
    queryFn: () => dividendSettlementsApi.list({ page, pageSize: PAGE }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useSettlementDetail(quarter: string, page: number, status: ItemStatus | "") {
  return useQuery({
    queryKey: settlementKeys.detail(quarter, page, status),
    queryFn: () => dividendSettlementsApi.detail(quarter, { page, pageSize: 50, status: status || undefined }),
    placeholderData: keepPreviousData,
    enabled: Boolean(quarter),
  });
}

/** SUPER_ADMIN run-now. One Idempotency-Key lifecycle per quarter; the run is synchronous (the request can be long). */
export function useRunSettlement() {
  const queryClient = useQueryClient();
  const runners = useMemo(() => createKeyedRunners(), []);
  return useMutation({
    mutationFn: (quarter: string) => runners.forKey(settlementRunOpKey(quarter)).run(quarter, (q, key) => dividendSettlementsApi.run(q, key)),
    onSuccess: (_d, quarter) => {
      runners.forKey(settlementRunOpKey(quarter)).onSuccess();
      void queryClient.invalidateQueries({ queryKey: settlementKeys.all });
    },
    onError: (e, quarter) => {
      runners.forKey(settlementRunOpKey(quarter)).onError(e);
      void queryClient.invalidateQueries({ queryKey: settlementKeys.all });
      toast.error(getErrorMessage(e, tt("admin.common.failed")));
    },
  });
}

export function useMyDividendCredits(page: number) {
  return useQuery({
    queryKey: settlementKeys.credits(page),
    queryFn: () => dividendCreditsApi.list({ page, pageSize: PAGE }),
    placeholderData: keepPreviousData,
  });
}

export function useMyDividendCredit(id: string) {
  return useQuery({ queryKey: settlementKeys.credit(id), queryFn: () => dividendCreditsApi.get(id), enabled: Boolean(id) });
}
