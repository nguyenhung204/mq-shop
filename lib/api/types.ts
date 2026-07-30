/** Shared API types aligned with docs/frontend-integration.md */

export type Locale = "vi" | "en" | "zh-TW" | "zh_TW";

export type Role =
  | "BUYER"
  | "SELLER"
  | "WAREHOUSE"
  | "CS"
  | "ADMIN"
  | "SUPER_ADMIN"
  | "ACCOUNTANT";

export type StaffRole = "WAREHOUSE" | "CS" | "ACCOUNTANT";

/** Roles returned / filterable on GET /admin/staff pool. */
export type StaffPoolRole = "BUYER" | StaffRole;

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
  status?: "ACTIVE" | "LOCKED" | "DELETED" | "PENDING" | string;
  roles: Role[];
  /** Dual-control (008): roles awaiting Super Admin approval. */
  pendingRoles?: Role[] | null;
  permissions?: string[];
  /** Present for shop staff (WAREHOUSE / CS / ACCOUNTANT). */
  shopId?: string | null;
  emailVerifiedAt?: string | null;
  createdAt?: string;
  /** Direct upline (MLM 009). */
  referrerId?: string | null;
  /** Shareable referral code. */
  referralCode?: string | null;
  /** MLM rank 1–10. */
  mlmRank?: number | null;
  /**
   * Optional override for referral commission % (0–10).
   * `null` / omitted → use rank table default.
   */
  referralRateOverride?: string | number | null;
  /** Gate P2P / withdraw until PIN is set. */
  hasWalletPin?: boolean;
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
  shopId?: string;
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
  /** ISO-8601 — present when BE listing includes it. */
  createdAt?: string;
  /** Product reviews (011). */
  ratingAvg?: number | string | null;
  reviewCount?: number | null;
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

/** GET /shops/:shopId/storefront */
export type ShopStorefront = {
  id: string;
  name: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  countryCode: string;
};

/** Nested on PDP — GET /products/listing/:productId */
export type ProductShopSummary = {
  id: string;
  name: string;
  logoUrl: string | null;
};

/** GET /products/listing/:productId */
export type PublicProductDetail = {
  id: string;
  shopId?: string;
  /** Present when shop is public; otherwise null (shopId still set). */
  shop?: ProductShopSummary | null;
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
  /** Product reviews (011). */
  ratingAvg?: number | string | null;
  reviewCount?: number | null;
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
  /** Traditional Chinese (name_tw column). */
  nameTw?: string | null;
  /** @deprecated alias — use `nameTw` */
  nameZhTw?: string | null;
  parentId?: string | null;
};

