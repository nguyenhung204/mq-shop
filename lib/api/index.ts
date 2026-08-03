import { api } from "./client";
import { bannerApi, marketingApi } from "./promotions";
import type {
  ApiAuditLog,
  ApiCategory,
  ApiProduct,
  ApiShop,
  AddProductVariantRequest,
  AuthUser,
  CreateProductRequest,
  ListingCard,
  LocalizedText,
  PageMeta,
  Paginated,
  ProductVariant,
  PublicProductDetail,
  ShopStorefront,
  UpdateProductRequest,
  UpdateProductVariantRequest,
} from "./types";
import { asArray, parsePage } from "./utils";

export {
  orderApi,
  adminOrdersApi,
  nextFulfillmentStatus,
  canCancelOrder,
  canRequestRma,
  hasActiveRma,
  hasBlockingRma,
  rmaStatusLabel,
} from "./orders";
export type {
  OrderStatus,
  PaymentMethod,
  RmaStatus,
  ShippingAddress,
  ShippingQuoteRequest,
  ShippingQuoteView,
  CheckoutRequest,
  AdminCheckoutRequest,
  OrderView,
  OrderItemView,
  RmaView,
  AdminRmaDetailView,
  CreateRmaRequest,
  ListOrdersParams,
  AdminListOrdersParams,
  UpdateOrderStatusRequest,
} from "./orders";
export { settlementApi, adminSettlementApi } from "./settlements";
export { adminDashboardApi } from "./admin-dashboard";
export type {
  DashboardCountTile,
  AdminDashboardQueues,
  AdminDashboardSnapshot,
  AdminDashboardPayload,
  AdminDashboardSection,
  AdminChartRange,
  TopShopsRange,
  GmvTimePoint,
  GmvChartPayload,
  OrdersTimePoint,
  OrdersChartPayload,
  OrderStatusItem,
  OrderStatusPayload,
  TopShopItem,
  TopShopsPayload,
  NewUsersTimePoint,
  NewUsersChartPayload,
  CronJobInfo,
  CronJobsPayload,
} from "./admin-dashboard";
export { sellerDashboardApi } from "./seller-dashboard";
export type {
  DashboardSummary,
  LowStockItem,
  DashboardLowStock,
  SellerDashboardPayload,
  SellerDashboardSection,
  RmaRateResult,
  RevenueChartRange,
  RevenueTimePoint,
  RevenueChartPayload,
  TopProductsRange,
  TopProductItem,
  TopProductsPayload,
} from "./seller-dashboard";
export {
  ADMIN_DASHBOARD_QUEUE_ORDER,
  ADMIN_DASHBOARD_SNAPSHOT_ORDER,
  normalizeDashboardHref,
} from "./admin-dashboard";
export {
  financeConfigApi,
  adminPayoutApi,
  landingCostApi,
  financeReportApi,
} from "./finance";
export type {
  FinanceConfigStatus,
  PayoutStatus,
  FinanceTransactionType,
  FinanceExportFormat,
  FinanceConfig,
  CreateFinanceConfigBody,
  ListFinanceConfigsParams,
  SellerPayout,
  SellerPayoutItem,
  CreateSellerPayoutBody,
  ListSellerPayoutsParams,
  LandingCostItemInput,
  LandingCostRequest,
  LandingCostItemResult,
  LandingCostBreakdown,
  LandingCostResult,
  FinanceTransaction,
  ListFinanceTransactionsParams,
  ExportFinanceReportBody,
  ExportFinanceReportResult,
} from "./finance";
export { walletApi, adminWalletPayoutApi, adminWalletApi } from "./wallet";
export { csApi } from "./cs";
export type {
  CsCustomerListItem,
  CsCustomerDetail,
  CsCustomerStats,
  CsCustomerRecentOrder,
  CsCustomerOrderItem,
} from "./cs";
export type {
  Wallet,
  WalletTxReason,
  WalletTxDirection,
  WalletTransaction,
  ListWalletTransactionsParams,
  ConfirmWalletPinBody,
  TransferPreviewBody,
  TransferPreviewResult,
  TransferRecipient,
  ListTransferRecipientsParams,
  TransferBody,
  BankInfo,
  WithdrawBody,
  PayoutRequestStatus,
  UserPayoutRequest,
  ListAdminWalletPayoutsParams,
  ListWalletWithdrawalsParams,
  AdjustWalletBody,
  AdjustWalletResult,
} from "./wallet";
export { mlmApi, adminMlmApi } from "./mlm";
export type {
  ReferralLink,
  NetworkNode,
  NetworkTree,
  ListNetworkTreeParams,
  RankProgressMode,
  MlmRankProgress,
  CommissionType,
  CommissionLedgerStatus,
  CommissionRow,
  ListCommissionsParams,
  MlmRankConfig,
  UpdateRankConfigBody,
  SetMlmRankBody,
  SetMlmRankResult,
  SetMlmReferrerBody,
  SetMlmReferrerResult,
  SetMlmReferralRateBody,
  SetMlmReferralRateResult,
  RankReconcileResult,
  RankReconcileBatchResult,
  MonthlyCommissionSuggestedAction,
  MonthlyCommissionOverviewRow,
  MonthlyCommissionOverview,
  GlobalFundTierStatus,
  GlobalFundBeneficiary,
  GlobalFundTierBreakdown,
  GlobalFundOverview,
} from "./mlm";
export type {
  SettlementStatus,
  SettlementView,
  SettlementSummary,
  SettlementListResult,
  SettlementPageMeta,
  ListSettlementsParams,
  AdminListSettlementsParams,
} from "./settlements";

