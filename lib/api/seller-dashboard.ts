import { api } from "./client";

// ---------------------------------------------------------------------------
// Types (aligned with docs/SELLER-DASHBOARD-API.md)
// ---------------------------------------------------------------------------

export interface RmaRateResult {
  totalRma: number;
  totalDelivered: number;
  rmaRatePercent: number | null;
}

export interface DashboardSummary {
  revenueThisMonth: string;
  revenueLastMonth: string;
  revenueGrowthPercent: number | null;
  totalOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  pendingOrders: number;
  processingOrders: number;
  rmaRate: RmaRateResult;
}

export interface LowStockItem {
  variantId: string;
  sku: string;
  productTitle: string;
  availableStock: number;
  reservedStock: number;
  sellingPrice: string;
}

export interface DashboardLowStock {
  threshold: number;
  items: LowStockItem[];
  total: number;
}

export interface SellerDashboardPayload {
  summary?: DashboardSummary;
  lowStock?: DashboardLowStock;
  generatedAt: string;
}

export type SellerDashboardSection = "summary" | "lowStock";

// ---------------------------------------------------------------------------
// Revenue Chart types
// ---------------------------------------------------------------------------

export type RevenueChartRange = "7d" | "30d" | "12m";

export interface RevenueTimePoint {
  date: string;
  revenue: string;
  orderCount: number;
}

export interface RevenueChartPayload {
  range: string;
  groupBy: "day" | "week" | "month";
  current: RevenueTimePoint[];
  previous?: RevenueTimePoint[];
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export const sellerDashboardApi = {
  get: async (params?: {
    sections?: SellerDashboardSection[];
    lowStockThreshold?: number;
  }): Promise<SellerDashboardPayload> => {
    const query: Record<string, string | number> = {};
    if (params?.sections?.length) {
      query.sections = params.sections.join(",");
    }
    if (params?.lowStockThreshold !== undefined) {
      query.lowStockThreshold = params.lowStockThreshold;
    }
    return api.get<SellerDashboardPayload>("/seller/dashboard", { query });
  },

  revenueChart: async (params?: {
    range?: RevenueChartRange;
    comparePrevious?: boolean;
  }): Promise<RevenueChartPayload> => {
    const query: Record<string, string> = {};
    if (params?.range) query.range = params.range;
    if (params?.comparePrevious) query.comparePrevious = "true";
    return api.get<RevenueChartPayload>("/seller/dashboard/revenue-chart", { query });
  },
};
