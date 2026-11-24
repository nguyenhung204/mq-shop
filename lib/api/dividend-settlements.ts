import { api } from "./client";
import type { PageMeta } from "./types";
import { parsePage } from "./utils";

/** TWD on the wire: cents as bigint TEXT plus the decimal text. Never a float. */
export type Money = { cents: string; amount: string };

export type SettlementStatus = "RUNNING" | "COMPLETED" | "FAILED";
export type ItemStatus = "PENDING" | "CREDITED" | "SKIPPED_ZERO" | "SKIPPED_NO_WALLET";

export type SettlementView = {
  id: string;
  /** e.g. "2026Q4" */
  quarter: string;
  status: SettlementStatus;
  pool: Money;
  /** "difference income" line of the report */
  remainder: Money;
  paidTotal: Money;
  /** pool - paid, only once COMPLETED */
  companyRetained: Money | null;
  totalSlots: number;
  itemCount: number;
  counts: { pending: number; credited: number; skippedZero: number; skippedNoWallet: number } | null;
  taxBps: number;
  rateIntervals: unknown;
  fxRateTwdUsd: number;
  pointUsdValue: number;
  lockAt: string;
  snapshotAt: string;
  reportHash: string;
  finishedAt: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
};

export type SettlementItem = {
  id: string;
  quarter: string;
  /** staff view only */
  userId?: string;
  email?: string | null;
  fullName?: string | null;
  slots: number;
  amountTwd: Money;
  /** decimal text, 2 dp */
  points: string;
  status: ItemStatus;
  walletTxId: string | null;
  creditedAt: string | null;
  /** SKIPPED_NO_WALLET: reason NO_WALLET | DELETED | PENDING_ACTIVATION | NO_USER */
  meta?: { reason?: string } | null;
  /** owner view only */
  settlementStatus?: SettlementStatus;
};

export type AutoCreditState = { enabled: boolean; fromQuarter: string | null; fromQuarterCode: number | null; armed: boolean };

export type SettlementListPage = { items: SettlementView[]; meta?: PageMeta; autoCredit: AutoCreditState | null };
export type SettlementDetail = { settlement: SettlementView; items: SettlementItem[]; meta?: PageMeta };
export type ItemPage = { items: SettlementItem[]; meta?: PageMeta };

export type RunOutcome = {
  quarter: string;
  outcome: "COMPLETED" | "ALREADY_COMPLETED" | "PARTIAL";
  settlementId: string;
  snapshotCreated: boolean;
  credited: number;
  skipped: number;
  pending: number;
  errors: number;
};

type Wire = { data: unknown; meta?: (PageMeta & { autoCredit?: AutoCreditState }) | undefined };
const seg = encodeURIComponent;

export const dividendSettlementsApi = {
  list: async (query?: { page?: number; pageSize?: number }): Promise<SettlementListPage> => {
    const res = await api.get<Wire>("/admin/dividend/settlements", { query, withMeta: true });
    const page = parsePage<SettlementView>(res);
    return { items: page.items, meta: page.meta, autoCredit: res.meta?.autoCredit ?? null };
  },
  detail: async (quarter: string, query?: { page?: number; pageSize?: number; status?: ItemStatus }): Promise<SettlementDetail> => {
    const res = await api.get<{ data: { settlement: SettlementView; items: SettlementItem[] }; meta?: PageMeta }>(
      `/admin/dividend/settlements/${seg(quarter)}`,
      { query, withMeta: true },
    );
    return { settlement: res.data.settlement, items: res.data.items ?? [], meta: res.meta };
  },
  /** SUPER_ADMIN only; runs synchronously and can take a while for a big quarter. */
  run: (quarter: string, key: string) =>
    api.post<RunOutcome>(`/admin/dividend/settlements/${seg(quarter)}/run`, undefined, { headers: { "Idempotency-Key": key } }),
};

export const dividendCreditsApi = {
  list: async (query?: { page?: number; pageSize?: number; quarter?: string }): Promise<ItemPage> =>
    parsePage<SettlementItem>(await api.get<unknown>("/dividend/credits", { query, withMeta: true })),
  get: (id: string) => api.get<SettlementItem>(`/dividend/credits/${seg(id)}`),
};

/** GET /dividend/my-estimate: MY slots at the end of a quarter and the expected dividend (an estimate until the quarter is locked). */
export type MyDividendEstimate = {
  quarter: string;
  currentQuarter: string;
  closed: boolean;
  locked: boolean;
  lockAt: string;
  slots: number;
  expiresAt: string | null;
  expiredBeforeQuarterEnd: boolean;
  estimate: { currentNtd: number; withProvisionalNtd: number | null };
  settlement: { status: string; amountTwdCents: number; points: string; creditedAt: string | null } | null;
};

export const dividendMyEstimateApi = {
  get: (quarter?: string) => api.get<MyDividendEstimate>("/dividend/my-estimate", { query: quarter ? { quarter } : undefined }),
};