export const catalogApi = {
  categories: async () => {
    const data = await api.get<ApiCategory[] | { items: ApiCategory[] }>("/categories");
    return asArray<ApiCategory>(data);
  },
  listing: async (query: {
    q?: string;
    categoryId?: string;
    shopId?: string;
    minPrice?: number;
    maxPrice?: number;
    page?: number;
    pageSize?: number;
  }) => {
    const res = await api.get<{ data: ListingCard[]; meta?: PageMeta } | ListingCard[]>(
      "/products/listing",
      {
        query: {
          q: query.q,
          categoryId: query.categoryId,
          shopId: query.shopId,
          minPrice: query.minPrice,
          maxPrice: query.maxPrice,
          page: query.page ?? 1,
          pageSize: query.pageSize ?? 20,
        },
        withMeta: true,
      },
    );
    return parsePage<ListingCard>(res);
  },
  /** Public PDP — ACTIVE products of approved shops only. */
  productDetail: (productId: string) =>
    api.get<PublicProductDetail>(`/products/listing/${productId}`),

  /** Public shop profile — APPROVED + not suspended. */
  shopStorefront: (shopId: string) =>
    api.get<ShopStorefront>(`/shops/${shopId}/storefront`),

  /** @deprecated prefer listing() */
  searchProducts: async (query: {
    q?: string;
    categoryId?: string;
    locale?: string;
    page?: number;
    limit?: number;
    pageSize?: number;
  }) => {
    try {
      return await catalogApi.listing({
        q: query.q,
        categoryId: query.categoryId,
        page: query.page,
        pageSize: query.pageSize ?? query.limit,
      });
    } catch {
      const legacy = await api.get<Paginated<ApiProduct> | ApiProduct[]>("/products/search", {
        query: {
          q: query.q,
          categoryId: query.categoryId,
          locale: query.locale,
          page: query.page,
          limit: query.limit ?? query.pageSize,
        },
      });
      return { items: asArray<ApiProduct>(legacy), meta: undefined };
    }
  },
  /** @deprecated prefer productDetail() for storefront PDP */
  product: (id: string) => api.get<ApiProduct>(`/products/${id}`),
};

