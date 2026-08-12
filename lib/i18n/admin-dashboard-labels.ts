import type {
  AdminDashboardQueues,
  AdminDashboardSnapshot,
} from "@/lib/api/admin-dashboard";

export const ADMIN_DASHBOARD_QUEUE_I18N: Record<keyof AdminDashboardQueues, string> = {
  shopsPending: "admin.overview.queueTiles.shopsPending",
  productsPending: "admin.overview.queueTiles.productsPending",
  ordersPending: "admin.overview.queueTiles.ordersPending",
  rmaPending: "admin.overview.queueTiles.rmaPending",
  settlementsPendingReconcile: "admin.overview.queueTiles.settlementsPendingReconcile",
  sellerPayoutsPending: "admin.overview.queueTiles.sellerPayoutsPending",
  walletPayoutsPending: "admin.overview.queueTiles.walletPayoutsPending",
  promotionsPending: "admin.overview.queueTiles.promotionsPending",
  dsarSubmitted: "admin.overview.queueTiles.dsarSubmitted",
  dsarApprovedAwaitingExecute: "admin.overview.queueTiles.dsarApprovedAwaitingExecute",
  staffPending: "admin.overview.queueTiles.staffPending",
  financeConfigsPending: "admin.overview.queueTiles.financeConfigsPending",
};

export const ADMIN_DASHBOARD_SNAPSHOT_I18N: Record<keyof AdminDashboardSnapshot, string> = {
  ordersToday: "admin.overview.snapshot.ordersToday",
  ordersThisWeek: "admin.overview.snapshot.ordersThisWeek",
  gmvDeliveredThisMonth: "admin.overview.snapshot.gmvDeliveredThisMonth",
  activeShops: "admin.overview.snapshot.activeShops",
  activeProducts: "admin.overview.snapshot.activeProducts",
  suspendedShops: "admin.overview.snapshot.suspendedShops",
};
