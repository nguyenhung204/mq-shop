"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fxApi, type FxRatesResponse } from "@/lib/api/fx";
import { FX_FALLBACK_RATES } from "@/lib/fx/constants";

const FX_QUERY_KEY = ["fx", "rates"] as const;

export function useFxRates() {
  const query = useQuery({
    queryKey: FX_QUERY_KEY,
    queryFn: () => fxApi.getRates("TWD"),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: 1,
  });

  const isFallback = !query.data;
  const data: FxRatesResponse = query.data ?? {
    base: "TWD",
    asOf: "",
    source: "fallback",
    rates: FX_FALLBACK_RATES,
    updatedBy: null,
  };

  return {
    ...query,
    rates: data.rates,
    asOf: data.asOf,
    source: data.source,
    isFallback,
    isRatesReady: Boolean(query.data?.asOf),
  };
}

export function useInvalidateFxRates() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: FX_QUERY_KEY });
}
