"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { useRegion } from "@/components/providers/RegionProvider";
import {
  convertFromTwd,
  formatMoneyDisplay,
  formatMoneyForCurrency,
} from "@/lib/fx/convert";
import { useFxRates } from "@/lib/fx/useFxRates";

type DisplayMoneyContextValue = {
  currency: string;
  rates: Record<string, number>;
  asOf: string;
  /** True when GET /fx/rates failed and static fallback rates are in use. */
  isFallback: boolean;
  /** True when live rates loaded with a non-empty asOf timestamp. */
  isRatesReady: boolean;
  convert: (amountTwd: number) => number;
  formatDisplay: (amountTwd: number) => string;
  formatLedger: (amountTwd: number) => string;
  /** Refetch public FX rates (e.g. before checkout). Returns fresh payload. */
  refetchRates: () => Promise<{ asOf: string; rates: Record<string, number> }>;
};

const DisplayMoneyContext = createContext<DisplayMoneyContextValue | null>(null);

export function DisplayMoneyProvider({ children }: { children: ReactNode }) {
  const { currentRegion } = useRegion();
  const { rates, asOf, refetch, isFallback, isRatesReady } = useFxRates();
  const { locale } = useLanguage();

  const currency = currentRegion?.currency ?? "TWD";
  const intlLocale =
    locale === "zh-TW" ? "zh-TW" : locale === "vi" ? "vi-VN" : "en-US";

  const convert = useCallback(
    (amountTwd: number) => convertFromTwd(amountTwd, currency, rates),
    [currency, rates],
  );

  const formatDisplay = useCallback(
    (amountTwd: number) =>
      formatMoneyDisplay(amountTwd, currency, rates, intlLocale),
    [currency, rates, intlLocale],
  );

  const formatLedger = useCallback(
    (amountTwd: number) => formatMoneyForCurrency(amountTwd, "TWD", intlLocale),
    [intlLocale],
  );

  const refetchRates = useCallback(async () => {
    const result = await refetch();
    const data = result.data;
    return {
      asOf: data?.asOf ?? asOf,
      rates: data?.rates ?? rates,
    };
  }, [refetch, asOf, rates]);

  const value = useMemo(
    () => ({
      currency,
      rates,
      asOf,
      isFallback,
      isRatesReady,
      convert,
      formatDisplay,
      formatLedger,
      refetchRates,
    }),
    [
      currency,
      rates,
      asOf,
      isFallback,
      isRatesReady,
      convert,
      formatDisplay,
      formatLedger,
      refetchRates,
    ],
  );

  return (
    <DisplayMoneyContext.Provider value={value}>
      {children}
    </DisplayMoneyContext.Provider>
  );
}

export function useDisplayMoney() {
  const ctx = useContext(DisplayMoneyContext);
  if (!ctx) {
    throw new Error("useDisplayMoney must be used within DisplayMoneyProvider");
  }
  return ctx;
}

export function useDisplayMoneyOptional() {
  return useContext(DisplayMoneyContext);
}
