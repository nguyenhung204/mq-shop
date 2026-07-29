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
import { currentLocale, tt } from "@/lib/i18n/tt";
import { statusLabel } from "@/lib/i18n/status";
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
        return tt("toast.orderMultiShop");
      case "ORDER_OWN_SHOP_FORBIDDEN":
        return tt("toast.orderOwnShopForbidden");
      case "INSUFFICIENT_STOCK":
        return tt("toast.insufficientStock");
      case "ORDER_NOT_CANCELLABLE":
        return tt("toast.orderNotCancellable");
      case "ORDER_INVALID_TRANSITION":
        return tt("toast.orderInvalidTransition");
      case "RMA_WINDOW_EXPIRED":
        return tt("toast.rmaWindowExpired");
      case "RMA_NOT_ALLOWED":
        return tt("toast.rmaNotAllowed");
      case "RMA_ALREADY_EXISTS":
        return tt("toast.rmaAlreadyExists");
      case "ORDER_NOT_FOUND":
        return tt("toast.orderNotFound");
      case "USER_NOT_FOUND":
        return tt("toast.buyerNotFound");
      case "VARIANT_NOT_FOUND":
        return tt("toast.variantNotFound");
      case "IDEMPOTENCY_KEY_REQUIRED":
        return tt("toast.checkoutIdempotencyKeyRequired");
      case "IDEMPOTENCY_KEY_REUSE_MISMATCH":
        return tt("toast.checkoutIdempotencyMismatch");
      case "IDEMPOTENCY_REQUEST_IN_PROGRESS":
        return tt("toast.checkoutInProgress");
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
      toast.success(tt("toast.orderCancelled"));
    },
    onError: (e) => toast.error(orderErrorMessage(e, tt("toast.cancelFailed"))),
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
      // DELIVERED may credit referral + fire order.rank_qualify (sponsor promote).
      // Refresh this session; sponsor who is not the actor refreshes via SSE toast.
      if (order.status === "DELIVERED") {
        void queryClient.invalidateQueries({ queryKey: ["wallet"] });
        void queryClient.invalidateQueries({ queryKey: ["mlm"] });
      }
      toast.success(
        tt("toast.orderStatus", {
          status: statusLabel(currentLocale(), "order", order.status),
        }),
      );
    },
    onError: (e) => toast.error(orderErrorMessage(e, tt("toast.statusUpdateFailed"))),
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
      toast.success(tt("toast.rmaSubmitted"));
    },
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
      toast.success(tt("toast.orderCancelled"));
    },
    onError: (e) => toast.error(orderErrorMessage(e, tt("toast.cancelFailed"))),
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
      toast.success(tt("toast.orderPlacedBehalf"));
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === "IDEMPOTENCY_KEY_REUSE_MISMATCH") {
        idempotency.invalidate();
      }
      toast.error(orderErrorMessage(e, tt("toast.adminCheckoutFailed")));
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
      toast.success(
        vars.decision === "APPROVED" ? tt("toast.rmaApproved") : tt("toast.rmaRejected"),
      );
    },
    onError: (e) => toast.error(orderErrorMessage(e, tt("toast.rmaDecisionFailed"))),
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
      toast.success(tt("toast.markedRefunded"));
    },
    onError: (e) => toast.error(orderErrorMessage(e, tt("toast.markRefundedFailed"))),
  });
}
