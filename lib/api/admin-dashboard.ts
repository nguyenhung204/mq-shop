import { api } from "./client";

export type DashboardCountTile = {
  count: number;
  href?: string;
  amount?: string;
};

export type AdminDashboardSnapshot = {
  ordersToday?: number;
  ordersThisWeek?: number;
  gmvIncurredThisMonth?: string;
  gmvPlatformTotal?: string;
  gmvDeliveredThisMonth?: string;
  activeShops?: number;
  activeProducts?: number;
  suspendedShops?: number;
};

export type AdminDashboardQueues = {
  shopsPending?: DashboardCountTile;
  productsPending?: DashboardCountTile;
  ordersPending?: DashboardCountTile;
  rmaPending?: DashboardCountTile;
  settlementsPendingReconcile?: DashboardCountTile;
  sellerPayoutsPending?: DashboardCountTile;
  walletPayoutsPending?: DashboardCountTile;
  promotionsPending?: DashboardCountTile;
  dsarSubmitted?: DashboardCountTile;
  dsarApprovedAwaitingExecute?: DashboardCountTile;
  staffPending?: DashboardCountTile;
  financeConfigsPending?: DashboardCountTile;
};
export type AdminDashboardPayload = {
  queues?: AdminDashboardQueues;
  snapshot?: Partial<AdminDashboardSnapshot>;
  generatedAt: string;
};

export type AdminDashboardSection = "queues" | "snapshot";

const QUEUE_HREF_FALLBACKS: Record<keyof AdminDashboardQueues, string> = {
  shopsPending: "/admin/shops?status=PENDING",
  productsPending: "/admin/products?status=PENDING",
  ordersPending: "/admin/orders",
  rmaPending: "/admin/rma?status=REQUESTED",
  settlementsPendingReconcile: "/admin/settlements?status=PENDING_RECONCILE",
  sellerPayoutsPending: "/admin/payouts?status=PENDING",
  walletPayoutsPending: "/admin/wallet/payouts?status=PENDING",
  promotionsPending: "/admin/promotions?status=PENDING",
  dsarSubmitted: "/admin/dsar?status=SUBMITTED",
  dsarApprovedAwaitingExecute: "/admin/dsar?status=APPROVED",
  staffPending: "/admin/staff?status=PENDING",
  financeConfigsPending: "/admin/finance/configs?status=PENDING_APPROVAL",
};

/** BE hrefs that differ from Next.js admin routes. */
const HREF_ALIASES: Record<string, string> = {
  "/admin/seller-payouts?status=PENDING": "/admin/payouts?status=PENDING",
  "/admin/seller-payouts": "/admin/payouts",
  "/admin/finance/config?status=PENDING_APPROVAL":
    "/admin/finance/configs?status=PENDING_APPROVAL",
  "/admin/finance/config": "/admin/finance/configs",
};

export const ADMIN_DASHBOARD_QUEUE_ORDER: (keyof AdminDashboardQueues)[] = [
  "shopsPending",
  "productsPending",
  "ordersPending",
  "rmaPending",
  "settlementsPendingReconcile",
  "sellerPayoutsPending",
  "walletPayoutsPending",
  "promotionsPending",
  "dsarSubmitted",
  "dsarApprovedAwaitingExecute",
  "staffPending",
  "financeConfigsPending",
];

export const ADMIN_DASHBOARD_SNAPSHOT_ORDER: (keyof AdminDashboardSnapshot)[] = [
  "gmvIncurredThisMonth",
  "gmvDeliveredThisMonth",
  "gmvPlatformTotal",
  "ordersToday",
  "ordersThisWeek",
  "activeShops",
  "activeProducts",
  "suspendedShops",
];

function unwrapDashboardPayload(res: unknown): AdminDashboardPayload {
  if (res && typeof res === "object" && "data" in res) {
    const inner = (res as { data: unknown }).data;
    if (inner && typeof inner === "object" && "generatedAt" in inner) {
      return inner as AdminDashboardPayload;
    }
  }
  return res as AdminDashboardPayload;
}

