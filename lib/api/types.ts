/** Shared API types aligned with docs/frontend-integration.md */

export type Locale = "vi" | "en" | "zh-TW" | "zh_TW";

export type Role =
  | "BUYER"
  | "SELLER"
  | "WAREHOUSE"
  | "ADMIN"
  | "SUPER_ADMIN"
  | "ACCOUNTANT";

export type LocalizedText = {
  vi: string;
  en?: string;
  zh?: string;
  "zh-TW"?: string;
};

export type PageMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type AuthUser = {
  id: string;
  email: string;
  phone?: string | null;
  fullName?: string | null;
  avatarUrl?: string | null;
  dateOfBirth?: string | null;
  status?: "ACTIVE" | "LOCKED" | "DELETED" | string;
  roles: Role[];
  permissions?: string[];
  emailVerifiedAt?: string | null;
  createdAt?: string;
};

export type LoginResponse = {
  user: AuthUser;
  accessToken?: string;
  refreshToken?: string;
};

export type Paginated<T> = {
  page?: number;
  limit?: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
  items: T[];
  meta?: PageMeta;
};

export type ListingCard = {
  id: string;
  title: string;
  /** Derived min variant price (backward-friendly). */
  price: number;
  minPrice?: number;
  maxPrice?: number;
  thumbnailUrl: string | null;
  /** Sum of variant availableStock. */
  stock: number;
  displayMode: "NORMAL" | "OUT_OF_STOCK_WATERMARK";
  watermarkText: null | { vi: string; zh: string; en: string };
};

export type ProductVariant = {
  id: string;
  productId: string;
  shopId?: string;
  sku: string;
  /** Sell price (source of truth for checkout). */
  sellingPrice: number;
  availableStock: number;
  options?: Record<string, string> | null;
  images?: string[];
  costPrice?: number | null;
  isEnrollmentPackage?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

/** Public PDP variant — omits costPrice / shop-only fields. */
export type PublicProductVariant = {
  id: string;
  productId: string;
  sku: string;
  sellingPrice: number;
  availableStock: number;
  options: Record<string, string> | null;
  images: string[];
  isEnrollmentPackage?: boolean;
};

/** GET /products/listing/:productId */
export type PublicProductDetail = {
  id: string;
  shopId?: string;
  title: string;
  description?: string | null;
  categoryId?: string;
  price: number;
  minPrice: number;
  maxPrice: number;
  stock: number;
  images: string[];
  attributes?: Record<string, unknown> | null;
  variants: PublicProductVariant[];
  displayMode: "NORMAL" | "OUT_OF_STOCK_WATERMARK";
  watermarkText: null | { vi: string; zh: string; en: string };
  createdAt?: string;
  updatedAt?: string;
};

export type ApiProduct = {
  id: string;
  slug?: string;
  shopId?: string;
  title?: string;
  name?: string;
  description?: string | null;
  categoryId?: string;
  /** Derived: min(variant.sellingPrice) — read-only convenience. */
  price?: number;
  minPrice?: number;
  maxPrice?: number;
  priceUsd?: string | number;
  /** Derived: sum(variant.availableStock). */
  stock?: number;
  /** @deprecated prefer variants[].sku */
  sku?: string | null;
  images?: string[] | { url: string; sortOrder?: number }[];
  attributes?: Record<string, unknown> | null;
  status: "PENDING" | "ACTIVE" | "REJECTED" | "HIDDEN";
  rejectionReason?: string | LocalizedText | null;
  variants?: ProductVariant[];
  isHidden?: boolean;
  isOutOfStock?: boolean;
  restockingOverlay?: boolean;
  stockSummary?: string | null;
  translations?: { locale: string; name: string; description?: string }[];
  createdAt?: string;
  updatedAt?: string;
};

export type CreateProductRequest = {
  title: string;
  description: string;
  categoryId: string;
  attributes?: Record<string, unknown>;
  variants: Array<{
    sku: string;
    sellingPrice: number;
    options?: Record<string, string>;
  }>;
};

export type UpdateProductRequest = {
  title?: string;
  description?: string;
  categoryId?: string;
  attributes?: Record<string, unknown> | null;
};

export type AddProductVariantRequest = {
  sku: string;
  sellingPrice: number;
  options?: Record<string, string>;
};

export type UpdateProductVariantRequest = {
  sellingPrice?: number;
  options?: Record<string, string> | null;
};

export type ApiCategory = {
  id: string;
  slug: string;
  /** English (default) display name */
  name: string;
  nameVi?: string;
  /** Traditional Chinese — optional until BE ships the field */
  nameZhTw?: string | null;
  parentId?: string | null;
};

export type ApiBanner = {
  id: string;
  imageUrl: string;
  targetUrl: string;
  locale: string;
  title: string;
  displayOrder: number;
  isActive: boolean;
};

export type CartItem = {
  id: string;
  productId: string;
  quantity: number;
  product?: ApiProduct;
  unitPriceUsd?: string | number;
};

export type Cart = {
  id?: string;
  shopId?: string | null;
  items: CartItem[];
};

export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "EXPIRED";

export type PaymentStatus = "UNPAID" | "PAID" | "FAILED" | "REFUND_PENDING";
export type PaymentMethod = "COD" | "BANK_TRANSFER" | "CARD";

export type ApiOrder = {
  id: string;
  shopId: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  totalAmountUsd: string | number;
  shippingFeeUsd?: string | number;
  shippingAddress: string;
  createdAt: string;
  items?: {
    sku: string;
    quantity: number;
    unitPriceUsd: string | number;
    productId?: string;
    name?: string;
  }[];
};

export type RmaStatus =
  | "REQUESTED"
  | "APPROVED"
  | "REJECTED"
  | "STOCK_RETURNED"
  | "WITHDRAWN";

export type ApiRma = {
  id: string;
  orderId: string;
  status: RmaStatus;
  reason: string;
  evidenceUrls?: string[];
  autoApproveAt?: string;
  requestedAt?: string;
};

export type ShopStatus = "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";

export type ApiShop = {
  id: string;
  ownerId?: string;
  name: string;
  taxId?: string;
  taxCode?: string;
  countryCode: string;
  documentUrl?: string;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  pickupAddress?: string;
  legalDocumentUrl?: string;
  status: ShopStatus;
  rejectionReason?: string | LocalizedText | null;
  violationFlag?: boolean;
  isSuspended?: boolean;
  contactAdminRequired?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type ApiNotification = {
  id: string;
  userId?: string;
  type?: string;
  title: string;
  body: string;
  payload?: Record<string, unknown>;
  readAt?: string | null;
  createdAt: string;
};

export type ApiAuditLog = {
  id: string;
  ts: string;
  level: "info" | "warn" | "error";
  /** Technical code — keep for filters (e.g. admin.shop.approve) */
  action: string;
  outcome: "success" | "failure" | "denied";
  /** Human-readable English fields from BE */
  title?: string;
  summary?: string;
  category?: string;
  outcomeLabel?: string;
  actor: { id: string | null; email: string | null };
  resource: { type: string | null; id: string | null };
  reason: string | null;
  meta?: Record<string, unknown>;
};

export type WalletBalance = {
  available: string | number;
  frozen: string | number;
  pointUsdRate?: string | number;
};

export type ApiErrorBody = {
  message?: string | string[];
  statusCode?: number;
  error?: string;
  data?: { code?: string; [key: string]: unknown };
};
