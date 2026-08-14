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
  avatarUrl?: string | null;
  referralCount?: number | null;
  totalEarnings?: string | null;
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

export type FullNetworkTree = {
  focusUserId: string;
  maxDepth: number;
  totalUpline: number;
  totalDownline: number;
  nodes: NetworkNode[];
};

export type ListFullTreeParams = {
  userId: string;
  maxDepth?: number;
  limit?: number;
};

export type RankProgressMode = "qualify_orders" | "f1_rank" | "seller_granted";

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
  nameI18n: Record<string, string>;
  teamPercent: string;
  referralPercent: string;
  globalFundTier: number | null;
  isActive: boolean;
};

export type UpdateRankConfigBody = {
  name?: string;
  nameI18n?: Record<string, string>;
  teamPercent?: number;
  referralPercent?: number;
  globalFundTier?: number | null;
  isActive?: boolean;
};

export type CreateRankConfigBody = {
  rank: number;
  name: string;
  nameI18n?: Record<string, string>;
  teamPercent: number;
  referralPercent: number;
  globalFundTier?: number | null;
};

export type PromotionRule = {
  id: number;
  fromRank: number;
  toRank: number;
  mode: 'qualify_orders' | 'f1_rank' | 'seller_granted';
  requiredF1Rank: number | null;
  count: number;
  isActive: boolean;
};

export type CreatePromotionRuleBody = {
  fromRank: number;
  toRank: number;
  mode: 'qualify_orders' | 'f1_rank' | 'seller_granted';
  requiredF1Rank?: number | null;
  count?: number;
};

