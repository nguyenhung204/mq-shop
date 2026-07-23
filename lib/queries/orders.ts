"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/client";
import { createIdempotencyKeyStore } from "@/lib/api/idempotency";
import {
  adminOrdersApi,
  orderApi,
  type AdminCheckoutRequest,
  type AdminListOrdersParams,
  type CheckoutRequest,
  type CreateRmaRequest,
  type ListOrdersParams,
  type OrderView,
  type RmaView,
  type ShippingQuoteRequest,
  type UpdateOrderStatusRequest,
} from "@/lib/api/orders";
import { parsePage } from "@/lib/api/utils";
import { getErrorMessage } from "@/lib/queries/utils";

export const orderKeys = {
  all: ["orders"] as const,
  list: (params: ListOrdersParams = {}) =>
    [
      ...orderKeys.all,
      "list",
      params.view ?? "",
      params.status ?? "",
      params.page ?? 1,
      params.pageSize ?? 20,
    ] as const,
  detail: (id: string) => [...orderKeys.all, "detail", id] as const,
  adminList: (params: AdminListOrdersParams = {}) =>
    [
      ...orderKeys.all,
      "admin",
      params.status ?? "",
      params.shopId ?? "",
      params.page ?? 1,
      params.pageSize ?? 20,
    ] as const,
  adminRma: (status?: string) => [...orderKeys.all, "admin-rma", status ?? ""] as const,
  adminRmaDetail: (id: string) => [...orderKeys.all, "admin-rma-detail", id] as const,
};

function orderErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof ApiError) {
    switch (e.code) {
      case "ORDER_MULTI_SHOP":
        return "Cart items must belong to a single shop.";
      case "ORDER_OWN_SHOP_FORBIDDEN":
        return "You cannot buy from your own shop.";
      case "INSUFFICIENT_STOCK":
        return "Not enough stock for one or more items.";
      case "ORDER_NOT_CANCELLABLE":
        return "This order can no longer be cancelled.";
      case "ORDER_INVALID_TRANSITION":
        return "Invalid status transition.";
      case "RMA_WINDOW_EXPIRED":
        return "RMA window expired (7 days after delivery).";
      case "RMA_NOT_ALLOWED":
        return "RMA is only allowed after delivery.";
      case "RMA_ALREADY_EXISTS":
        return "An active RMA already exists for this order.";
      case "ORDER_NOT_FOUND":
        return "Order not found.";
      case "USER_NOT_FOUND":
        return "Buyer not found.";
      case "VARIANT_NOT_FOUND":
        return "One or more SKUs were not found.";
      case "IDEMPOTENCY_KEY_REQUIRED":
        return "Missing checkout idempotency key. Please try again.";
      case "IDEMPOTENCY_KEY_REUSE_MISMATCH":
        return "Checkout data changed with a reused key. Please place the order again.";
      case "IDEMPOTENCY_REQUEST_IN_PROGRESS":
        return "This order is already being placed. Please wait a moment.";
      default:
        break;
    }
  }
  return getErrorMessage(e, fallback);
}

export function useOrders(params: ListOrdersParams = {}) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const status = params.status;
  const view = params.view;
  return useQuery({
    queryKey: orderKeys.list({ page, pageSize, status, view }),
    queryFn: async () =>
      parsePage<OrderView>(
        await orderApi.list({ page, pageSize, status, view }),
      ),
    placeholderData: (prev) => prev,
  });
}

/** Buyer purchases inbox. */
export function useMyOrders(
  params: Omit<ListOrdersParams, "view"> = {},
) {
  return useOrders({ ...params, view: "buyer" });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: orderKeys.detail(id),
    queryFn: () => orderApi.get(id),
    enabled: Boolean(id),
  });
}

export function useShippingQuote() {
  return useMutation({
    mutationFn: (body: ShippingQuoteRequest) => orderApi.shippingQuote(body),
  });
}

export function useCheckout() {
  const queryClient = useQueryClient();
  const idempotency = useMemo(() => createIdempotencyKeyStore(), []);
  return useMutation({
    mutationFn: (body: CheckoutRequest) =>
      orderApi.checkout(body, idempotency.keyFor(body)),
    onSuccess: () => {
      idempotency.invalidate();
      void queryClient.invalidateQueries({ queryKey: orderKeys.all });
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === "IDEMPOTENCY_KEY_REUSE_MISMATCH") {
        idempotency.invalidate();
      }
      toast.error(orderErrorMessage(e, "Checkout failed"));
    },
  });
}

