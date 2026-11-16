import type { DividendReport } from "@/lib/api/dividend";
import { bpsToPercentString, formatCentsDisplay, formatWholeDisplay } from "@/lib/money";

export const REPORT_CURRENCY = "TWD";

export type ReportState = "projection" | "closed" | "locked";

/** projection = quarter still running; closed = ended but still editable; locked = frozen (UI3: read-only). */
export function reportState(r: Pick<DividendReport, "closed" | "locked">): ReportState {
  if (r.locked) return "locked";
  return r.closed ? "closed" : "projection";
}

export type ReportRows = {
  intervals: Array<{
    key: string;
    period: string;
    ratePercent: string;
    isDefaultRate: boolean;
    orderCount: number;
    salesBase: string;
    pool: string;
  }>;
  accounts: Array<{ userId: string; label: string; slots: number; share: string }>;
  totals: { orderCount: number; salesBase: string; pool: string; totalSlots: number; distributed: string };
  remainder: { cents: number; amount: string };
  /** Informational only (appliedToPool is false on the server); null when there is nothing to show. */
  refundsAfterLock: { amount: string; orderCount: number } | null;
  pendingRefundOrders: number;
};

/** Format every money field from integer cents / whole NTD; no arithmetic on amounts. */
export function buildReportRows(r: DividendReport, locale = "en-US"): ReportRows {
  const money = (cents: number) => formatCentsDisplay(cents, locale, REPORT_CURRENCY);
  const late = r.refundsAfterLock;
  return {
    intervals: r.byRateInterval.map((iv, i) => ({
      key: `${iv.from}-${iv.to}-${i}`,
      period: `${iv.from} → ${iv.to}`,
      ratePercent: `${bpsToPercentString(iv.rateBps)}%`,
      isDefaultRate: iv.isDefaultRate,
      orderCount: iv.orderCount,
      salesBase: money(iv.salesBaseCents),
      pool: money(iv.poolCents),
    })),
    accounts: r.byAccount.map((a) => ({
      userId: a.userId,
      label: a.fullName?.trim() ? `${a.fullName.trim()} · ${a.email ?? ""}`.replace(/ · $/, "") : (a.email ?? a.userId),
      slots: a.slots,
      share: formatWholeDisplay(a.shareNtd, locale, REPORT_CURRENCY),
    })),
    totals: {
      orderCount: r.totals.orderCount,
      salesBase: money(r.totals.salesBaseCents),
      pool: money(r.totals.poolCents),
      totalSlots: r.totals.totalSlots,
      distributed: formatWholeDisplay(r.totals.distributedNtd, locale, REPORT_CURRENCY),
    },
    remainder: { cents: r.remainder.cents, amount: money(r.remainder.cents) },
    refundsAfterLock:
      late && late.refundCents > 0 ? { amount: money(late.refundCents), orderCount: late.orderCount } : null,
    pendingRefundOrders: r.excluded.pendingRefundOrders,
  };
}
