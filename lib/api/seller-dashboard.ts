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
};