export type UpdatePromotionRuleBody = {
  fromRank?: number;
  toRank?: number;
  mode?: 'qualify_orders' | 'f1_rank' | 'seller_granted';
  requiredF1Rank?: number | null;
  count?: number;
  isActive?: boolean;
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

export type MarkCommissionPeriodPaidResult = {
  yearMonth: string;
  status?: string;
};

export type MonthlyCommissionSuggestedAction =
  | "RUN"
  | "RE_RUN_IDEMPOTENT"
  | "NO_VOLUME";

export type QuarterlyGlobalSuggestedAction =
  | "RUN"
  | "RE_RUN_IDEMPOTENT"
  | "NO_VOLUME"
  | "SKIPPED_MONTHLY_PAID"
  | "QUARTER_OPEN";

export type GlobalFundTierStatus = "PAID" | "COMPANY_KEPT" | "PENDING" | "NOT_RUN" | string;

export type GlobalFundBeneficiary = {
  userId: string;
  email: string;
  fullName?: string | null;
  mlmRank: number;
  payoutAmount: string;
  accountStatus?: string | null;
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

export type QuarterlyFxLockView = {
  periodKey: string;
  quarterEnd: string;
  fxDate: string;
  baseCurrency: string;
  source: string;
  asOf: string;
  rates: Array<{ quoteCurrency: string; rate: number }>;
};

export type QuarterlyGlobalOverviewRow = {
  periodKey: string;
  deliveredOrderCount: number;
  gmv: string;
  globalFund?: GlobalFundOverview;
  credited: {
    globalCount: number;
    globalPayoutTotal: string;
  };
  suggestedAction: QuarterlyGlobalSuggestedAction;
  skippedReason: string | null;
  fxAsOf: string | null;
  rankSnapshot?: {
    capturedAt: string;
    memberCount: number;
  } | null;
  fxLock?: QuarterlyFxLockView | null;
};

export type QuarterlyGlobalOverview = {
  quarters: QuarterlyGlobalOverviewRow[];
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
  /** Seller-readable rank rate table (VIEW_MLM_COMSN). */
  rankConfigs: () => api.get<MlmRankConfig[]>("/mlm/rank-configs"),
  commissions: (query?: ListCommissionsParams) =>
    api.get<CommissionListRes>("/mlm/commissions", { query, withMeta: true }),
};

/** Admin MLM config — `CONFIG_MLM`. */
export const adminMlmApi = {
  ranks: () => api.get<MlmRankConfig[]>("/admin/mlm/ranks"),
  /** Full tree: upline + downline for a user. */
  fullTree: (userId: string, query?: { maxDepth?: number; limit?: number }) =>
    api.get<FullNetworkTree>(`/admin/mlm/users/${userId}/full-tree`, { query }),
  createRankConfig: (body: CreateRankConfigBody) =>
    api.post<MlmRankConfig>("/admin/mlm/ranks", body),
  updateRankConfig: (rank: number, body: UpdateRankConfigBody) =>
    api.patch<MlmRankConfig>(`/admin/mlm/ranks/${rank}`, body),

  promotionRules: () => api.get<PromotionRule[]>("/admin/mlm/promotion-rules"),
  createPromotionRule: (body: CreatePromotionRuleBody) =>
    api.post<PromotionRule>("/admin/mlm/promotion-rules", body),
  updatePromotionRule: (id: number, body: UpdatePromotionRuleBody) =>
    api.patch<PromotionRule>(`/admin/mlm/promotion-rules/${id}`, body),
  deletePromotionRule: (id: number) =>
    api.post<void>(`/admin/mlm/promotion-rules/${id}/delete`, {}),
  setUserRank: (userId: string, body: SetMlmRankBody) =>
    api.patch<SetMlmRankResult>(`/admin/mlm/users/${userId}/rank`, body),
  setUserReferrer: (userId: string, body: SetMlmReferrerBody) =>
    api.patch<SetMlmReferrerResult>(`/admin/mlm/users/${userId}/referrer`, body),
  monthlyOverview: (query?: { monthsBack?: number }) =>
    api.get<MonthlyCommissionOverview>("/admin/mlm/commissions/monthly-overview", {
      query: { monthsBack: query?.monthsBack ?? 12 },
    }),
  quarterlyOverview: (query?: { quartersBack?: number }) =>
    api.get<QuarterlyGlobalOverview>("/admin/mlm/commissions/quarterly-overview", {
      query: { quartersBack: query?.quartersBack ?? 8 },
    }),
  /** Demo/ops: run TEAM / LOYALTY for a period (default = previous GMT+8 month). */
  runMonthly: (
    body: { yearMonth?: string } | undefined,
    idempotencyKey: string,
  ) =>
    api.post<{
      yearMonth: string;
      timezone: string;
      policyKey: string;
      periodStart: string;
      periodEnd: string;
      batchId: string | null;
      status: "COMPLETED" | "SKIPPED_ALREADY_COMPLETED";
    }>("/admin/mlm/commissions/run-monthly", body ?? {}, {
      headers: { "Idempotency-Key": idempotencyKey },
    }),
  runQuarterly: (
    body: { periodKey?: string } | undefined,
    idempotencyKey: string,
  ) =>
    api.post<{
      periodKey: string;
      timezone: string;
      policyKey: string;
      periodStart: string;
      periodEnd: string;
      batchId: string | null;
      status:
        | "COMPLETED"
        | "SKIPPED_ALREADY_COMPLETED"
        | "SKIPPED_MONTHLY_PAID"
        | "SKIPPED_NO_VOLUME"
        | "SKIPPED_QUARTER_OPEN";
      skippedReason?: string;
    }>("/admin/mlm/commissions/run-quarterly", body ?? {}, {
      headers: { "Idempotency-Key": idempotencyKey },
    }),

  /**
   * Wake Rank Engine — promote eligible users (self multi-step + upline).
   * Pass `userId` for one user; omit for batch (default limit 100).
   */
  reconcileRanks: (body?: { userId?: string; limit?: number }) =>
    api.post<RankReconcileResult | RankReconcileBatchResult>(
      "/admin/mlm/ranks/reconcile",
      body ?? {},
    ),

  /** Monthly commission audit report. Defaults to previous UTC month. */
  commissionReport: (query?: { yearMonth?: string }) =>
    api.get<CommissionReport>("/admin/mlm/commissions/report", { query }),

  markPeriodPaid: (yearMonth: string) =>
    api.post<MarkCommissionPeriodPaidResult>(
      `/admin/commission/periods/${yearMonth}/mark-paid`,
      {},
    ),

  /** Loyalty max-order qualify + streak history for one user. */
  loyaltyHistory: (userId: string, query?: { monthsBack?: number }) =>
    api.get<LoyaltyHistoryReport>(
      `/admin/mlm/commissions/loyalty-history/${userId}`,
      { query: { monthsBack: query?.monthsBack ?? 12 } },
    ),
};

// ─── Commission Report types (mirrors monthly-commission.job.ts on BE) ────────

export type CommissionReportBatchStatus =
  | "COMPLETED"
  | "NOT_RUN"
  | "NO_VOLUME"
  | "FAILED"
  | "RUNNING";

export type CommissionReportKpi = {
  commissionToGmvPercent: string;
  totalEntries: number;
  totalRecipients: number;
  companyKeptTotal: string;
  batchStatus: CommissionReportBatchStatus;
  generatedAt: string | Date | null;
};

// ── Entry types ──────────────────────────────────────────────────────────────

export type ReferralCommissionEntry = {
  ledgerId?: string;
  payoutAmount?: string;
  baseAmount?: string;
  ratePercent?: string;
  sourceOrderId?: string | null;
  orderCode: string;
  orderTotal: string;
  buyerEmail: string;
  buyerId?: string | null;
  buyerFullName?: string | null;
  commissionAmount?: string;
  deliveredAt: string | null;
  isJoining?: boolean;
  joiningOrderId?: string | null;
  policyVersion?: string | null;
  creditedAt?: string | Date | null;
};

export type TeamChainNode = {
  mlmRank: number;
  teamPercent: number;
  /** Optional richer fields if BE expands later */
  userId?: string;
  email?: string;
  fullName?: string | null;
  rankName?: string;
  percent?: string;
};

export type TeamCommissionEntry = {
  ledgerId: string;
  payoutAmount: string;
  baseAmount: string;
  teamPercent: string;
  maxBelow: string;
  paidPercent: string;
  chainNodes?: TeamChainNode[];
  branchRootUserId?: string | null;
  branchRootEmail?: string | null;
  branchRootFullName?: string | null;
  creditedAt?: string | Date | null;
};

export type GenericCommissionEntry = {
  ledgerId?: string;
  payoutAmount?: string;
  baseAmount?: string;
  ratePercent?: string;
  orderCode?: string;
  orderTotal?: string;
  commissionAmount?: string;
  meta?: Record<string, unknown> | null;
  creditedAt?: string | Date | null;
};

export type LoyaltyCommissionEntry = {
  ledgerId: string;
  payoutAmount: string;
  baseAmount: string;
  maxOrderAmount: string;
  qualifyingOrderId: string | null;
  qualifyingOrderCode: string | null;
  consecutiveMonths: number | null;
  cycleNumber: number | null;
  qualifyRule: "MAX_SINGLE_ORDER";
  gapResetBeforeThisMonth: boolean;
  meta?: Record<string, unknown> | null;
  creditedAt: string | Date | null;
};

export type LoyaltyMonthRow = {
  yearMonth: string;
  personalPv: string;
  maxOrderAmount: string;
  qualifyingOrderId: string | null;
  qualifyingOrderCode: string | null;
  deliveredOrderCount: number;
  qualified: boolean;
  streakAfter: number;
  status: "QUALIFIED" | "RESET" | "NO_DATA";
  resetReason: "below_max_order_threshold" | "no_delivered_orders" | null;
};

export type LoyaltyHistoryReport = {
  userId: string;
  email: string;
  fullName: string | null;
  mlmRank: number;
  rankName: string;
  currentStreak: number;
  lastLoyaltyQualifiedMonth: string | null;
  completedCycles: number;
  qualifyRule: "MAX_SINGLE_ORDER";
  thresholdTwd: number;
  months: LoyaltyMonthRow[];
  bonusEntries: LoyaltyCommissionEntry[];
};

// ── Shared row / summary types ────────────────────────────────────────────────

export type CommissionUserRow<E> = {
  userId: string;
  email: string;
  fullName: string | null;
  mlmRank: number;
  rankName: string;
  totalPayout: string;
  entries: E[];
};

export type CommissionTypeSummary<E> = {
  type: string;
  recipientCount: number;
  totalPayout: string;
  users: CommissionUserRow<E>[];
};

// ── Global tier ───────────────────────────────────────────────────────────────

export type GlobalFundTierReport = {
  tier: number;
  poolAmount: string;
  status: GlobalFundTierStatus;
  eligibleCount: number;
  paidTotal: string;
  companyKept: string;
  users: CommissionUserRow<GenericCommissionEntry>[];
};

// ── Top-level report ──────────────────────────────────────────────────────────

export type CommissionReport = {
  yearMonth: string;
  globalPeriodKey?: string;
  gmv: string;
  deliveredOrderCount: number;
  globalGmv?: string;
  globalOrderCount?: number;
  globalFxAsOf?: string | null;
  globalFundPercent: number;
  globalPoolPerTier: string;
  grandTotalPayout: string;
  kpi: CommissionReportKpi;
  referral: CommissionTypeSummary<ReferralCommissionEntry>;
  team: CommissionTypeSummary<TeamCommissionEntry>;
  global: CommissionTypeSummary<GenericCommissionEntry> & {
    tiers: GlobalFundTierReport[];
  };
  loyalty: CommissionTypeSummary<LoyaltyCommissionEntry>;
};
