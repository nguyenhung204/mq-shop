import { api } from "./client";
import type { PageMeta, Paginated } from "./types";

export type ReferralLink = {
  referralCode: string;
  referralLink: string;
};

export type NetworkNode = {
  userId: string;
  depth: number;
  email: string | null;
  fullName: string | null;
  mlmRank: number | null;
  referrerId: string | null;
};

export type NetworkTree = {
  rootUserId: string;
  maxDepth: number;
  truncated: boolean;
  totalDownline: number;
  nodes: NetworkNode[];
};

export type ListNetworkTreeParams = {
  maxDepth?: number;
  limit?: number;
  /** Acc / Admin / SA only (scope ALL). */
  userId?: string;
};

export type RankProgressMode = "qualify_orders" | "f1_rank";

export type MlmRankProgress = {
  mlmRank: number;
  rankName: string;
  nextRank: number | null;
  nextRankName: string | null;
  mode: RankProgressMode | null;
  requiredCount: number | null;
  currentCount: number | null;
  requiredF1Rank: number | null;
  qualifyOrderStatus: string;
  /** Seller→NPP requires role SELLER; false = buyer-only cannot promote this step. */
  eligibleAsSeller?: boolean;
};

export type CommissionType = "REFERRAL" | "TEAM" | "GLOBAL" | "LOYALTY";

export type CommissionLedgerStatus = "PENDING" | "CREDITED" | "VOID";

export type CommissionRow = {
  id: string;
  type: CommissionType;
  beneficiaryUserId: string;
  beneficiaryRank: number;
  beneficiaryName?: string | null;
  beneficiaryEmail?: string | null;
  sourceOrderId: string | null;
  periodYearMonth: string | null;
  baseAmount: string;
  ratePercent: string;
  payoutAmount: string;
  status: CommissionLedgerStatus;
  creditedAt: string | null;
  createdAt: string;
  idempotencyKey?: string;
};

export type ListCommissionsParams = {
  type?: CommissionType;
  page?: number;
  pageSize?: number;
};

export type MlmRankConfig = {
  rank: number;
  name: string;
  teamPercent: string;
  referralPercent: string;
  globalFundTier: number | null;
  isActive: boolean;
};

export type SetMlmRankBody = { rank: number };

export type SetMlmRankResult = {
  userId: string;
  email: string;
  fullName: string | null;
  mlmRank: number;
  rankName: string;
};

export type SetMlmReferrerBody = {
  /** Pass `null` to clear upline. */
  referrerId: string | null;
};

export type SetMlmReferrerResult = {
  userId: string;
  email?: string;
  fullName?: string | null;
  referrerId: string | null;
};

export type SetMlmReferralRateBody = {
  /** Override % in 0..10, or `null` to clear override. */
  ratePercent: number | null;
};

export type SetMlmReferralRateResult = {
  userId: string;
  email?: string;
  fullName?: string | null;
  referralRateOverride: string | number | null;
};

export type RankReconcileResult = {
  userId: string;
  fromRank: number;
  toRank: number;
  promoted: boolean;
};

export type RankReconcileBatchResult = {
  checked: number;
  promotedUsers: RankReconcileResult[];
};

export type MonthlyCommissionSuggestedAction =
  | "RUN"
  | "RE_RUN_IDEMPOTENT"
  | "NO_VOLUME";

export type GlobalFundTierStatus = "PAID" | "COMPANY_KEPT" | "PENDING";

export type GlobalFundBeneficiary = {
  userId: string;
  email: string;
  fullName?: string | null;
  mlmRank: number;
  payoutAmount: string;
};

export type GlobalFundTierBreakdown = {
  tier: number;
  status: GlobalFundTierStatus;
  eligibleCount: number;
  paidTotal: string;
  companyKept: string;
  beneficiaries: GlobalFundBeneficiary[];
};

export type GlobalFundOverview = {
  percent: number;
  poolPerTier: string;
  tiers: GlobalFundTierBreakdown[];
  unscopedPaid: {
    paidTotal: string;
    beneficiaries: GlobalFundBeneficiary[];
  };
  totalPaidToUsers: string;
  totalCompanyKept: string;
  note?: string;
};

export type MonthlyCommissionOverviewRow = {
  yearMonth: string;
  deliveredOrderCount: number;
  gmv: string;
  /** @deprecated use globalFund.poolPerTier */
  globalFundEstimate?: string;
  globalFund?: GlobalFundOverview;
  hasDeliveredVolume?: boolean;
  credited: {
    teamCount: number;
    teamPayoutTotal: string;
    globalCount: number;
    globalPayoutTotal: string;
    loyaltyCount: number;
    loyaltyPayoutTotal: string;
  };
  suggestedAction: MonthlyCommissionSuggestedAction;
};

export type MonthlyCommissionOverview = {
  months: MonthlyCommissionOverviewRow[];
};

type CommissionListRes =
  | CommissionRow[]
  | { data: CommissionRow[]; meta?: PageMeta }
  | Paginated<CommissionRow>;

/** MLM network + commissions — `GET_REF_LINK` / `VIEW_MLM_TREE` / `VIEW_MLM_COMSN`. */
export const mlmApi = {
  referralLink: () => api.get<ReferralLink>("/mlm/referral-link"),
  networkTree: (query?: ListNetworkTreeParams) =>
    api.get<NetworkTree>("/mlm/network-tree", { query }),
  rankProgress: () => api.get<MlmRankProgress>("/mlm/rank-progress"),
  commissions: (query?: ListCommissionsParams) =>
    api.get<CommissionListRes>("/mlm/commissions", { query, withMeta: true }),
};

/** Admin MLM config — `CONFIG_MLM`. */
export const adminMlmApi = {
  ranks: () => api.get<MlmRankConfig[]>("/admin/mlm/ranks"),
  setUserRank: (userId: string, body: SetMlmRankBody) =>
    api.patch<SetMlmRankResult>(`/admin/mlm/users/${userId}/rank`, body),
  setUserReferrer: (userId: string, body: SetMlmReferrerBody) =>
    api.patch<SetMlmReferrerResult>(`/admin/mlm/users/${userId}/referrer`, body),
  setUserReferralRate: (userId: string, body: SetMlmReferralRateBody) =>
    api.patch<SetMlmReferralRateResult>(
      `/admin/mlm/users/${userId}/referral-rate`,
      body,
    ),
  monthlyOverview: (query?: { monthsBack?: number }) =>
    api.get<MonthlyCommissionOverview>("/admin/mlm/commissions/monthly-overview", {
      query: { monthsBack: query?.monthsBack ?? 12 },
    }),
  /** Demo/ops: run TEAM / LOYALTY / GLOBAL for a period (default = previous UTC month). */
  runMonthly: (body?: { yearMonth?: string }) =>
    api.post<{ yearMonth: string }>(
      "/admin/mlm/commissions/run-monthly",
      body ?? {},
    ),

  /**
   * Wake Rank Engine — promote eligible users (self multi-step + upline).
   * Pass `userId` for one user; omit for batch (default limit 100).
   */
  reconcileRanks: (body?: { userId?: string; limit?: number }) =>
    api.post<RankReconcileResult | RankReconcileBatchResult>(
      "/admin/mlm/ranks/reconcile",
      body ?? {},
    ),
};
