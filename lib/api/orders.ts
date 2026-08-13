import { api } from "./client";
import type { PageMeta, Paginated } from "./types";

export type OrderStatus =
  | "PENDING"
  | "PAID"
  | "CONFIRMED"
  | "PACKED"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUND_APPROVED"
  | "REFUNDED";

/**
 * Prefer OFF_PLATFORM for bank-transfer / off-platform settlement.
 * COD kept for backward compatibility (same PENDING flow as OFF_PLATFORM).
 * MOCK kept for admin place-order / dev.
 */
export type PaymentMethod = "OFF_PLATFORM" | "COD" | "MOCK";

export type ShopPaymentProfile = {
  shopId: string;
  shopName: string;
  bankName: string | null;
  accountNumber: string | null;
  accountName: string | null;
  qrUrl?: string | null;
};

export type RmaStatus =
  | "PENDING"
  | "REQUESTED"
  | "APPROVED"
  | "REJECTED"
  | "RETURN_SHIPPED"
  | "RETURN_RECEIVED"
  | "RETURN_REJECTED"
  | "DISPUTED"
  | "REFUND_PENDING"
  | "REFUND_SENT"
  | "CLOSED"
  | "COMPLETED";

export type ShippingAddress = {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  district?: string;
  postalCode?: string;
  country?: string;
};

export type OrderLineItem = {
  variantId: string;
  quantity: number;
};

export type ShippingQuoteRequest = {
  items: OrderLineItem[];
  shippingAddress: ShippingAddress;
};

export type ShippingQuoteView = {
  shopId: string;
  itemCount: number;
  shippingFee: number;
  currency: "TWD";
};

export type CheckoutRequest = {
  items: OrderLineItem[];
  shippingAddress: ShippingAddress;
  paymentMethod: PaymentMethod;
  note?: string;
  displayCurrency?: string;
  /** asOf from GET /fx/rates at checkout confirm */
  fxAsOf?: string;
};

export type AdminCheckoutRequest = CheckoutRequest & {
  buyerId: string;
};

export type AdminShippingQuoteRequest = ShippingQuoteRequest & {
  buyerId: string;
};

export type OrderItemView = {
  id: string;
  variantId: string;
  warehouseId?: string;
  productId: string;
  sku: string;
  titleSnapshot: string;
  /** First variant/product image at checkout time; null on legacy rows. */
  imageSnapshot: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
};

export type RmaBankInfo = {
  bankName: string;
  accountNumber: string;
  accountName: string;
};

export type CreateRmaRequest = {
  reason: string;
  bankInfo: RmaBankInfo;
};

export type RmaView = {
  id: string;
  orderId: string;
  /** Human-readable order name (e.g. "ORD-20260801-E249"). Use for display instead of orderId. */
  orderName?: string | null;
  buyerId?: string;
  buyerName?: string | null;
  shopId?: string;
  shopName?: string | null;
  status: RmaStatus;
  reason: string;
  evidenceUrls: string[];
  bankInfo: RmaBankInfo;
  reviewerId?: string | null;
  reviewNote: string | null;
  decidedAt: string | null;
  returnTrackingCode?: string | null;
  returnCarrier?: string | null;
  returnShippedAt?: string | null;
  returnReceivedAt?: string | null;
  inspectionNote?: string | null;
  disputeReason?: string | null;
  disputedAt?: string | null;
  statusChangedAt?: string | null;
  escalatedAt?: string | null;
  refundProofUrl?: string | null;
  refundProofUploadedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
};

/** GET /admin/rma/:rmaId — PROCESS_RMA review scope. */
export type AdminRmaDetailView = RmaView & {
  orderCode: string | null;
  orderName?: string | null;
  orderStatus: OrderStatus | null;
  buyerName?: string | null;
  shopName?: string | null;
};