export const shopApi = {
  apply: (formData: FormData) => api.postForm<ApiShop>("/shops/apply", formData),
  me: () => api.get<ApiShop>("/shops/me"),
  updateMe: (body: Partial<{ name: string; pickupAddress: string; legalDocumentUrl: string }>) =>
    api.put<ApiShop>("/shops/me", body),
  /** Multipart field `logo` → MinIO WebP (~512×512). Gate: EDIT_SHOP, APPROVED, not suspended. */
  uploadLogo: (file: File) => {
    const fd = new FormData();
    fd.append("logo", file);
    return api.postForm<ApiShop>("/shops/me/logo", fd);
  },
  /** Multipart field `banner` → MinIO WebP (~1600×400). Gate: EDIT_SHOP, APPROVED, not suspended. */
  uploadBanner: (file: File) => {
    const fd = new FormData();
    fd.append("banner", file);
    return api.postForm<ApiShop>("/shops/me/banner", fd);
  },
  listStaff: () => api.get<unknown[]>("/shops/me/staff"),
  addStaff: (body: { userId: string; role?: string }) =>
    api.post("/shops/me/staff", body),
};

export const sellerApi = {
  products: (query?: { page?: number; pageSize?: number; status?: string }) =>
    api.get<ApiProduct[] | { data: ApiProduct[]; meta?: PageMeta } | Paginated<ApiProduct>>(
      "/products",
      { query, withMeta: true },
    ),
  product: (id: string) => api.get<ApiProduct>(`/products/${id}`),
  createProduct: (body: CreateProductRequest) => api.post<ApiProduct>("/products", body),
  updateProduct: (id: string, body: UpdateProductRequest) =>
    api.patch<ApiProduct>(`/products/${id}`, body),
  /** Multipart field `images` (1–10) after product exists → MinIO WebP URLs on product */
  uploadProductImages: (productId: string, files: File[]) => {
    const fd = new FormData();
    files.slice(0, 10).forEach((file) => fd.append("images", file));
    return api.postForm<ApiProduct>(`/products/${productId}/images`, fd);
  },
  deleteProductImages: (productId: string, urls: string[]) =>
    api.delete<ApiProduct>(`/products/${productId}/images`, { body: { urls } }),
  addVariant: (productId: string, body: AddProductVariantRequest) =>
    api.post<ProductVariant>(`/products/${productId}/variants`, body),
  updateVariant: (
    productId: string,
    variantId: string,
    body: UpdateProductVariantRequest,
  ) => api.patch<ProductVariant>(`/products/${productId}/variants/${variantId}`, body),
  uploadVariantImages: (productId: string, variantId: string, files: File[]) => {
    const fd = new FormData();
    files.slice(0, 10).forEach((file) => fd.append("images", file));
    return api.postForm<ProductVariant>(
      `/products/${productId}/variants/${variantId}/images`,
      fd,
    );
  },
  deleteVariantImages: (productId: string, variantId: string, urls: string[]) =>
    api.delete<ProductVariant>(`/products/${productId}/variants/${variantId}/images`, {
      body: { urls },
    }),
  hideProduct: (id: string) => api.post(`/products/${id}/hide`, {}),
  /** HIDDEN → PENDING (re-enter admin review queue) */
  unhideProduct: (id: string) => api.post(`/products/${id}/unhide`, {}),
  landingCost: (productId: string) =>
    api.get("/seller/landing-cost", { query: { product_id: productId, productId } }),
};

export { inventoryApi, adminInventoryApi, transferApi } from "./inventory";
export type {
  Warehouse,
  InventoryVariant,
  InventorySlip,
  InventorySlipItem,
  InventorySlipStatus,
  InventorySlipType,
  StockLedgerEntry,
  CreateWarehouseRequest,
  CreateVariantRequest,
  CreateSlipItemRequest,
  CreateSlipRequest,
  TransferStatus,
  TransferItem,
  InventoryTransfer,
  CreateTransferRequest,
  ReceiveTransferRequest,
  ListTransfersParams,
} from "./inventory";

export {
  adminStaffApi,
  adminPlatformStaffApi,
  hasPendingStaffChange,
  formatPendingRoles,
} from "./staff";
export type {
  CreateStaffRequest,
  CreateStaffResponse,
  UpdateStaffRolesRequest,
  ListStaffParams,
  CreatePlatformStaffRequest,
  UpdatePlatformStaffRolesRequest,
  ListPlatformStaffParams,
} from "./staff";

export { adminBackupApi, adminDsarApi, dsarApi, isBackupInProgress } from "./compliance";
export type {
  ApiBackup,
  BackupStatus,
  ListBackupsParams,
  ApiDsarRequest,
  DsarStatus,
  ListDsarParams,
} from "./compliance";

