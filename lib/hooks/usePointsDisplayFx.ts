"use client";

import { useCallback, useMemo } from "react";
import { useRegion } from "@/components/providers/RegionProvider";
import { useFxRates } from "@/lib/fx/useFxRates";
import {
  convertPointsToDisplay,
  convertPointsToTwd,
  convertTwdToDisplay,
  FX_BASE_CURRENCY,
  formatDisplayMoney,
  formatPointUsdValue,
} from "@/lib/points";

/** Region currency + FX helpers for PTS value notes and withdraw estimates. */
export function usePointsDisplayFx() {
  const { currentRegion } = useRegion();
  const { rates, isRatesReady } = useFxRates();

  const displayCurrency = (
    currentRegion?.currency || FX_BASE_CURRENCY
  ).toUpperCase();
  const rateTwdToUsd = rates?.USD;

  const onePointDisplay = useMemo(() => {
    if (!(typeof rateTwdToUsd === "number" && rateTwdToUsd > 0)) return null;
    return convertPointsToDisplay(1, rateTwdToUsd, displayCurrency, rates);
  }, [rateTwdToUsd, displayCurrency, rates]);

  const onePointTwd = useMemo(() => {
    if (!(typeof rateTwdToUsd === "number" && rateTwdToUsd > 0)) return null;
    return convertPointsToTwd(1, rateTwdToUsd);
  }, [rateTwdToUsd]);

  const estimateWithdraw = useCallback(
    (points: number): { twd: number | null; display: number | null } => {
      if (
        !Number.isFinite(points) ||
        points <= 0 ||
        !(typeof rateTwdToUsd === "number" && rateTwdToUsd > 0)
      ) {
        return { twd: null, display: null };
      }
      const twd = convertPointsToTwd(points, rateTwdToUsd);
      const display = convertTwdToDisplay(twd, displayCurrency, rates);
      return { twd, display };
    },
    [rateTwdToUsd, displayCurrency, rates],
  );

  const formatRegion = useCallback(
    (amount: number | null | undefined): string | null => {
      if (amount == null) return null;
      return formatDisplayMoney(amount, displayCurrency);
    },
    [displayCurrency],
  );

  const formatTwd = useCallback(
    (amount: number | string | null | undefined): string | null => {
      if (amount == null || amount === "") return null;
      return formatDisplayMoney(amount, FX_BASE_CURRENCY);
    },
    [],
  );

  const formatTwdAsRegion = useCallback(
    (amountTwd: number | string | null | undefined): string | null => {
      if (amountTwd == null || amountTwd === "") return null;
      const n = typeof amountTwd === "string" ? Number(amountTwd) : amountTwd;
      if (!Number.isFinite(n)) return null;
      return formatDisplayMoney(
        convertTwdToDisplay(n, displayCurrency, rates),
        displayCurrency,
      );
    },
    [displayCurrency, rates],
  );

  return {
    displayCurrency,
    rateTwdToUsd,
    rates,
    isRatesReady,
    onePointDisplay,
    onePointTwd,
    pointUsdLabel: formatPointUsdValue(),
    isRegionTwd: displayCurrency === FX_BASE_CURRENCY,
    estimateWithdraw,
    formatRegion,
    formatTwd,
    formatTwdAsRegion,
  };
}
