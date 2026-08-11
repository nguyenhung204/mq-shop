/** MLM rank / rate bounds — aligned with BE DTOs and baseline A1 (R0–R10). */
export const MLM_RANK_MIN = 0;
export const MLM_RANK_MAX = 10;
export const MLM_TEAM_PERCENT_MIN = 0;
export const MLM_TEAM_PERCENT_MAX = 13;
export const MLM_REFERRAL_PERCENT_MIN = 0;
export const MLM_REFERRAL_PERCENT_MAX = 10;
export const MLM_GLOBAL_TIER_MIN = 5;
export const MLM_GLOBAL_TIER_MAX = 10;

export type MlmBoundError =
  | "rank"
  | "teamPercent"
  | "referralPercent"
  | "globalFundTier"
  | "promotionRank";

export function isValidMlmRank(n: number): boolean {
  return Number.isInteger(n) && n >= MLM_RANK_MIN && n <= MLM_RANK_MAX;
}

export function isValidTeamPercent(n: number): boolean {
  return Number.isFinite(n) && n >= MLM_TEAM_PERCENT_MIN && n <= MLM_TEAM_PERCENT_MAX;
}

export function isValidReferralPercent(n: number): boolean {
  return Number.isFinite(n) && n >= MLM_REFERRAL_PERCENT_MIN && n <= MLM_REFERRAL_PERCENT_MAX;
}

/** Empty / null tier is allowed (ranks without global fund). */
export function isValidGlobalFundTier(n: number | null | undefined): boolean {
  if (n == null) return true;
  return Number.isInteger(n) && n >= MLM_GLOBAL_TIER_MIN && n <= MLM_GLOBAL_TIER_MAX;
}

export function validateRankConfigInput(input: {
  rank?: number;
  teamPercent?: number;
  referralPercent?: number;
  globalFundTier?: number | null;
}): MlmBoundError | null {
  if (input.rank !== undefined && !isValidMlmRank(input.rank)) return "rank";
  if (input.teamPercent !== undefined && !isValidTeamPercent(input.teamPercent)) {
    return "teamPercent";
  }
  if (
    input.referralPercent !== undefined &&
    !isValidReferralPercent(input.referralPercent)
  ) {
    return "referralPercent";
  }
  if (
    input.globalFundTier !== undefined &&
    !isValidGlobalFundTier(input.globalFundTier)
  ) {
    return "globalFundTier";
  }
  return null;
}

export function validatePromotionRankPair(
  fromRank: number,
  toRank: number,
): MlmBoundError | null {
  if (!isValidMlmRank(fromRank) || !isValidMlmRank(toRank)) return "promotionRank";
  if (toRank <= fromRank) return "promotionRank";
  return null;
}