export {
  adminRbacApi,
  isRbacLockoutCell,
  rbacCellKey,
  RBAC_LOCKOUT_CELLS,
} from "./rbac";
export type {
  RbacRole,
  PermissionScope,
  RbacPermission,
  RbacMatrixCell,
  RbacMatrixData,
  RbacOverrideRow,
  RbacOverrideCellInput,
  PutRbacOverridesBody,
  PutRbacOverridesResult,
  ResetRbacMatrixResult,
} from "./rbac";

export {
  productReviewsApi,
  adminReviewsApi,
  toRatingNumber,
} from "./reviews";
export type {
  ProductReview,
  ProductReviewReply,
  FeaturedReview,
  FeaturedReviewProduct,
  FeaturedReviewsParams,
  ReviewSummary,
  ReviewStatus,
  CreateReviewBody,
  UpdateReviewBody,
  ListProductReviewsParams,
  ListAdminReviewsParams,
} from "./reviews";

export {
  promotionApi,
  adminPromotionApi,
  bannerApi,
  marketingApi,
} from "./promotions";
export type {
  PromotionType,
  PromotionScope,
  PromotionStatus,
  BannerLang,
  Promotion,
  CreatePromotionBody,
  UpdatePromotionBody,
  ListPromotionsParams,
  Banner,
  ListBannersParams,
  MarketingFolder,
  MarketingAsset,
  MarketingFolderDetail,
  CreateMarketingFolderBody,
  UpdateMarketingFolderBody,
} from "./promotions";
export { BANNER_LANGS, BANNER_LANG_LABELS } from "./promotions";

export const adminApi = {
  users: (query?: { page?: number; pageSize?: number; status?: string; q?: string }) =>
    api.get<AuthUser[] | { data: AuthUser[]; meta?: PageMeta } | Paginated<AuthUser>>("/admin/users", {
      query,
      withMeta: true,
    }),
  lockUser: (id: string) => api.post(`/admin/users/${id}/lock`, {}),
  unlockUser: (id: string) => api.post(`/admin/users/${id}/unlock`, {}),
  deleteUser: (id: string) => api.delete(`/admin/users/${id}`),
  shops: (status?: string, page?: number, pageSize?: number) =>
    api.get<ApiShop[] | { data: ApiShop[]; meta?: PageMeta } | Paginated<ApiShop>>("/admin/shops", {
      query: { status, page, pageSize },
      withMeta: true,
    }),
  shop: (id: string) => api.get<ApiShop>(`/admin/shops/${id}`),
  approveShop: (id: string) => api.post(`/admin/shops/${id}/approve`, {}),
  rejectShop: (id: string, body: { reason: string } | { reason: LocalizedText }) =>
    api.post(`/admin/shops/${id}/reject`, body),
  suspendShop: (id: string, body?: { reason?: string | LocalizedText }) =>
    api.post(`/admin/shops/${id}/violation-lock`, body ?? {}),
  /** Only shops with isSuspended (violation-lock). Restores APPROVED. */
  unlockShop: (id: string) => api.post(`/admin/shops/${id}/violation-unlock`, {}),
  products: (status?: string, page?: number, pageSize?: number) =>
    api.get<ApiProduct[] | { data: ApiProduct[]; meta?: PageMeta } | Paginated<ApiProduct>>(
      "/admin/products",
      { query: { status, page, pageSize }, withMeta: true },
    ),
  approveProduct: (id: string) => api.post(`/admin/products/${id}/approve`, {}),
  rejectProduct: (id: string, body: { reason: string } | { reason: LocalizedText }) =>
    api.post(`/admin/products/${id}/reject`, body),
  hideProduct: (id: string) => api.post(`/admin/products/${id}/hide`, {}),
  /** Admin unhide HIDDEN → PENDING (re-enter admin review queue) */
  unhideProduct: (id: string) => api.post(`/admin/products/${id}/unhide`, {}),
  categories: () => catalogApi.categories(),
  createCategory: (body: {
    name: string;
    nameVi?: string;
    nameTw?: string;
    slug?: string;
    parentId?: string | null;
  }) => api.post<ApiCategory>("/admin/categories", body),
  updateCategory: (
    id: string,
    body: { name?: string; nameVi?: string | null; nameTw?: string | null; parentId?: string | null },
  ) => api.patch<ApiCategory>(`/admin/categories/${id}`, body),
  auditLogs: (query?: Record<string, string | number | undefined>) =>
    api.get<
      | ApiAuditLog[]
      | {
          items: ApiAuditLog[];
          total?: number;
          page?: number;
          pageSize?: number;
          meta?: PageMeta;
        }
      | { data: ApiAuditLog[]; meta?: PageMeta }
    >("/admin/audit-logs", {
      query,
      withMeta: true,
    }),
  commissionOverride: (shopId: string, body: { commissionRate: number }) =>
    api.put(`/admin/shops/${shopId}/commission-override`, body),
  createGateway: (body: unknown) => api.post("/admin/payment-gateway-configs", body),
  /** Prefer `bannerApi` from `@/lib/api/promotions`. */
  banners: (query?: { lang?: string; page?: number; pageSize?: number }) =>
    bannerApi.adminList(query as Parameters<typeof bannerApi.adminList>[0]),
  createBanner: (formData: FormData) => bannerApi.adminCreate(formData),
  updateBanner: (id: string, formData: FormData) => bannerApi.adminUpdate(id, formData),
  deleteBanner: (id: string) => bannerApi.adminDelete(id),
};

