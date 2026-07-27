import { api } from "./client";
import type { PageMeta, Paginated } from "./types";

export type FinanceConfigStatus = "PENDING_APPROVAL" | "ACTIVE" | "REJECTED";
export type PayoutStatus = "PENDING" | "REJECTED" | "COMPLETED";
export type FinanceTransactionType = "ORDER" | "PAYOUT" | "ALL";
export type FinanceExportFormat = "CSV" | "XLSX";

export type FinanceConfig = {
  id: string;
  platformFeePercent: string;
  commissionPercent: string;
  gatewayName: string | null;
  hasApiKey: boolean;
  hasSecretKey: boolean;
  status: FinanceConfigStatus;
  rejectionReason: string | null;
  createdByUserId: string;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  activatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateFinanceConfigBody = {
  platformFeePercent: string;
  commissionPercent: string;
  gatewayName?: string;
  apiKey?: string;
  secretKey?: string;
};

export type ListFinanceConfigsParams = {
  status?: FinanceConfigStatus;
  page?: number;
  pageSize?: number;
};

export type SellerPayoutItem = {
  id: string;
  settlementId: string;
  orderId: string;
  amount: string;
};

export type SellerPayout = {
  id: string;
  shopId: string;
  periodStart: string;
  periodEnd: string;
  grossRevenue: string;
  platformFee: string;
  shippingFee: string;
  netAmount: string;
  currency: string;
  status: PayoutStatus;
  rejectionReason: string | null;
  createdByUserId: string;
  approvedByUserId: string | null;
  completedAt: string | null;
  gatewayRef: string | null;
  items: SellerPayoutItem[];
  createdAt: string;
  updatedAt: string;
};

export type CreateSellerPayoutBody = {
  shopId: string;
  periodStart: string;
  periodEnd: string;
};

export type ListSellerPayoutsParams = {
  shopId?: string;
  status?: PayoutStatus;
  page?: number;
  pageSize?: number;
};

export type LandingCostItemInput = {
  unitPrice: string;
  quantity: number;
  discount?: string;
};

export type LandingCostRequest = {
  items: LandingCostItemInput[];
  shippingFee?: string;
  vatAmount?: string;
  packagingFee?: string;
  promoDiscount?: string;
};

export type LandingCostItemResult = {
  index: number;
  unitPrice: string;
  quantity: number;
  discount: string;
  subtotal: string;
  lineTotal: string;
};

export type LandingCostBreakdown = {
  itemsSubtotal: string;
  shippingFee: string;
  vatAmount: string;
  packagingFee: string;
  promoDiscount: string;
};

export type LandingCostResult = {
  items: LandingCostItemResult[];
  breakdown: LandingCostBreakdown;
  finalAmount: string;
};

export type FinanceTransaction = {
  type: "ORDER" | "PAYOUT";
  id: string;
  shopId: string | null;
  /** Shop display name (list + export). */
  shopName?: string | null;
  /** Shop owner fullName, fallback email. */
  shopOwnerName?: string | null;
  buyerId: string | null;
  /** Buyer display name on ORDER rows (fullName, fallback email). */
  buyerName?: string | null;
  amount: string;
  currency: string;
  status: string;
  occurredAt: string;
  ref: string | null;
};

export type ListFinanceTransactionsParams = {
  startDate?: string;
  endDate?: string;
  type?: FinanceTransactionType;
  shopId?: string;
  page?: number;
  pageSize?: number;
};

export type ExportFinanceReportBody = {
  startDate: string;
  endDate: string;
  type?: FinanceTransactionType;
  format?: FinanceExportFormat;
  shopId?: string;
};

export type ExportFinanceReportResult = {
  fileUrl: string;
  format: FinanceExportFormat;
  rowCount: number;
};

type ConfigListRes =
  | FinanceConfig[]
  | { data: FinanceConfig[]; meta?: PageMeta }
  | Paginated<FinanceConfig>;

type PayoutListRes =
  | SellerPayout[]
  | { data: SellerPayout[]; meta?: PageMeta }
  | Paginated<SellerPayout>;

type TxListRes =
  | FinanceTransaction[]
  | { data: FinanceTransaction[]; meta?: PageMeta }
  | Paginated<FinanceTransaction>;

/** Dual-control platform fee / gateway config — `CONFIG_FEE`. */
export const financeConfigApi = {
  list: (query?: ListFinanceConfigsParams) =>
    api.get<ConfigListRes>("/admin/finance/configs", { query, withMeta: true }),
  active: () => api.get<FinanceConfig | null>("/admin/finance/configs/active"),
  create: (body: CreateFinanceConfigBody) =>
    api.post<FinanceConfig>("/admin/finance/configs", body),
  approve: (configId: string) =>
    api.post<FinanceConfig>(`/admin/finance/configs/${configId}/approve`, {}),
  reject: (configId: string, body: { reason: string }) =>
    api.post<FinanceConfig>(`/admin/finance/configs/${configId}/reject`, body),
};

/** Seller payout slips — `PAYOUT_SELLER`. */
export const adminPayoutApi = {
  list: (query?: ListSellerPayoutsParams) =>
    api.get<PayoutListRes>("/admin/payouts", { query, withMeta: true }),
  get: (payoutId: string) => api.get<SellerPayout>(`/admin/payouts/${payoutId}`),
  create: (body: CreateSellerPayoutBody) =>
    api.post<SellerPayout>("/admin/payouts", body),
  approve: (payoutId: string) =>
    api.post<SellerPayout>(`/admin/payouts/${payoutId}/approve`, {}),
  reject: (payoutId: string, body: { reason: string }) =>
    api.post<SellerPayout>(`/admin/payouts/${payoutId}/reject`, body),
};

/** Stateless landing cost calculator — `CALC_LAND_COST`. */
export const landingCostApi = {
  calculate: (body: LandingCostRequest) =>
    api.post<LandingCostResult>("/finance/landing-cost", body),
};

/** Transactions list + report export — `VIEW_TRANSACT` / `EXPORT_REPORT`. */
export const financeReportApi = {
  transactions: (query?: ListFinanceTransactionsParams) =>
    api.get<TxListRes>("/finance/transactions", { query, withMeta: true }),
  exportReport: (body: ExportFinanceReportBody) =>
    api.post<ExportFinanceReportResult>("/finance/reports/export", body),
};