export type OrderView = {
  id: string;
  code: string;
  /**
   * Human-readable display name derived from order items.
   * "Nike Air Force 1" for single-item orders,
   * "Nike Air Force 1 và N sản phẩm khác" for multi-item orders.
   * Prefer this over `code` for user-facing labels.
   */
  displayName: string;
  buyerId: string;
  buyerName?: string | null;
  buyerEmail?: string | null;
  shopId: string;
  shopName?: string | null;
  status: OrderStatus;
  subtotal: number;
  shippingFee: number;
  total: number;
  currency: "TWD";
  displayCurrency?: string | null;
  fxRate?: number | null;
  fxAsOf?: string | null;
  displayTotal?: number | null;
  paymentMethod: PaymentMethod;
  /** Buyer-uploaded bank-transfer proof (OFF_PLATFORM / legacy COD). */
  paymentProofUrl?: string | null;
  paymentProofUploadedAt?: string | null;
  paymentRejectedReason?: string | null;
  /** Set when stale proof review is escalated to admin/CS. */
  paymentEscalatedAt?: string | null;
  /** Set when paid fulfillment is escalated for no shipping progress. */
  fulfillmentEscalatedAt?: string | null;
  shippingAddress: ShippingAddress;
  items: OrderItemView[];
  cancelReason: string | null;
  paidAt: string | null;
  deliveredAt: string | null;
  /** Latest RMA for this order when BE includes it; null/undefined if none. */
  rma?: RmaView | null;
  createdAt: string;
  updatedAt: string;
};

export type OrderListView = "buyer" | "shop";

export type ListOrdersParams = {
  status?: OrderStatus;
  page?: number;
  pageSize?: number;
  /** buyer = purchases; shop = seller inbox. */
  view?: OrderListView;
};

export type AdminListOrdersParams = ListOrdersParams & {
  shopId?: string;
  paymentEscalated?: boolean;
};

export type UpdateOrderStatusRequest = {
  status: "CONFIRMED" | "PACKED" | "SHIPPED" | "DELIVERED";
  note?: string;
};

type PageEnvelope<T> = T[] | { data: T[]; meta?: PageMeta } | Paginated<T>;

export const orderApi = {
  shippingQuote: (body: ShippingQuoteRequest) =>
    api.post<ShippingQuoteView>("/orders/shipping-quote", body),

  checkout: (body: CheckoutRequest, idempotencyKey: string) =>
    api.post<OrderView>("/orders/checkout", body, {
      headers: { "Idempotency-Key": idempotencyKey },
    }),

  list: (query?: ListOrdersParams) =>
    api.get<PageEnvelope<OrderView>>("/orders", { query, withMeta: true }),

  get: (orderId: string) => api.get<OrderView>(`/orders/${orderId}`),

  updateStatus: (orderId: string, body: UpdateOrderStatusRequest) =>
    api.patch<OrderView>(`/orders/${orderId}/status`, body),

  cancel: (orderId: string, body: { reason: string }) =>
    api.post<OrderView>(`/orders/${orderId}/cancel`, body),

  createRma: (orderId: string, body: CreateRmaRequest) =>
    api.post<RmaView>(`/orders/${orderId}/rma`, body),

  uploadRmaEvidence: (rmaId: string, files: File[]) => {
    const fd = new FormData();
    files.slice(0, 5).forEach((file) => fd.append("images", file));
    return api.postForm<RmaView>(`/rma/${rmaId}/evidence`, fd);
  },

  removeRmaEvidence: (rmaId: string, urls: string[]) =>
    api.delete<RmaView>(`/rma/${rmaId}/evidence`, { body: { urls } }),

  listShopRma: (query?: {
    status?: RmaStatus;
    escalated?: boolean;
    page?: number;
    pageSize?: number;
  }) => api.get<PageEnvelope<RmaView>>("/rma", { query, withMeta: true }),

  listMyRma: (query?: { status?: RmaStatus; page?: number; pageSize?: number }) =>
    api.get<PageEnvelope<RmaView>>("/rma/mine", { query, withMeta: true }),

  getRma: (rmaId: string) => api.get<AdminRmaDetailView>(`/rma/${rmaId}`),

  approveRma: (rmaId: string, body?: { note?: string }) =>
    api.post<RmaView>(`/rma/${rmaId}/approve`, body ?? {}),

  rejectRma: (rmaId: string, body: { note: string }) =>
    api.post<RmaView>(`/rma/${rmaId}/reject`, body),

  markReturnShipped: (
    rmaId: string,
    body: { trackingCode: string; carrier?: string; note?: string },
  ) => api.post<RmaView>(`/rma/${rmaId}/return-shipped`, body),

  markReturnReceived: (rmaId: string, body?: { note?: string }) =>
    api.post<RmaView>(`/rma/${rmaId}/return-received`, body ?? {}),

  acceptReturn: (rmaId: string, body?: { note?: string }) =>
    api.post<RmaView>(`/rma/${rmaId}/accept-return`, body ?? {}),

  rejectReturn: (rmaId: string, body: { note: string }) =>
    api.post<RmaView>(`/rma/${rmaId}/reject-return`, body),

  openDispute: (rmaId: string, body: { reason: string }) =>
    api.post<RmaView>(`/rma/${rmaId}/dispute`, body),

  markRefundSent: (rmaId: string, body?: { note?: string }) =>
    api.post<RmaView>(`/rma/${rmaId}/refund-sent`, body ?? {}),

  uploadRefundProof: (rmaId: string, file: File) => {
    const fd = new FormData();
    fd.append("proof", file);
    return api.postForm<RmaView>(`/rma/${rmaId}/refund-proof`, fd);
  },

  confirmRmaCompleted: (rmaId: string, body?: { note?: string }) =>
    api.post<RmaView>(`/rma/${rmaId}/confirm-completed`, body ?? {}),

  /** Multipart field `proof` — buyer payment bill for OFF_PLATFORM/COD. */
  uploadPaymentProof: (orderId: string, file: File) => {
    const fd = new FormData();
    fd.append("proof", file);
    return api.postForm<OrderView>(`/orders/${orderId}/payment-proof`, fd);
  },

  confirmPayment: (orderId: string) =>
    api.post<OrderView>(`/orders/${orderId}/payment/confirm`, {}),

  rejectPayment: (orderId: string, reason: string) =>
    api.post<OrderView>(`/orders/${orderId}/payment/reject`, { reason }),

  createFulfillmentComplaint: (orderId: string, reason: string) =>
    api.post(`/orders/${orderId}/fulfillment-complaint`, { reason }),
};