/** @deprecated Prefer `Banner` from `@/lib/api/promotions`. */
export type ApiBanner = {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl: string | null;
  lang: "VI" | "EN" | "TW" | "ALL";
  sortOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
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

/** @deprecated Prefer OrderView / PaymentMethod from `@/lib/api/orders`. */
export type OrderStatus =
  | "PENDING"
  | "PAID"
  | "CONFIRMED"
  | "PACKED"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUND_APPROVED"
  | "REFUNDED"
  | "PROCESSING"
  | "EXPIRED";

export type PaymentStatus = "UNPAID" | "PAID" | "FAILED" | "REFUND_PENDING";
/** @deprecated Prefer COD | MOCK from `@/lib/api/orders`. */
export type PaymentMethod = "COD" | "MOCK" | "BANK_TRANSFER" | "CARD";

/** @deprecated Prefer OrderView from `@/lib/api/orders`. */
export type ApiOrder = {
  id: string;
  code?: string;
  shopId: string;
  buyerId?: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus?: PaymentStatus;
  total?: number;
  totalAmountUsd?: string | number;
  subtotal?: number;
  shippingFee?: number;
  shippingFeeUsd?: string | number;
  currency?: string;
  shippingAddress: string | Record<string, unknown>;
  createdAt: string;
  deliveredAt?: string | null;
  items?: {
    id?: string;
    sku: string;
    quantity: number;
    unitPrice?: number;
    unitPriceUsd?: string | number;
    titleSnapshot?: string;
    productId?: string;
    name?: string;
    lineTotal?: number;
    variantId?: string;
  }[];
};

export type RmaStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CLOSED"
  | "REQUESTED"
  | "STOCK_RETURNED"
  | "WITHDRAWN";

export type ApiRma = {
  id: string;
  orderId: string;
  status: RmaStatus;
  reason: string;
  evidenceUrls?: string[];
  bankInfo?: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
  reviewNote?: string | null;
  autoApproveAt?: string;
  requestedAt?: string;
  createdAt?: string;
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
  bankInfo?: ShopBankInfo | null;
  createdAt?: string;
  updatedAt?: string;
};

export type ShopBankInfo = {
  bankName: string;
  accountNumber: string;
  accountName: string;
};

export type ApiNotification = {
  id: string;
  userId?: string;
  /** Deep-link discriminator from BE. Unknown → treat as GENERIC. */
  type?: NotificationType | string;
  title: string;
  body: string;
  /** String map of ids / status / amounts for routing. */
  meta?: Record<string, string> | null;
  /** @deprecated Prefer `meta` — kept for older payloads. */
  payload?: Record<string, unknown>;
  readAt?: string | null;
  createdAt: string;
};

/** Mirrors BE `NotificationType` — FE owns the route table. */
export type NotificationType =
  | "GENERIC"
  | "ACCOUNT_LOCKED"
  | "ACCOUNT_UNLOCKED"
  | "ACCOUNT_DELETED"
  | "STAFF_ROLE_ASSIGNED"
  | "PLATFORM_ADMIN_ACCOUNT"
  | "DSAR_REQUEST_NEW"
  | "REFERRAL_DOWNLINE_JOINED"
  | "SHOP_APPLICATION_NEW"
  | "SHOP_APPROVED"
  | "SHOP_REJECTED"
  | "SHOP_SUSPENDED"
  | "SHOP_REINSTATED"
  | "PRODUCT_APPROVED"
  | "PRODUCT_REJECTED"
  | "PRODUCT_HIDDEN"
  | "ORDER_STATUS_UPDATED"
  | "ORDER_NEW"
  | "ORDER_CANCELLED"
  | "ORDER_CREATED_BY_ADMIN"
  | "ORDER_CREATED_PAYMENT_NEEDED"
  | "RMA_NEW"
  | "RMA_APPROVED"
  | "RMA_REJECTED"
  | "RMA_REFUND_COMPLETED"
  | "RMA_APPROVED_EXTERNAL_REFUND"
  | "REVIEW_NEW"
  | "REVIEW_SELLER_REPLIED"
  | "REVIEW_HIDDEN"
  | "REVIEW_UNHIDDEN"
  | "PROMOTION_APPROVED"
  | "PROMOTION_REJECTED"
  | "WALLET_PIN_UPDATED"
  | "WALLET_TRANSFER_SENT"
  | "WALLET_TRANSFER_RECEIVED"
  | "WALLET_ADJUSTED"
  | "WALLET_WITHDRAW_REQUESTED"
  | "WALLET_WITHDRAW_NEW"
  | "WALLET_WITHDRAW_APPROVED"
  | "WALLET_WITHDRAW_REJECTED"
  | "WALLET_WITHDRAW_COMPLETED"
  | "WALLET_WITHDRAW_PAY_FAILED"
  | "WALLET_WITHDRAW_STAFF_APPROVED"
  | "WALLET_WITHDRAW_STAFF_REJECTED"
  | "WALLET_WITHDRAW_STAFF_PROCESSED"
  | "WALLET_WITHDRAW_STAFF_PAY_FAILED"
  | "COMMISSION_REFERRAL_CREDITED"
  | "COMMISSION_TEAM_CREDITED"
  | "COMMISSION_GLOBAL_CREDITED"
  | "COMMISSION_LOYALTY_CREDITED"
  | "COMMISSION_REFERRAL_TRIGGERED"
  | "COMMISSION_REFERRAL_SKIPPED_NOT_SELLER"
  | "COMMISSION_JOB_FAILED"
  | "MLM_RANK_UPDATED"
  | "MLM_RANK_UPGRADED"
  | "MLM_REFERRER_UPDATED"
  | "MLM_DOWNLINE_ASSIGNED"
  | "MLM_REFERRAL_RATE_UPDATED";

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
  actor: { id: string | null; email: string | null; ip?: string | null };
  resource: { type: string | null; id: string | null };
  reason: string | null;
  beforeJson?: unknown;
  afterJson?: unknown;
  meta?: Record<string, unknown>;
};

/**
 * @deprecated Prefer `Wallet` from `@/lib/api/wallet` (`availableBalance` / `frozenBalance`).
 */
export type WalletBalance = {
  available: string | number;
  frozen: string | number;
  availableBalance?: string | number;
  frozenBalance?: string | number;
  pointUsdRate?: string | number;
};

export type ApiErrorBody = {
  message?: string | string[];
  statusCode?: number;
  error?: string;
  data?: { code?: string; [key: string]: unknown };
};
