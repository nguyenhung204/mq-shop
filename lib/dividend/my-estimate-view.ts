import type { MyDividendEstimate } from "@/lib/api/dividend-settlements";
import { formatDateTimeGmt8 } from "@/lib/i18n/gmt8-calendar";
import { formatCentsDisplay, formatWholeDisplay } from "@/lib/money";

const CURRENCY = "TWD";

export type MyEstimateView = {
  /** "settled" = a credited line exists; "final" = quarter locked, not credited yet; "estimate" = the quarter is still open */
  state: "settled" | "final" | "estimate";
  slots: number;
  expiry: string | null;
  expiredEarly: boolean;
  /** share with the orders that are eligible today */
  now: string;
  /** share if the orders still inside the 7-day return window also qualify; null once the quarter is locked */
  withProvisional: string | null;
  credited: { amount: string; points: string; done: boolean } | null;
};

/** Format only: every number comes from the server, whole NTD for the share and integer cents for the credited line. */
export function buildMyEstimateView(e: MyDividendEstimate, locale = "en-US"): MyEstimateView {
  const state: MyEstimateView["state"] = e.settlement ? "settled" : e.locked ? "final" : "estimate";
  return {
    state,
    slots: e.slots,
    expiry: e.expiresAt ? formatDateTimeGmt8(e.expiresAt, locale) : null,
    expiredEarly: e.expiredBeforeQuarterEnd,
    now: formatWholeDisplay(e.estimate.currentNtd, locale, CURRENCY),
    withProvisional: e.estimate.withProvisionalNtd === null ? null : formatWholeDisplay(e.estimate.withProvisionalNtd, locale, CURRENCY),
    credited: e.settlement
      ? { amount: formatCentsDisplay(e.settlement.amountTwdCents, locale, CURRENCY), points: e.settlement.points, done: e.settlement.status === "CREDITED" }
      : null,
  };
}