export const adminOrdersApi = {
  list: (query?: AdminListOrdersParams) =>
    api.get<PageEnvelope<OrderView>>("/admin/orders", { query, withMeta: true }),

  shippingQuote: (body: AdminShippingQuoteRequest) =>
    api.post<ShippingQuoteView>("/admin/orders/shipping-quote", body),

  checkout: (body: AdminCheckoutRequest, idempotencyKey: string) =>
    api.post<OrderView>("/admin/orders/checkout", body, {
      headers: { "Idempotency-Key": idempotencyKey },
    }),

  cancel: (orderId: string, body: { reason: string }) =>
    api.post<OrderView>(`/admin/orders/${orderId}/cancel`, body),

  listRma: (query?: {
    status?: RmaStatus;
    escalated?: boolean;
    page?: number;
    pageSize?: number;
  }) => api.get<PageEnvelope<RmaView>>("/admin/rma", { query, withMeta: true }),

  getRma: (rmaId: string) =>
    api.get<AdminRmaDetailView>(`/admin/rma/${rmaId}`),

  approveRma: (rmaId: string, body?: { note?: string }) =>
    api.post<RmaView>(`/admin/rma/${rmaId}/approve`, body ?? {}),

  rejectRma: (rmaId: string, body: { note: string }) =>
    api.post<RmaView>(`/admin/rma/${rmaId}/reject`, body),

  resolveDispute: (
    rmaId: string,
    body: { decision: "REFUND_PENDING" | "CLOSED"; note?: string },
  ) => api.post<RmaView>(`/admin/rma/${rmaId}/resolve-dispute`, body),

  reopenDispute: (rmaId: string, body: { reason: string }) =>
    api.post<RmaView>(`/admin/rma/${rmaId}/reopen-dispute`, body),

  forceReceive: (rmaId: string, body?: { note?: string }) =>
    api.post<RmaView>(`/admin/rma/${rmaId}/force-receive`, body ?? {}),

  forceAcceptReturn: (rmaId: string, body?: { note?: string }) =>
    api.post<RmaView>(`/admin/rma/${rmaId}/force-accept-return`, body ?? {}),

  forceRefundSent: (rmaId: string, body?: { note?: string }) =>
    api.post<RmaView>(`/admin/rma/${rmaId}/force-refund-sent`, body ?? {}),

  forceCompleteRma: (rmaId: string, body?: { note?: string }) =>
    api.post<AdminRmaDetailView>(`/admin/rma/${rmaId}/force-complete`, body ?? {}),

  forceCloseAbandoned: (rmaId: string, body?: { note?: string }) =>
    api.post<RmaView>(`/admin/rma/${rmaId}/force-close-abandoned`, body ?? {}),

  /** Legacy alias → force-complete */
  markRmaRefunded: (rmaId: string, body?: { note?: string }) =>
    api.post<AdminRmaDetailView>(`/admin/rma/${rmaId}/mark-refunded`, body ?? {}),

  /** Admin force-confirm off-platform payment (requires proof) → PAID. */
  forcePaid: (orderId: string, note?: string) =>
    api.post<OrderView>(
      `/admin/orders/${orderId}/payment/force-paid`,
      note ? { note } : {},
    ),

  rejectPayment: (orderId: string, reason: string) =>
    api.post<OrderView>(`/admin/orders/${orderId}/payment/reject`, { reason }),

  listFulfillmentComplaints: () =>
    api.get<{ items: FulfillmentComplaintView[] }>(
      "/admin/orders/fulfillment-complaints",
    ),
};

