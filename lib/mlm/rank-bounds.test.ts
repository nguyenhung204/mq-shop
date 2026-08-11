import { describe, expect, it } from "vitest";
import {
  isValidGlobalFundTier,
  isValidMlmRank,
  isValidReferralPercent,
  isValidTeamPercent,
  validatePromotionRankPair,
  validateRankConfigInput,
} from "./rank-bounds";

describe("rank-bounds (TEST-001 FE smoke)", () => {
  it("accepts ranks 0–10 only", () => {
    expect(isValidMlmRank(0)).toBe(true);
    expect(isValidMlmRank(10)).toBe(true);
    expect(isValidMlmRank(11)).toBe(false);
    expect(isValidMlmRank(1.5)).toBe(false);
  });

  it("caps team ≤13% and referral ≤10%", () => {
    expect(isValidTeamPercent(13)).toBe(true);
    expect(isValidTeamPercent(13.01)).toBe(false);
    expect(isValidReferralPercent(10)).toBe(true);
    expect(isValidReferralPercent(10.01)).toBe(false);
  });

  it("allows null global tier; otherwise 5–10", () => {
    expect(isValidGlobalFundTier(null)).toBe(true);
    expect(isValidGlobalFundTier(5)).toBe(true);
    expect(isValidGlobalFundTier(4)).toBe(false);
  });

  it("validateRankConfigInput returns first error key", () => {
    expect(validateRankConfigInput({ rank: 11 })).toBe("rank");
    expect(validateRankConfigInput({ teamPercent: 14 })).toBe("teamPercent");
    expect(validateRankConfigInput({ referralPercent: 11 })).toBe(
      "referralPercent",
    );
    expect(
      validateRankConfigInput({
        rank: 3,
        teamPercent: 5,
        referralPercent: 5,
        globalFundTier: 7,
      }),
    ).toBeNull();
  });

  it("promotion requires toRank > fromRank within 0–10", () => {
    expect(validatePromotionRankPair(1, 2)).toBeNull();
    expect(validatePromotionRankPair(2, 2)).toBe("promotionRank");
    expect(validatePromotionRankPair(10, 11)).toBe("promotionRank");
  });
});
