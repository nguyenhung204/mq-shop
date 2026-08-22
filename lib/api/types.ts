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
  /** Non-NONE permission codes from the RBAC matrix (incl. Super Admin overrides). */
  permissions?: string[];
  /** Effective scope per granted permission (NONE omitted). */
  permissionScopes?: Record<string, "NONE" | "APPROVE" | "SELF" | "SHOP" | "ALL">;
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
  /** Display name of the shop — present when BE listing includes it. */
  shopName?: string | null;
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
  /** Country codes where this product is available. */
  countryCodes?: string[];
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
  isEnrollmentPackage?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

/** Public PDP variant — omits shop-only fields. */
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
  contactEmail?: string | null;
};

/** Nested on PDP — GET /products/listing/:productId */
export type ProductShopSummary = {
  id: string;
  name: string;
  logoUrl: string | null;
  contactEmail?: string | null;
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
  /** Country codes where this product is available. */
  countryCodes?: string[];
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
  /** ISO country codes where this product should be visible. */
  countryCodes?: string[];
};

export type UpdateProductRequest = {
  title?: string;
  description?: string;
  categoryId?: string;
  attributes?: Record<string, unknown> | null;
  /** ISO country codes where this product should be visible. */
  countryCodes?: string[];
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

export type ShopStatus = "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";

export type ApiShop = {
  id: string;
  ownerId?: string;
  ownerName?: string | null;
  ownerEmail?: string | null;
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
  /** Optional payment QR image URL for buyer checkout. */
  qrUrl?: string | null;
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
  /**
   * Human-readable names resolved by BE for IDs in `meta`.
   * Keys: orderCode, shopName, userName.
   * Use these for display instead of slicing raw UUIDs.
   */
  metaNames?: Record<string, string> | null;
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
  | "SHOP_BANK_INFO_SETUP"
  | "SHOP_BANK_INFO_REMINDER"
  | "SELLER_PAYOUT_COMPLETED"
  | "SELLER_PAYOUT_REJECTED"
  | "PRODUCT_APPROVED"
  | "PRODUCT_REJECTED"
  | "PRODUCT_HIDDEN"
  | "ORDER_STATUS_UPDATED"
  | "ORDER_NEW"
  | "ORDER_CANCELLED"
  | "ORDER_CREATED_BY_ADMIN"
  | "ORDER_CREATED_PAYMENT_NEEDED"
  | "ORDER_PAYMENT_PROOF_UPLOADED"
  | "ORDER_PAYMENT_CONFIRMED"
  | "ORDER_PAYMENT_REJECTED"
  | "ORDER_PAYMENT_ESCALATED"
  | "ORDER_PAYMENT_DISPUTED"
  | "ORDER_FULFILLMENT_ESCALATED"
  | "RMA_NEW"
  | "RMA_APPROVED"
  | "RMA_REJECTED"
  | "RMA_REFUND_COMPLETED"
  | "RMA_APPROVED_EXTERNAL_REFUND"
  | "RMA_RETURN_SHIPPED"
  | "RMA_RETURN_RECEIVED"
  | "RMA_RETURN_REJECTED"
  | "RMA_DISPUTED"
  | "RMA_REFUND_PENDING"
  | "RMA_REFUND_SENT"
  | "RMA_GOODS_RETURN_PENDING"
  | "RMA_GOODS_RETURN_SHIPPED"
  | "RMA_GOODS_RETURN_ISSUE"
  | "RMA_CLOSED"
  | "RMA_ESCALATED"
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
  | "COMMISSION_REFERRAL_SKIPPED_NOT_BUYER"
  | "COMMISSION_JOB_FAILED"
  | "MLM_RANK_UPDATED"
  | "MLM_RANK_UPGRADED"
  | "MLM_REFERRER_UPDATED"
  | "MLM_DOWNLINE_ASSIGNED"
  | "MLM_REFERRAL_RATE_UPDATED"
  | "INVENTORY_SLIP_PENDING"
  | "INVENTORY_SLIP_APPROVED"
  | "INVENTORY_SLIP_REJECTED"
  | "INVENTORY_TRANSFER_PENDING"
  | "INVENTORY_TRANSFER_APPROVED"
  | "INVENTORY_TRANSFER_RECEIVED";

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

export type ApiErrorBody = {
  message?: string | string[];
  statusCode?: number;
  error?: string;
  data?: { code?: string; [key: string]: unknown };
};
