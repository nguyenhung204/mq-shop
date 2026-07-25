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

type CommissionListRes =
  | CommissionRow[]
  | { data: CommissionRow[]; meta?: PageMeta }
  | Paginated<CommissionRow>;

/** MLM network + commissions — `GET_REF_LINK` / `VIEW_MLM_TREE` / `VIEW_MLM_COMSN`. */
export const mlmApi = {
  referralLink: () => api.get<ReferralLink>("/mlm/referral-link"),
  networkTree: (query?: ListNetworkTreeParams) =>
    api.get<NetworkTree>("/mlm/network-tree", { query }),
  commissions: (query?: ListCommissionsParams) =>
    api.get<CommissionListRes>("/mlm/commissions", { query, withMeta: true }),
};

/** Admin MLM rank config — `CONFIG_MLM`. */
export const adminMlmApi = {
  ranks: () => api.get<MlmRankConfig[]>("/admin/mlm/ranks"),
  setUserRank: (userId: string, body: SetMlmRankBody) =>
    api.patch<SetMlmRankResult>(`/admin/mlm/users/${userId}/rank`, body),
};
