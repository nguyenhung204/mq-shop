"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/client";
import { createIdempotencyKeyStore } from "@/lib/api/idempotency";
import {
  adminDividendApi,
  type CreateDividendRateBody,
  type SetSlotsBody,
  type TransferSlotsBody,
} from "@/lib/api/dividend";
import { tt } from "@/lib/i18n/tt";
import { getErrorMessage } from "@/lib/queries/utils";

export const dividendKeys = {
  all: ["admin-dividend"] as const,
  rates: () => [...dividendKeys.all, "rates"] as const,
  slots: (quarter: string) => [...dividendKeys.all, "slots", quarter] as const,
  slotHistory: (userId: string) => [...dividendKeys.all, "slot-history", userId] as const,
  report: (quarter: string) => [...dividendKeys.all, "report", quarter] as const,
};

export function useDividendRates() {
  return useQuery({ queryKey: dividendKeys.rates(), queryFn: () => adminDividendApi.rates() });
}

export function useDividendSlots(quarter: string | undefined) {
  return useQuery({
    queryKey: dividendKeys.slots(quarter ?? ""),
    queryFn: () => adminDividendApi.slots(quarter),
  });
}

export function useSlotHistory(userId: string) {
  return useQuery({
    queryKey: dividendKeys.slotHistory(userId),
    queryFn: async () =>
      (await adminDividendApi.slotHistory({ userId: userId || undefined, limit: 100 })).items ?? [],
  });
}

export function useDividendReport(quarter: string | undefined) {
  return useQuery({
    queryKey: dividendKeys.report(quarter ?? ""),
    queryFn: () => adminDividendApi.report(quarter!),
    enabled: Boolean(quarter),
  });
}

/** Shared onError: reset the key on a mismatch, show the translated API error. */
function useDividendMutation<V, R>(
  run: (vars: V, key: string) => Promise<R>,
  successToast: string,
  invalidate: (qc: ReturnType<typeof useQueryClient>) => void,
) {
  const queryClient = useQueryClient();
  const idempotency = useMemo(() => createIdempotencyKeyStore(), []);
  return useMutation({
    mutationFn: (vars: V) => run(vars, idempotency.keyFor(vars)),
    onSuccess: () => {
      // The write is done: an identical later submit is a new operation and needs a new key.
      idempotency.invalidate();
      invalidate(queryClient);
      toast.success(tt(successToast));
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === "IDEMPOTENCY_KEY_REUSE_MISMATCH") idempotency.invalidate();
      toast.error(getErrorMessage(e, tt("admin.common.failed")));
    },
  });
}

export function useCreateDividendRate() {
  return useDividendMutation(
    (body: CreateDividendRateBody, key) => adminDividendApi.createRate(body, key),
    "admin.dividend.rates.created",
    (qc) => void qc.invalidateQueries({ queryKey: dividendKeys.all }),
  );
}

export function useSetSlots() {
  return useDividendMutation(
    (body: SetSlotsBody, key) => adminDividendApi.setSlots(body, key),
    "admin.dividend.slots.saved",
    (qc) => void qc.invalidateQueries({ queryKey: dividendKeys.all }),
  );
}

export function useTransferSlots() {
  return useDividendMutation(
    (body: TransferSlotsBody, key) => adminDividendApi.transferSlots(body, key),
    "admin.dividend.slots.transferred",
    (qc) => void qc.invalidateQueries({ queryKey: dividendKeys.all }),
  );
}