/**
 * @deprecated Legacy payout-batch / withdraw / gateway-review paths (pre-007).
 * Prefer `financeConfigApi`, `adminPayoutApi`, `landingCostApi`, `financeReportApi`
 * from `@/lib/api/finance`. Wallet withdraw stays out of scope (module 009).
 */
export const financeApi = {
  createPayoutBatch: (body: unknown) => api.post("/finance/payout-batches", body),
  payoutBatches: () => api.get("/finance/payout-batches"),
  approvePayout: (id: string) => api.put(`/finance/payout-batches/${id}/approve`, {}),
  rejectPayout: (id: string, body: { reason: string }) =>
    api.put(`/finance/payout-batches/${id}/reject`, body),
  completePayout: (id: string) =>
    api.put(`/finance/payout-batches/${id}/mark-completed`, {}),
  reviewGateway: (id: string, body: { decision: "APPROVED" | "REJECTED"; reason?: string }) =>
    api.put(`/finance/payment-gateway-configs/${id}/review`, body),
  gateways: () => api.get("/payment-gateway-configs"),
  transactions: (query?: Record<string, string | number>) =>
    api.get("/transactions", { query }),
  exportTransactions: (body?: unknown) => api.post("/transactions/export", body ?? {}),
  withdrawRequests: () => api.get("/finance/withdraw-requests"),
  withdrawDecision: (id: string, body: { decision: "APPROVED" | "REJECTED"; reason?: string }) =>
    api.put(`/finance/withdraw-requests/${id}/decision`, body),
  completeWithdraw: (id: string) =>
    api.put(`/finance/withdraw-requests/${id}/mark-completed`, {}),
};

/** Prefer `marketingApi` from `@/lib/api/promotions`. */
export const cmsApi = {
  folders: (query?: { page?: number; pageSize?: number }) => marketingApi.folders(query),
  folder: (folderId: string) => marketingApi.folder(folderId),
  downloadFolderZip: (folderId: string) => marketingApi.downloadZip(folderId),
};

export const systemApi = {
  approveStaff: (id: string) =>
    api.put(`/super-admin/staff-accounts/${id}/approve`, {}),
  auditLogs: (query?: Record<string, string>) =>
    api.get("/super-admin/audit-logs", { query }),
  startBackup: (body: { backupType: "FULL" | "PARTIAL" }) =>
    api.post("/super-admin/backups", body),
  backups: () => api.get("/super-admin/backups"),
  backup: (id: string) => api.get(`/super-admin/backups/${id}`),
  createAnonymization: (body: { targetUserId: string }) =>
    api.post("/super-admin/anonymization-requests", body),
  executeAnonymization: (id: string) =>
    api.put(`/super-admin/anonymization-requests/${id}/execute`, {}),
};
