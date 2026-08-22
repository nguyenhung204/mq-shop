import { describe, expect, it } from "vitest";
import {
  POINT_USD_VALUE,
  convertPointsToDisplay,
  convertPointsToTwd,
  convertTwdToDisplay,
  formatDisplayMoney,
  formatPointUsdValue,
} from "./points";

/** Mirror BE formula for cross-check. */
function beTwdToPoints(commissionTwd: number, rateTwdToUsd: number): number {
  if (!(commissionTwd > 0) || !(rateTwdToUsd > 0)) return 0;
  const raw = (commissionTwd * rateTwdToUsd) / POINT_USD_VALUE;
  return Math.round(raw * 100) / 100;
}

describe("points conversion (FE ↔ BE)", () => {
  it("exports the same USD peg as backend", () => {
    expect(POINT_USD_VALUE).toBe(0.99999);
    expect(formatPointUsdValue()).toBe("0.99999");
  });

  it("uses a custom 1 PTS = USD peg", () => {
    expect(convertPointsToTwd(1, 0.031, 2, 1)).toBe(
      Math.round((1 / 0.031) * 100) / 100,
    );
    expect(formatPointUsdValue("1")).toBe("1");
  });

  it("matches BE convertPointsToTwd for seed FX", () => {
    expect(convertPointsToTwd(1, 0.031)).toBe(32.26);
    expect(convertPointsToTwd(5.58, 0.031)).toBeCloseTo(180, 0);
    expect(convertPointsToTwd(0, 0.031)).toBe(0);
    expect(convertPointsToTwd(10, 0)).toBe(0);
  });

  it("inverse of BE TWD→PTS stays within 1 TWD", () => {
    for (const twd of [100, 180, 2000, 28000]) {
      const pts = beTwdToPoints(twd, 0.031);
      expect(convertPointsToTwd(pts, 0.031)).toBeCloseTo(twd, 0);
    }
  });
});

describe("region display conversion", () => {
  const rates = { TWD: 1, USD: 0.031, VND: 800, MYR: 0.13, SGD: 0.04 };

  it("keeps TWD when display currency is TWD", () => {
    expect(convertTwdToDisplay(100, "TWD", rates)).toBe(100);
    expect(convertPointsToDisplay(1, 0.031, "TWD", rates)).toBe(32.26);
  });

  it("converts TWD → VND / MYR / SGD / USD via FX map", () => {
    expect(convertTwdToDisplay(32.26, "VND", rates)).toBe(
      Math.round(32.26 * 800 * 100) / 100,
    );
    expect(convertTwdToDisplay(32.26, "MYR", rates)).toBe(
      Math.round(32.26 * 0.13 * 100) / 100,
    );
    expect(convertTwdToDisplay(32.26, "SGD", rates)).toBe(
      Math.round(32.26 * 0.04 * 100) / 100,
    );
    expect(convertTwdToDisplay(32.26, "USD", rates)).toBe(
      Math.round(32.26 * 0.031 * 100) / 100,
    );
  });

  it("falls back to TWD amount when quote rate missing", () => {
    expect(convertTwdToDisplay(50, "EUR", { TWD: 1 })).toBe(50);
  });

  it("1 PTS ≈ region currency via TWD bridge", () => {
    const onePtsTwd = convertPointsToTwd(1, 0.031);
    expect(convertPointsToDisplay(1, 0.031, "VND", rates)).toBe(
      convertTwdToDisplay(onePtsTwd, "VND", rates),
    );
    expect(convertPointsToDisplay(1, 0.031, "USD", rates)).toBe(
      convertTwdToDisplay(onePtsTwd, "USD", rates),
    );
  });

  it("formats VND without fraction digits", () => {
    expect(formatDisplayMoney(25808, "VND")).toMatch(/25,?808/);
    expect(formatDisplayMoney(32.26, "TWD")).toContain("32.26");
  });
});
