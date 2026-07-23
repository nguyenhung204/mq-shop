import { api } from "./client";
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
  WalletBalance,
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
    const data = await api.get<ApiCategory[] | { items: ApiCategory[] }>("/categories", {
      auth: false,
    });
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
        auth: false,
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
    api.get<PublicProductDetail>(`/products/listing/${productId}`, { auth: false }),

  /** Public shop profile — APPROVED + not suspended. */
  shopStorefront: (shopId: string) =>
    api.get<ShopStorefront>(`/shops/${shopId}/storefront`, { auth: false }),

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
        auth: false,
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
  product: (id: string) => api.get<ApiProduct>(`/products/${id}`, { auth: false }),
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

export { inventoryApi, adminInventoryApi } from "./inventory";
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
} from "./inventory";

export { adminStaffApi } from "./staff";
export type {
  CreateStaffRequest,
  CreateStaffResponse,
  UpdateStaffRolesRequest,
  ListStaffParams,
} from "./staff";

export const walletApi = {
  affiliateLink: () => api.get<{ code: string; link?: string }>("/wallet/affiliate-link"),
  networkTree: () => api.get("/wallet/network-tree"),
  commissionStats: () => api.get("/wallet/commission-stats"),
  balance: () => api.get<WalletBalance>("/wallet/balance"),
  requestP2pOtp: (body: { recipient: string; amountPoints: number }) =>
    api.post("/wallet/p2p-transfer/request-otp", body),
  p2pTransfer: (body: {
    recipient: string;
    amountPoints: number;
    password: string;
    otpCode: string;
    idempotencyKey: string;
  }) => api.post("/wallet/p2p-transfer", body),
  withdraw: (body: {
    amountPoints: number;
    bankInfo: { bankName: string; accountNumber: string; accountName: string };
  }) => api.post("/wallet/withdraw", body),
  myWithdrawals: () => api.get("/wallet/withdraw-requests/me"),
};

export const adminApi = {
  users: (query?: { page?: number; pageSize?: number; status?: string }) =>
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
  products: (status?: string, page?: number, pageSize?: number) =>
    api.get<ApiProduct[] | { data: ApiProduct[]; meta?: PageMeta } | Paginated<ApiProduct>>(
      "/admin/products",
      { query: { status, page, pageSize }, withMeta: true },
    ),
  approveProduct: (id: string) => api.post(`/admin/products/${id}/approve`, {}),
  rejectProduct: (id: string, body: { reason: string } | { reason: LocalizedText }) =>
    api.post(`/admin/products/${id}/reject`, body),
  hideProduct: (id: string) => api.post(`/admin/products/${id}/hide`, {}),
  /** Same seller unhide path — HIDDEN → PENDING */
  unhideProduct: (id: string) => api.post(`/products/${id}/unhide`, {}),
  categories: () => catalogApi.categories(),
  createCategory: (body: {
    name: string;
    nameVi?: string;
    slug?: string;
    parentId?: string | null;
  }) => api.post<ApiCategory>("/admin/categories", body),
  updateCategory: (
    id: string,
    body: { name?: string; nameVi?: string | null; parentId?: string | null },
  ) => api.patch<ApiCategory>(`/admin/categories/${id}`, body),
  auditLogs: (query?: Record<string, string | number | undefined>) =>
    api.get<ApiAuditLog[] | { data: ApiAuditLog[]; meta?: PageMeta }>("/admin/audit-logs", {
      query,
      withMeta: true,
    }),
  dailyRefundReport: () => api.get("/admin/finance/daily-refund-report"),
  commissionOverride: (shopId: string, body: { commissionRate: number }) =>
    api.put(`/admin/shops/${shopId}/commission-override`, body),
  createGateway: (body: unknown) => api.post("/admin/payment-gateway-configs", body),
  banners: () => api.get("/admin/banners"),
  createBanner: (body: unknown) => api.post("/admin/banners", body),
  updateBanner: (id: string, body: unknown) => api.put(`/admin/banners/${id}`, body),
  createMaterial: (body: unknown) => api.post("/admin/marketing-materials", body),
};

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

export const cmsApi = {
  materials: (folder?: string) =>
    api.get("/marketing-materials", { query: { folder } }),
  downloadMaterials: (folder: string) =>
    api.get("/marketing-materials/download", { query: { folder } }),
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
