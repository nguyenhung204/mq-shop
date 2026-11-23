import { api } from "./client";

/** All dividend routes live under /admin/dividend. Money is integer cents (`*Cents`) or whole NTD. */

export type DividendRateStatus = "effective" | "upcoming" | "superseded";

export type DividendRate = {
  id: string;
  rateBps: number;
  ratePercent: number;
  /** YYYY-MM-DD, Asia/Taipei. */
  effectiveDate: string;
  reason: string;
  createdBy: string | null;
  createdAt: string;
  status: DividendRateStatus;
  current: boolean;
};

export type DividendRatesView = {
  /** Today in Asia/Taipei according to the server. */
  today: string;
  default: { rateBps: number; ratePercent: number };
  current: { rateBps: number; ratePercent: number; rateId: string | null };
  items: DividendRate[];
};

export type CreateDividendRateBody = { ratePercent: number; effectiveDate: string; reason: string };

export type SlotCaps = { maxSlotsPerAccount: number | null; maxTotalSlots: number | null };

export type SlotHolding = {
  userId: string;
  email: string | null;
  fullName: string | null;
  slots: number;
  expiresAt: string | null;
  sinceQuarter: string;
};

export type SlotsView = {
  quarter: string;
  locked: boolean;
  lockAt: string;
  editWindowDays: number;
  caps: SlotCaps;
  totalSlots: number;
  items: SlotHolding[];
};

export type SlotEntry = {
  id: string;
  userId: string;
  quarter: string;
  slots: number;
  expiresAt: string | null;
  kind: string;
  transferId: string | null;
  counterpartyUserId: string | null;
  reason: string;
  createdBy: string;
  createdAt: string;
};

export type SetSlotsBody = {
  userId: string;
  /** Absolute number of slots from `quarter` on (0 clears). */
  slots: number;
  quarter?: string;
  /** ISO instant. */
  expiresAt?: string;
  reason: string;
};

export type TransferSlotsBody = {
  fromUserId: string;
  toUserId: string;
  slots: number;
  quarter?: string;
  reason: string;
};

export type TransferSlotsResult = { transferId: string; legs: SlotEntry[] };

export type DividendReport = {
  quarter: string;
  range: { start: string; end: string; firstDay: string; lastDay: string };
  /** false = projection from the slots and rates known today. */
  closed: boolean;
  locked: boolean;
  lockAt: string;
  editWindowDays: number;
  currentQuarter: string;
  rewardDateSource: string;
  byRateInterval: Array<{
    from: string;
    to: string;
    rateBps: number;
    ratePercent: number;
    rateId: string | null;
    isDefaultRate: boolean;
    orderCount: number;
    salesBaseCents: number;
    poolCents: number;
  }>;
  totals: {
    orderCount: number;
    salesBaseCents: number;
    salesBase: string;
    rawPoolCents: number;
    poolCents: number;
    pool: string;
    totalSlots: number;
    distributedNtd: number;
  };
  byAccount: Array<{
    userId: string;
    email: string | null;
    fullName: string | null;
    slots: number;
    /** Whole NTD. */
    shareNtd: number;
  }>;
  remainder: { label: string; cents: number; amount: string };
  excluded: { pendingRefundOrders: number };
  /** Projection for orders still inside the return window; display only, never part of the totals above. */
  provisional?: { orderCount: number; salesBaseCents: number; extraPoolCents: number; poolWithProvisionalCents: number; returnWindowDays: number };
  /** Informational only: NOT applied to the pool. */
  refundsAfterLock?: { refundCents: number; refund: string; orderCount: number; appliedToPool: boolean };
};

const idem = (key: string) => ({ headers: { "Idempotency-Key": key } });

export const adminDividendApi = {
  rates: () => api.get<DividendRatesView>("/admin/dividend/rates"),

  createRate: (body: CreateDividendRateBody, idempotencyKey: string) =>
    api.post<DividendRate>("/admin/dividend/rates", body, idem(idempotencyKey)),

  slots: (quarter?: string) => api.get<SlotsView>("/admin/dividend/slots", { query: { quarter } }),

  slotHistory: (query: { userId?: string; limit?: number }) =>
    api.get<{ items: SlotEntry[] }>("/admin/dividend/slots/history", { query }),

  setSlots: (body: SetSlotsBody, idempotencyKey: string) =>
    api.post<SlotEntry>("/admin/dividend/slots", body, idem(idempotencyKey)),

  transferSlots: (body: TransferSlotsBody, idempotencyKey: string) =>
    api.post<TransferSlotsResult>("/admin/dividend/slots/transfer", body, idem(idempotencyKey)),

  report: (quarter: string) =>
    api.get<DividendReport>(`/admin/dividend/quarters/${encodeURIComponent(quarter)}/report`),
};
