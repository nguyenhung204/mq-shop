import { api } from "./client";
import type {
  ApiAuditLog,
  ApiBanner,
  ApiCategory,
  ApiOrder,
  ApiProduct,
  ApiRma,
  ApiShop,
  AuthUser,
  Cart,
  ListingCard,
  LocalizedText,
  PageMeta,
  Paginated,
  PaymentMethod,
  WalletBalance,
} from "./types";
import { asArray } from "./utils";

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
          page: query.page ?? 1,
          pageSize: query.pageSize ?? 20,
        },
        withMeta: true,
      },
    );
    if (Array.isArray(res)) {
      return { items: res, meta: undefined as PageMeta | undefined };
    }
    const wrapped = res as { data: ListingCard[]; meta?: PageMeta };
    return {
      items: asArray<ListingCard>(wrapped.data ?? wrapped),
      meta: wrapped.meta,
    };
  },
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
  product: (id: string) => api.get<ApiProduct>(`/products/${id}`, { auth: false }),
  banners: (locale: string) =>
    api.get<ApiBanner[]>("/banners", { auth: false, query: { locale } }),
};

export const cartApi = {
  get: () => api.get<Cart>("/cart"),
  addItem: (body: { productId: string; quantity: number }) =>
    api.post<Cart>("/cart/items", body),
  updateItem: (id: string, body: { quantity: number }) =>
    api.put<Cart>(`/cart/items/${id}`, body),
  removeItem: (id: string) => api.delete<Cart>(`/cart/items/${id}`),
  clear: () => api.delete<Cart>("/cart"),
};

export const orderApi = {
  checkout: (body: {
    paymentMethod: PaymentMethod;
    shippingAddress: string;
    shippingCountry?: string;
    cartItemIds?: string[];
  }) => api.post<ApiOrder>("/checkout", body),
  myOrders: () => api.get<ApiOrder[] | Paginated<ApiOrder>>("/orders/me"),
  get: (id: string) => api.get<ApiOrder>(`/orders/${id}`),
  cancel: (id: string, body: { reason: string }) =>
    api.put<ApiOrder>(`/orders/${id}/cancel`, body),
  createRma: (
    orderId: string,
    body: { reason: string; evidenceUrls?: string[]; refundAccountInfo?: string },
  ) => api.post<ApiRma>(`/orders/${orderId}/rma`, body),
  myRma: () => api.get<ApiRma[] | Paginated<ApiRma>>("/rma/me"),
  getRma: (id: string) => api.get<ApiRma>(`/rma/${id}`),
  withdrawRma: (id: string) => api.put<ApiRma>(`/rma/${id}/withdraw`, {}),
};

export const shopApi = {
  apply: (formData: FormData) => api.postForm<ApiShop>("/shops/apply", formData),
  me: () => api.get<ApiShop>("/shops/me"),
  updateMe: (body: Partial<{ name: string; pickupAddress: string; legalDocumentUrl: string }>) =>
    api.put<ApiShop>("/shops/me", body),
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
  /** Multipart field `images` (1–10 files) → MinIO WebP URLs */
  uploadImages: (files: File[]) => {
    const fd = new FormData();
    files.slice(0, 10).forEach((file) => fd.append("images", file));
    return api.postForm<{ urls: string[] }>("/products/images", fd);
  },
  createProduct: (body: unknown) => api.post<ApiProduct>("/products", body),
  updateProduct: (id: string, body: unknown) => api.patch<ApiProduct>(`/products/${id}`, body),
  hideProduct: (id: string) => api.post(`/products/${id}/hide`, {}),
  /** HIDDEN → PENDING (re-enter admin review queue) */
  unhideProduct: (id: string) => api.post(`/products/${id}/unhide`, {}),
  orders: () => api.get<ApiOrder[] | Paginated<ApiOrder>>("/seller/orders"),
  rma: () => api.get<ApiRma[] | Paginated<ApiRma>>("/seller/rma"),
  confirmStockReturn: (
    id: string,
    body: {
      warehouseId: string;
      sku: string;
      quantity: number;
      kind: "RETURNED" | "NEW";
      note?: string;
    },
  ) => api.put(`/seller/rma/${id}/confirm-stock-return`, body),
  inventoryRequests: (status?: string) =>
    api.get("/seller/inventory/requests", { query: { status } }),
  approveInventory: (id: string) =>
    api.put(`/seller/inventory/requests/${id}/approve`, {}),
  rejectInventory: (id: string, body: { reason: string }) =>
    api.put(`/seller/inventory/requests/${id}/reject`, body),
  landingCost: (productId: string) =>
    api.get("/seller/landing-cost", { query: { product_id: productId, productId } }),
};

export const inventoryApi = {
  warehouses: () => api.get("/warehouses"),
  createWarehouse: (body: {
    name: string;
    addressText: string;
    googleMapsUrl?: string;
  }) => api.post("/warehouses", body),
  updateWarehouse: (id: string, body: unknown) => api.put(`/warehouses/${id}`, body),
  list: (query?: { is_low_stock?: boolean }) => api.get("/inventory", { query }),
  createRequest: (body: {
    warehouseId: string;
    sku: string;
    quantity: number;
    requestType: "IN" | "ADJUST_IN" | "ADJUST_OUT";
    reason?: string;
    evidenceDocumentUrl?: string;
  }) => api.post("/inventory/requests", body),
  requests: () => api.get("/inventory/requests"),
};

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
  createStaff: (body: unknown) => api.post("/admin/staff-accounts", body),
  assignPermissions: (id: string, body: { permissions: string[] }) =>
    api.put(`/admin/staff-accounts/${id}/permissions`, body),
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
  forceCancelOrder: (id: string, body?: { reason?: string }) =>
    api.put(`/admin/orders/${id}/force-cancel`, body ?? {}),
  confirmCod: (id: string) => api.put(`/admin/orders/${id}/confirm-cod`, {}),
  dailyRefundReport: () => api.get("/admin/finance/daily-refund-report"),
  rma: () => api.get("/admin/rma"),
  rmaDecision: (id: string, body: { decision: "APPROVED" | "REJECTED"; reason?: string }) =>
    api.put(`/admin/rma/${id}/decision`, body),
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