export function normalizeDashboardHref(
  href: string | undefined,
  key: keyof AdminDashboardQueues,
): string {
  if (href) {
    return HREF_ALIASES[href] ?? href;
  }
  return QUEUE_HREF_FALLBACKS[key];
}

// ---------------------------------------------------------------------------
// Chart types (Section 9 — Admin Dashboard Charts)
// ---------------------------------------------------------------------------

export type AdminChartRange = "7d" | "30d" | "12m";
export type TopShopsRange = "7d" | "30d" | "90d";

export interface GmvTimePoint {
  date: string;
  gmv: string;
  orderCount: number;
}

export interface GmvChartPayload {
  range: string;
  groupBy: "day" | "month";
  current: GmvTimePoint[];
  generatedAt: string;
}

export interface OrdersTimePoint {
  date: string;
  count: number;
}

export interface OrdersChartPayload {
  range: string;
  groupBy: "day" | "month";
  current: OrdersTimePoint[];
  generatedAt: string;
}

export interface OrderStatusItem {
  status: string;
  count: number;
}

export interface OrderStatusPayload {
  range: string;
  distribution: OrderStatusItem[];
  generatedAt: string;
}

export interface TopShopItem {
  shopId: string;
  shopName: string;
  revenue: string;
  orderCount: number;
}

export interface TopShopsPayload {
  range: string;
  items: TopShopItem[];
  generatedAt: string;
}

export interface NewUsersTimePoint {
  date: string;
  count: number;
}

export interface NewUsersChartPayload {
  range: string;
  groupBy: "day" | "month";
  current: NewUsersTimePoint[];
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Cron Jobs types (Section 9.9)
// ---------------------------------------------------------------------------

export interface CronJobInfo {
  id: string;
  name: string;
  description: string;
  category?: "orders" | "commission" | "mlm" | "marketing" | "compliance" | string;
  cronExpression: string;
  schedule: string;
  timezone?: string;
  timezoneLabel?: string;
  nextRunAt: string;
  nextRunInMs: number;
}

export interface CronJobsPayload {
  jobs: CronJobInfo[];
  serverTime: string;
  count?: number;
}

export const adminDashboardApi = {
  get: async (sections: AdminDashboardSection[] | string = ["queues", "snapshot"]) => {
    const sectionsParam = Array.isArray(sections) ? sections.join(",") : sections;
    const res = await api.get<unknown>("/admin/dashboard", {
      query: { sections: sectionsParam },
    });
    return unwrapDashboardPayload(res);
  },

  gmvChart: async (range?: AdminChartRange): Promise<GmvChartPayload> => {
    const query: Record<string, string> = {};
    if (range) query.range = range;
    return api.get<GmvChartPayload>("/admin/dashboard/gmv-chart", { query });
  },

  ordersChart: async (range?: AdminChartRange): Promise<OrdersChartPayload> => {
    const query: Record<string, string> = {};
    if (range) query.range = range;
    return api.get<OrdersChartPayload>("/admin/dashboard/orders-chart", { query });
  },

  orderStatus: async (range?: AdminChartRange): Promise<OrderStatusPayload> => {
    const query: Record<string, string> = {};
    if (range) query.range = range;
    return api.get<OrderStatusPayload>("/admin/dashboard/order-status", { query });
  },

  topShops: async (params?: {
    range?: TopShopsRange;
    limit?: number;
  }): Promise<TopShopsPayload> => {
    const query: Record<string, string | number> = {};
    if (params?.range) query.range = params.range;
    if (params?.limit) query.limit = params.limit;
    return api.get<TopShopsPayload>("/admin/dashboard/top-shops", { query });
  },

  newUsersChart: async (range?: AdminChartRange): Promise<NewUsersChartPayload> => {
    const query: Record<string, string> = {};
    if (range) query.range = range;
    return api.get<NewUsersChartPayload>("/admin/dashboard/new-users-chart", { query });
  },

  cronJobs: async (): Promise<CronJobsPayload> => {
    return api.get<CronJobsPayload>("/admin/dashboard/cron-jobs");
  },
};
