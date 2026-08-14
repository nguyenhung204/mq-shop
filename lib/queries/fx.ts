"use client";

import { useQuery } from "@tanstack/react-query";
import { fxApi } from "@/lib/api/fx";

export const fxKeys = {
  all: ["fx"] as const,
  rates: (base = "TWD") => [...fxKeys.all, "rates", base] as const,
};

/** Public display FX (TWD base). `rates.USD` = TWD → USD. */
export function useFxRates(base = "TWD") {
  return useQuery({
    queryKey: fxKeys.rates(base),
    queryFn: () => fxApi.getRates(base),
    staleTime: 60_000,
  });
}
