import { api } from "./client";
import type { PageMeta } from "./types";
import { parsePage } from "./utils";

export type RefundCaseStatus = "OPEN" | "SELLER_MARKED_PAID" | "BUYER_CONFIRMED" | "BUYER_DISPUTED" | "CLOSED";
export const REFUND_CASE_STATUSES: RefundCaseStatus[] = [
  "OPEN",
  "SELLER_MARKED_PAID",
  "BUYER_DISPUTED",
  "BUYER_CONFIRMED",
  "CLOSED",
];

export type RefundCaseSource = "CANCEL" | "RMA";
/** What THIS viewer may do with the case right now (computed by the API; the UI never infers it from roles). */
export type RefundCaseAction = "MARK_PAID" | "CONFIRM" | "DISPUTE" | "OVERRIDE";

export type RefundCaseEventKind =
  | "CREATED"
  | "SELLER_MARK_PAID"
  | "BUYER_CONFIRM"
  | "BUYER_DISPUTE"
  | "AUTO_CLOSE"
  | "ADMIN_OVERRIDE"
  | "RMA_SYNC";

export type RefundCaseView = {
  id: string;
  orderId: string;
  orderCode: string | null;
  source: RefundCaseSource;
  sourceId: string;
  shop: { id: string; name: string | null };
  /** Absent in the buyer's own view. */
  buyer?: { id: string; name: string | null; email: string | null };
  status: RefundCaseStatus;
  isPartial: boolean;
  /** Decimal string, TWD, 2 dp. */
  amount: string;
  currency: string;
  display: { amount: string; currency: string; fxRate: number | string } | null;
  sellerMarkedAt: string | null;
  sellerReference: string | null;
  buyerConfirmedAt: string | null;
  disputedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  ageDays: number;
  overdue: boolean;
  /** Buyer is also the owner of the shop: only support can complete it. */
  selfDealing?: boolean;
  actions: RefundCaseAction[];
};

export type RefundCaseEvent = {
  seq: number;
  at: string;
  kind: RefundCaseEventKind;
  actorRole: "BUYER" | "SELLER" | "ADMIN" | "SUPER_ADMIN" | "STAFF" | "SYSTEM";
  onBehalfOf: "BUYER" | "SELLER" | null;
  from: RefundCaseStatus | null;
  to: RefundCaseStatus;
  amount: string | null;
  note: string | null;
  reference: string | null;
  /** Staff view only. */
  actorId?: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
};

export type RefundCaseDetail = RefundCaseView & {
  events: RefundCaseEvent[];
  /** Staff view only. */
  rma?: { id: string; status: string; hasRefundProof: boolean } | null;
};

/**
 * A list page. The API controller returns `{ items, meta, window }` as `data`, but the global response
 * interceptor flattens it to `{ data: items[], meta }` (and drops `window`), so lists are read with
 * `withMeta` and normalised by `parsePage`, which accepts either shape.
 */
export type RefundCasePage = {
  items: RefundCaseView[];
  meta?: PageMeta;
};

type PageResponse = unknown;
const asPage = (res: PageResponse): RefundCasePage => parsePage<RefundCaseView>(res);

export type RefundCaseSummary = {
  asOf: string;
  overdueDays: number | null;
  counts: {
    open: number;
    awaitingBuyer: number;
    disputed: number;
    buyerConfirmed: number;
    closed: number;
    total: number;
    overdue: number;
  };
  amounts: Array<{
    currency: string;
    total: string;
    open: string;
    awaitingBuyer: string;
    disputed: string;
    buyerConfirmed: string;
    closed: string;
    overdue: string;
  }>;
  window?: { from: string | null; to: string | null };
};

export type PartyListQuery = { status?: string; page?: number; pageSize?: number };

export type AdminRefundCaseQuery = {
  /** Comma list of statuses. */
  status?: string;
  source?: RefundCaseSource;
  shopId?: string;
  buyerId?: string;
  orderCode?: string;
  /** YYYY-MM-DD, Asia/Taipei, inclusive. */
  from?: string;
  to?: string;
  minAmount?: string;
  maxAmount?: string;
  overdue?: "true" | "false";
  kind?: "partial" | "full";
  page?: number;
  pageSize?: number;
};

const idem = (key: string) => ({ headers: { "Idempotency-Key": key } });

/** Buyer and seller side: only the viewer's own cases (a foreign id is a 404). */
export const refundCasesApi = {
  asBuyer: async (query?: PartyListQuery) => asPage(await api.get<PageResponse>("/refund-cases/as-buyer", { query, withMeta: true })),
  asSeller: async (query?: PartyListQuery) => asPage(await api.get<PageResponse>("/refund-cases/as-seller", { query, withMeta: true })),
  get: (id: string) => api.get<RefundCaseDetail>(`/refund-cases/${encodeURIComponent(id)}`),
  markPaid: (id: string, body: { note?: string; reference?: string }, key: string) =>
    api.post<RefundCaseView>(`/refund-cases/${encodeURIComponent(id)}/mark-paid`, body, idem(key)),
  confirm: (id: string, body: { note?: string }, key: string) =>
    api.post<RefundCaseView>(`/refund-cases/${encodeURIComponent(id)}/confirm`, body, idem(key)),
  dispute: (id: string, body: { note: string }, key: string) =>
    api.post<RefundCaseView>(`/refund-cases/${encodeURIComponent(id)}/dispute`, body, idem(key)),
};

/** CS, ACCOUNTANT, ADMIN, SUPER_ADMIN read; only ADMIN and SUPER_ADMIN override. */
export const adminRefundCasesApi = {
  list: async (query?: AdminRefundCaseQuery) => asPage(await api.get<PageResponse>("/admin/refund-cases", { query, withMeta: true })),
  summary: (query?: Omit<AdminRefundCaseQuery, "page" | "pageSize">) =>
    api.get<RefundCaseSummary>("/admin/refund-cases/summary", { query }),
  get: (id: string) => api.get<RefundCaseDetail>(`/admin/refund-cases/${encodeURIComponent(id)}`),
  override: (id: string, body: { toStatus: RefundCaseStatus; reason: string }, key: string) =>
    api.post<RefundCaseDetail>(`/admin/refund-cases/${encodeURIComponent(id)}/override`, body, idem(key)),
};
