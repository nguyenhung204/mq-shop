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

export type PaymentMethod = "COD" | "MOCK";

export type RmaStatus = "PENDING" | "APPROVED" | "REJECTED" | "CLOSED";

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
  currency: "USD";
};

export type CheckoutRequest = {
  items: OrderLineItem[];
  shippingAddress: ShippingAddress;
  paymentMethod: PaymentMethod;
  note?: string;
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
  buyerId?: string;
  shopId?: string;
  status: RmaStatus;
  reason: string;
  evidenceUrls: string[];
  bankInfo: RmaBankInfo;
  reviewerId?: string | null;
  reviewNote: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt?: string;
};

/** GET /admin/rma/:rmaId — PROCESS_RMA review scope. */
export type AdminRmaDetailView = RmaView & {
  orderCode: string | null;
  orderStatus: OrderStatus | null;
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
  currency: "USD";
  paymentMethod: PaymentMethod;
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

  listRma: (query?: { status?: RmaStatus; page?: number; pageSize?: number }) =>
    api.get<PageEnvelope<RmaView>>("/admin/rma", { query, withMeta: true }),

  getRma: (rmaId: string) =>
    api.get<AdminRmaDetailView>(`/admin/rma/${rmaId}`),

  approveRma: (rmaId: string, body?: { note?: string }) =>
    api.post<RmaView>(`/admin/rma/${rmaId}/approve`, body ?? {}),

  rejectRma: (rmaId: string, body: { note: string }) =>
    api.post<RmaView>(`/admin/rma/${rmaId}/reject`, body),

  /** Accountant: RMA APPROVED + order REFUND_APPROVED → order REFUNDED, RMA CLOSED. */
  markRmaRefunded: (rmaId: string, body?: { note?: string }) =>
    api.post<AdminRmaDetailView>(`/admin/rma/${rmaId}/mark-refunded`, body ?? {}),
};

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

const BLOCKING_RMA_STATUSES: RmaStatus[] = ["PENDING", "APPROVED", "CLOSED"];

/** Hide Request return when RMA is PENDING | APPROVED | CLOSED. REJECTED may retry. */
export function hasBlockingRma(order: Pick<OrderView, "rma">): boolean {
  const status = order.rma?.status;
  return Boolean(status && BLOCKING_RMA_STATUSES.includes(status));
}

/** @deprecated use hasBlockingRma */
export function hasActiveRma(order: Pick<OrderView, "rma" | "status">): boolean {
  return hasBlockingRma(order);
}

/** RMA window: DELIVERED, within 7 days, and no blocking return request. */
export function canRequestRma(
  order: Pick<OrderView, "status" | "deliveredAt" | "rma">,
): boolean {
  // REJECTED does not block; PENDING|APPROVED|CLOSED does.
  if (hasBlockingRma(order)) return false;
  if (order.status !== "DELIVERED" || !order.deliveredAt) return false;
  const delivered = new Date(order.deliveredAt).getTime();
  if (Number.isNaN(delivered)) return false;
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  return Date.now() - delivered <= sevenDays;
}

/** @deprecated Use translateStatus(t, "rmaMessage", status) instead. */
export function rmaStatusLabel(status: RmaStatus): string {
  switch (status) {
    case "PENDING":
      return "Return pending review";
    case "APPROVED":
      return "Return approved";
    case "REJECTED":
      return "Return rejected";
    case "CLOSED":
      return "Return closed";
    default:
      return status;
  }
}
