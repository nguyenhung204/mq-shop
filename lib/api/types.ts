/** Shared API types aligned with FE_API_CONTRACTS.md */

export type Locale = "vi" | "en" | "zh-TW" | "zh_TW";

export type Role = "BUYER" | "SELLER" | "ADMIN" | "SUPER_ADMIN";

export type LocalizedText = {
  vi: string;
  en?: string;
  "zh-TW"?: string;
};

export type AuthUser = {
  id: string;
  email: string;
  phone?: string | null;
  fullName?: string | null;
  avatarUrl?: string | null;
  dateOfBirth?: string | null;
  status?: string;
  roles: Role[];
  permissions: string[];
  emailVerifiedAt?: string | null;
  createdAt?: string;
};

export type LoginResponse = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
};

export type Paginated<T> = {
  page: number;
  limit: number;
  total: number;
  items: T[];
};

export type ApiProduct = {
  id: string;
  slug?: string;
  sku: string;
  priceUsd: string | number;
  stockSummary?: string | null;
  status: "PENDING" | "ACTIVE" | "REJECTED";
  isHidden?: boolean;
  isOutOfStock?: boolean;
  restockingOverlay?: boolean;
  categoryId?: string;
  shopId?: string;
  name?: string;
  description?: string | null;
  images?: { url: string; sortOrder?: number }[];
  translations?: { locale: string; name: string; description?: string }[];
  rejectionReason?: LocalizedText | null;
};

export type ApiCategory = {
  id: string;
  name: string;
  slug?: string;
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
  name: string;
  taxCode: string;
  countryCode: string;
  pickupAddress: string;
  legalDocumentUrl?: string;
  status: ShopStatus;
  rejectionReason?: LocalizedText | null;
};

export type ApiNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  payload?: Record<string, unknown>;
  readAt?: string | null;
  createdAt: string;
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
};
