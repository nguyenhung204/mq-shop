import { describe, expect, it } from "vitest";
import type { MyDividendEstimate } from "@/lib/api/dividend-settlements";
import { buildMyEstimateView } from "./my-estimate-view";

const base = (over: Partial<MyDividendEstimate> = {}): MyDividendEstimate => ({
  quarter: "2026Q4",
  currentQuarter: "2026Q4",
  closed: false,
  locked: false,
  lockAt: "2027-01-01T16:01:00.000Z",
  slots: 3,
  expiresAt: null,
  expiredBeforeQuarterEnd: false,
  estimate: { currentNtd: 75, withProvisionalNtd: 217 },
  settlement: null,
  ...over,
});

describe("buildMyEstimateView", () => {
  it("an open quarter is an estimate with both figures", () => {
    expect(buildMyEstimateView(base())).toEqual({
      state: "estimate",
      slots: 3,
      expiry: null,
      expiredEarly: false,
      now: "75 TWD",
      withProvisional: "217 TWD",
      credited: null,
    });
  });
  it("a locked quarter is final and has no provisional figure", () => {
    const v = buildMyEstimateView(base({ locked: true, estimate: { currentNtd: 1444, withProvisionalNtd: null } }));
    expect(v).toMatchObject({ state: "final", now: "1,444 TWD", withProvisional: null, credited: null });
  });
  it("a credited line wins: amount from integer cents, points as sent", () => {
    const v = buildMyEstimateView(
      base({ locked: true, estimate: { currentNtd: 1444, withProvisionalNtd: null }, settlement: { status: "CREDITED", amountTwdCents: 144400, points: "44.76", creditedAt: "2026-11-24T05:00:00.000Z" } }),
    );
    expect(v).toMatchObject({ state: "settled", credited: { amount: "1,444.00 TWD", points: "44.76", done: true } });
    expect(buildMyEstimateView(base({ settlement: { status: "PENDING", amountTwdCents: 100, points: "0", creditedAt: null } })).credited?.done).toBe(false);
  });
  it("slots that expire before the quarter end show 0 and the expiry", () => {
    const v = buildMyEstimateView(base({ slots: 0, expiresAt: "2026-11-29T04:00:00.000Z", expiredBeforeQuarterEnd: true, estimate: { currentNtd: 0, withProvisionalNtd: 0 } }));
    expect(v.expiredEarly).toBe(true);
    expect(v.expiry).toContain("2026");
    expect(v.now).toBe("0 TWD");
  });
});
