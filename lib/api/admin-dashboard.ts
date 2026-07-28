import { api } from "./client";

export type DashboardCountTile = {
  count: number;
  href?: string;
  amountUsd?: string;
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

export type AdminDashboardSnapshot = {
  ordersToday?: number;
  ordersThisWeek?: number;
  gmvDeliveredThisMonthUsd?: string;
  activeShops?: number;
  activeProducts?: number;
  suspendedShops?: number;
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
  rmaPending: "/admin/rma?status=PENDING",
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
  "ordersToday",
  "ordersThisWeek",
  "gmvDeliveredThisMonthUsd",
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

export const adminDashboardApi = {
  get: async (sections: AdminDashboardSection[] | string = ["queues", "snapshot"]) => {
    const sectionsParam = Array.isArray(sections) ? sections.join(",") : sections;
    const res = await api.get<unknown>("/admin/dashboard", {
      query: { sections: sectionsParam },
    });
    return unwrapDashboardPayload(res);
  },
};