export function useCancelOrder(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) => orderApi.cancel(orderId, { reason }),
    onSuccess: (order) => {
      queryClient.setQueryData(orderKeys.detail(orderId), order);
      void queryClient.invalidateQueries({ queryKey: orderKeys.all });
      toast.success("Order cancelled");
    },
    onError: (e) => toast.error(orderErrorMessage(e, "Cancel failed")),
  });
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      orderId,
      body,
    }: {
      orderId: string;
      body: UpdateOrderStatusRequest;
    }) => orderApi.updateStatus(orderId, body),
    onSuccess: (order) => {
      queryClient.setQueryData(orderKeys.detail(order.id), order);
      void queryClient.invalidateQueries({ queryKey: orderKeys.all });
      toast.success(`Order → ${order.status}`);
    },
    onError: (e) => toast.error(orderErrorMessage(e, "Status update failed")),
  });
}

export function useCreateRma(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      body,
      evidence,
    }: {
      body: CreateRmaRequest;
      evidence?: File[];
    }) => {
      const rma = await orderApi.createRma(orderId, body);
      if (evidence?.length) {
        return orderApi.uploadRmaEvidence(rma.id, evidence);
      }
      return rma;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
      toast.success("RMA submitted");
    },
    onError: (e) => toast.error(orderErrorMessage(e, "RMA failed")),
  });
}

export function useAdminOrders(params: AdminListOrdersParams = {}) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const status = params.status;
  const shopId = params.shopId;
  return useQuery({
    queryKey: orderKeys.adminList({ page, pageSize, status, shopId }),
    queryFn: async () =>
      parsePage<OrderView>(
        await adminOrdersApi.list({ page, pageSize, status, shopId }),
      ),
    placeholderData: (prev) => prev,
  });
}

export function useAdminCancelOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, reason }: { orderId: string; reason: string }) =>
      adminOrdersApi.cancel(orderId, { reason }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orderKeys.all });
      toast.success("Order cancelled");
    },
    onError: (e) => toast.error(orderErrorMessage(e, "Cancel failed")),
  });
}

export function useAdminCheckout() {
  const queryClient = useQueryClient();
  const idempotency = useMemo(() => createIdempotencyKeyStore(), []);
  return useMutation({
    mutationFn: (body: AdminCheckoutRequest) =>
      adminOrdersApi.checkout(body, idempotency.keyFor(body)),
    onSuccess: () => {
      idempotency.invalidate();
      void queryClient.invalidateQueries({ queryKey: orderKeys.all });
      toast.success("Order placed on behalf of buyer");
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === "IDEMPOTENCY_KEY_REUSE_MISMATCH") {
        idempotency.invalidate();
      }
      toast.error(orderErrorMessage(e, "Admin checkout failed"));
    },
  });
}

export function useAdminShippingQuote() {
  return useMutation({
    mutationFn: adminOrdersApi.shippingQuote,
  });
}

export function useAdminRma(status?: string) {
  return useQuery({
    queryKey: orderKeys.adminRma(status),
    queryFn: async () =>
      parsePage<RmaView>(
        await adminOrdersApi.listRma({
          status: status as RmaView["status"] | undefined,
          page: 1,
          pageSize: 50,
        }),
      ),
  });
}

export function useAdminRmaDetail(rmaId: string) {
  return useQuery({
    queryKey: orderKeys.adminRmaDetail(rmaId),
    queryFn: () => adminOrdersApi.getRma(rmaId),
    enabled: Boolean(rmaId),
  });
}

export function useAdminRmaDecision() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      decision,
      note,
    }: {
      id: string;
      decision: "APPROVED" | "REJECTED";
      note?: string;
    }) => {
      if (decision === "APPROVED") {
        return adminOrdersApi.approveRma(id, { note });
      }
      return adminOrdersApi.rejectRma(id, { note: note || "Rejected" });
    },
    onSuccess: (_d, vars) => {
      void queryClient.invalidateQueries({ queryKey: orderKeys.all });
      void queryClient.invalidateQueries({
        queryKey: orderKeys.adminRmaDetail(vars.id),
      });
      toast.success(vars.decision === "APPROVED" ? "RMA approved" : "RMA rejected");
    },
    onError: (e) => toast.error(orderErrorMessage(e, "RMA decision failed")),
  });
}

export function useAdminRmaMarkRefunded() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      adminOrdersApi.markRmaRefunded(id, note ? { note } : {}),
    onSuccess: (_d, vars) => {
      void queryClient.invalidateQueries({ queryKey: orderKeys.all });
      void queryClient.invalidateQueries({
        queryKey: orderKeys.adminRmaDetail(vars.id),
      });
      toast.success("Marked as refunded — order REFUNDED, RMA CLOSED");
    },
    onError: (e) => toast.error(orderErrorMessage(e, "Mark refunded failed")),
  });
}