export type FulfillmentComplaintView = {
  id: string;
  orderId: string;
  buyerId: string;
  shopId: string;
  reason: string;
  status: string;
  createdAt: string;
};

/** OFF_PLATFORM preferred; COD is legacy alias with the same PENDING proof flow. */
export function isOffPlatformLike(method: PaymentMethod): boolean {
  return method === "OFF_PLATFORM" || method === "COD";
}

export function canUploadPaymentProof(
  order: Pick<OrderView, "status" | "paymentMethod">,
): boolean {
  return order.status === "PENDING" && isOffPlatformLike(order.paymentMethod);
}

export function canSellerReviewPayment(
  order: Pick<OrderView, "status" | "paymentMethod" | "paymentProofUrl">,
): boolean {
  return (
    order.status === "PENDING" &&
    isOffPlatformLike(order.paymentMethod) &&
    Boolean(order.paymentProofUrl)
  );
}

export function canAdminForcePaid(
  order: Pick<OrderView, "status" | "paymentMethod" | "paymentProofUrl">,
): boolean {
  return canSellerReviewPayment(order);
}

/** Next status in seller fulfillment pipeline, or null if terminal / not actionable. */
export function nextFulfillmentStatus(
  status: OrderStatus,
): UpdateOrderStatusRequest["status"] | null {
  switch (status) {
    case "PAID":
      return "CONFIRMED";
    case "CONFIRMED":
      return "PACKED";
    case "PACKED":
      return "SHIPPED";
    case "SHIPPED":
      return "DELIVERED";
    default:
      return null;
  }
}

export function canCancelOrder(status: OrderStatus): boolean {
  return (
    status === "PENDING" ||
    status === "PAID" ||
    status === "CONFIRMED" ||
    status === "PACKED"
  );
}

const BLOCKING_RMA_STATUSES: RmaStatus[] = [
  "PENDING",
  "REQUESTED",
  "APPROVED",
  "RETURN_SHIPPED",
  "RETURN_RECEIVED",
  "RETURN_REJECTED",
  "DISPUTED",
  "REFUND_PENDING",
  "REFUND_SENT",
];

/** Hide Request return when an in-flight RMA exists. REJECTED / CLOSED / COMPLETED may retry if order still DELIVERED. */
export function hasBlockingRma(order: Pick<OrderView, "rma">): boolean {
  const status = order.rma?.status;
  return Boolean(status && BLOCKING_RMA_STATUSES.includes(status));
}

/** RMA window: DELIVERED, within 7 days, and no blocking return request. */
export function canRequestRma(
  order: Pick<OrderView, "status" | "deliveredAt" | "rma">,
): boolean {
  if (hasBlockingRma(order)) return false;
  if (order.status !== "DELIVERED" || !order.deliveredAt) return false;
  const delivered = new Date(order.deliveredAt).getTime();
  if (Number.isNaN(delivered)) return false;
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  return Date.now() - delivered <= sevenDays;
}
