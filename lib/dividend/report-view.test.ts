import { describe, expect, it } from "vitest";
import type { DividendReport } from "@/lib/api/dividend";
import { buildReportRows, reportState } from "./report-view";

const report = (over: Partial<DividendReport> = {}): DividendReport => ({
  quarter: "2026Q3",
  range: { start: "", end: "", firstDay: "2026-07-01", lastDay: "2026-09-30" },
  closed: true,
  locked: false,
  lockAt: "2026-10-01T16:01:00.000Z",
  editWindowDays: 0,
  currentQuarter: "2026Q4",
  rewardDateSource: "orders.sales_eligible_at",
  byRateInterval: [
    { from: "2026-07-01", to: "2026-08-15", rateBps: 1000, ratePercent: 10, rateId: null, isDefaultRate: true, orderCount: 3, salesBaseCents: 1000005, poolCents: 100000 },
    { from: "2026-08-16", to: "2026-09-30", rateBps: 1250, ratePercent: 12.5, rateId: "r1", isDefaultRate: false, orderCount: 2, salesBaseCents: 50, poolCents: 6 },
  ],
  totals: { orderCount: 5, salesBaseCents: 1000055, salesBase: "10000.55", rawPoolCents: 100006, poolCents: 100006, pool: "1000.06", totalSlots: 4, distributedNtd: 1000 },
  byAccount: [
    { userId: "u1", email: "a@x.com", fullName: "Anna", slots: 3, shareNtd: 750 },
    { userId: "u2", email: "b@x.com", fullName: null, slots: 1, shareNtd: 250 },
  ],
  remainder: { label: "khoản thu từ tính toán chênh lệch", cents: 6, amount: "0.06" },
  excluded: { pendingRefundOrders: 1 },
  refundsAfterLock: { refundCents: 0, refund: "0.00", orderCount: 0, appliedToPool: false },
  ...over,
});

describe("reportState", () => {
  it("projection / closed / locked", () => {
    expect(reportState({ closed: false, locked: false })).toBe("projection");
    expect(reportState({ closed: true, locked: false })).toBe("closed");
    expect(reportState({ closed: true, locked: true })).toBe("locked");
  });
});

describe("buildReportRows", () => {
  it("formats cents by integer split and shares as whole NTD", () => {
    const v = buildReportRows(report());
    expect(v.intervals[0]).toMatchObject({ ratePercent: "10.00%", salesBase: "10,000.05 TWD", pool: "1,000.00 TWD", isDefaultRate: true });
    expect(v.intervals[1]).toMatchObject({ ratePercent: "12.50%", salesBase: "0.50 TWD", pool: "0.06 TWD" });
    expect(v.accounts.map((a) => a.share)).toEqual(["750 TWD", "250 TWD"]);
    expect(v.totals).toMatchObject({ salesBase: "10,000.55 TWD", pool: "1,000.06 TWD", distributed: "1,000 TWD" });
  });
  it("keeps the remainder as its own value", () => {
    expect(buildReportRows(report()).remainder).toEqual({ cents: 6, amount: "0.06 TWD" });
  });
  it("labels accounts by name and email, falling back to email", () => {
    expect(buildReportRows(report()).accounts.map((a) => a.label)).toEqual(["Anna · a@x.com", "b@x.com"]);
  });
  it("refunds after lock appear only when there is an amount, and as information", () => {
    expect(buildReportRows(report()).refundsAfterLock).toBeNull();
    const v = buildReportRows(report({ refundsAfterLock: { refundCents: 12345, refund: "123.45", orderCount: 2, appliedToPool: false } }));
    expect(v.refundsAfterLock).toEqual({ amount: "123.45 TWD", orderCount: 2 });
    expect(buildReportRows(report({ refundsAfterLock: undefined })).refundsAfterLock).toBeNull();
  });
  it("a malformed rateBps from the API does not crash the view", () => {
    const base = report();
    const bad = report({ byRateInterval: [{ ...base.byRateInterval[0]!, rateBps: Number.NaN }] });
    expect(() => buildReportRows(bad)).not.toThrow();
    expect(buildReportRows(bad).intervals[0]!.ratePercent).toBe("-");
  });
});
