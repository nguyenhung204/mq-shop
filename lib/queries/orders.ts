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
import { suppressNotificationToasts } from "@/lib/notifications/suppress-toast";
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
      params.paymentEscalated ? "escalated" : "",
      params.page ?? 1,
      params.pageSize ?? 20,
    ] as const,
  adminRma: (status?: string, escalated?: boolean) =>
    [...orderKeys.all, "admin-rma", status ?? "", escalated ? "escalated" : ""] as const,
  adminRmaDetail: (id: string) => [...orderKeys.all, "admin-rma-detail", id] as const,
  shopRma: (status?: string, escalated?: boolean) =>
    [...orderKeys.all, "shop-rma", status ?? "", escalated ? "escalated" : ""] as const,
  myRma: (status?: string) => [...orderKeys.all, "my-rma", status ?? ""] as const,
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
      case "FX_RATE_CHANGED":
        return tt("toast.fxRateChanged");
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
      // Page shows toast after navigate to avoid jump during route change.
    },
  });
}

export function useRemoveRmaEvidence(orderId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ rmaId, urls }: { rmaId: string; urls: string[] }) =>
      orderApi.removeRmaEvidence(rmaId, urls),
    onSuccess: (rma) => {
      invalidateRmaQueries(queryClient, rma.id, orderId ?? rma.orderId);
      suppressNotificationToasts();
      toast.success(tt("toast.rmaUpdated"));
    },
    onError: (e) => toast.error(orderErrorMessage(e, tt("toast.rmaActionFailed"))),
  });
}

export function useUploadRmaEvidence(orderId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ rmaId, files }: { rmaId: string; files: File[] }) =>
      orderApi.uploadRmaEvidence(rmaId, files),
    onSuccess: (rma) => {
      invalidateRmaQueries(queryClient, rma.id, orderId ?? rma.orderId);
      suppressNotificationToasts();
      toast.success(tt("toast.rmaUpdated"));
    },
    onError: (e) => toast.error(orderErrorMessage(e, tt("toast.rmaActionFailed"))),
  });
}

export function useUploadRefundProof(orderId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ rmaId, file }: { rmaId: string; file: File }) =>
      orderApi.uploadRefundProof(rmaId, file),
    onSuccess: (rma) => {
      invalidateRmaQueries(queryClient, rma.id, orderId ?? rma.orderId);
      suppressNotificationToasts();
      toast.success(tt("toast.rmaRefundProofUploaded"));
    },
    onError: (e) =>
      toast.error(orderErrorMessage(e, tt("toast.rmaRefundProofFailed"))),
  });
}

export function useAdminOrders(params: AdminListOrdersParams = {}) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const status = params.status;
  const shopId = params.shopId;
  const paymentEscalated = params.paymentEscalated;
  return useQuery({
    queryKey: orderKeys.adminList({ page, pageSize, status, shopId, paymentEscalated }),
    queryFn: async () =>
      parsePage<OrderView>(
        await adminOrdersApi.list({ page, pageSize, status, shopId, paymentEscalated }),
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

export function useShopRma(status?: string, escalated?: boolean) {
  return useQuery({
    queryKey: orderKeys.shopRma(status, escalated),
    queryFn: async () =>
      parsePage<RmaView>(
        await orderApi.listShopRma({
          status: status as RmaView["status"] | undefined,
          escalated: escalated || undefined,
          page: 1,
          pageSize: 50,
        }),
      ),
  });
}

export function useMyRma(status?: string) {
  return useQuery({
    queryKey: orderKeys.myRma(status),
    queryFn: async () =>
      parsePage<RmaView>(
        await orderApi.listMyRma({
          status: status as RmaView["status"] | undefined,
          page: 1,
          pageSize: 50,
        }),
      ),
  });
}

function invalidateRmaQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  rmaId?: string,
  orderId?: string,
) {
  void queryClient.invalidateQueries({ queryKey: orderKeys.all });
  if (rmaId) {
    void queryClient.invalidateQueries({ queryKey: orderKeys.adminRmaDetail(rmaId) });
  }
  if (orderId) {
    void queryClient.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
  }
}

export function useShopRmaAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      action:
        | "approve"
        | "reject"
        | "returnReceived"
        | "acceptReturn"
        | "rejectReturn"
        | "refundSent"
        | "shipGoodsToBuyer"
        | "updateGoodsReturnTracking";
      note?: string;
      orderId?: string;
      trackingCode?: string;
      carrier?: string;
    }) => {
      const { id, action, note } = input;
      switch (action) {
        case "approve":
          return orderApi.approveRma(id, note ? { note } : {});
        case "reject":
          return orderApi.rejectRma(id, { note: note || "Rejected" });
        case "returnReceived":
          return orderApi.markReturnReceived(id, note ? { note } : {});
        case "acceptReturn":
          return orderApi.acceptReturn(id, note ? { note } : {});
        case "rejectReturn":
          return orderApi.rejectReturn(id, { note: note || "Return rejected" });
        case "refundSent":
          return orderApi.markRefundSent(id, note ? { note } : {});
        case "shipGoodsToBuyer":
          return orderApi.shipGoodsToBuyer(id, {
            trackingCode: input.trackingCode || "",
            carrier: input.carrier,
            note,
          });
        case "updateGoodsReturnTracking":
          return orderApi.updateGoodsReturnTracking(id, {
            trackingCode: input.trackingCode || "",
            carrier: input.carrier,
            note,
          });
      }
    },
    onSuccess: (rma, vars) => {
      invalidateRmaQueries(queryClient, vars.id, vars.orderId ?? rma.orderId);
      suppressNotificationToasts();
      toast.success(tt("toast.rmaUpdated"));
    },
    onError: (e) => toast.error(orderErrorMessage(e, tt("toast.rmaActionFailed"))),
  });
}

export function useBuyerRmaAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      orderId: string;
      action:
        | "ship"
        | "dispute"
        | "confirmCompleted"
        | "confirmGoodsReceived"
        | "reportGoodsReturnIssue";
      trackingCode?: string;
      carrier?: string;
      reason?: string;
      note?: string;
    }) => {
      const { id, action } = input;
      if (action === "ship") {
        return orderApi.markReturnShipped(id, {
          trackingCode: input.trackingCode || "",
          carrier: input.carrier,
          note: input.note,
        });
      }
      if (action === "dispute") {
        return orderApi.openDispute(id, { reason: input.reason || "Dispute" });
      }
      if (action === "confirmGoodsReceived") {
        return orderApi.confirmGoodsReceived(
          id,
          input.note ? { note: input.note } : {},
        );
      }
      if (action === "reportGoodsReturnIssue") {
        return orderApi.reportGoodsReturnIssue(id, {
          reason: input.reason || "Not received / wrong tracking",
        });
      }
      return orderApi.confirmRmaCompleted(id, input.note ? { note: input.note } : {});
    },
    onSuccess: (_rma, vars) => {
      invalidateRmaQueries(queryClient, vars.id, vars.orderId);
      suppressNotificationToasts();
      toast.success(tt("toast.rmaUpdated"));
    },
    onError: (e) => toast.error(orderErrorMessage(e, tt("toast.rmaActionFailed"))),
  });
}

export function useAdminRma(status?: string, escalated?: boolean) {
  return useQuery({
    queryKey: orderKeys.adminRma(status, escalated),
    queryFn: async () =>
      parsePage<RmaView>(
        await adminOrdersApi.listRma({
          status: status as RmaView["status"] | undefined,
          escalated: escalated || undefined,
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
      invalidateRmaQueries(queryClient, vars.id);
      suppressNotificationToasts();
      toast.success(
        vars.decision === "APPROVED" ? tt("toast.rmaApproved") : tt("toast.rmaRejected"),
      );
    },
    onError: (e) => toast.error(orderErrorMessage(e, tt("toast.rmaDecisionFailed"))),
  });
}

export function useAdminResolveDispute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      decision,
      note,
    }: {
      id: string;
      decision: "REFUND_PENDING" | "CLOSED";
      note?: string;
    }) => adminOrdersApi.resolveDispute(id, { decision, note }),
    onSuccess: (_d, vars) => {
      invalidateRmaQueries(queryClient, vars.id);
      suppressNotificationToasts();
      toast.success(tt("toast.rmaDisputeResolved"));
    },
    onError: (e) => toast.error(orderErrorMessage(e, tt("toast.rmaActionFailed"))),
  });
}

export function useAdminReopenDispute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      adminOrdersApi.reopenDispute(id, { reason }),
    onSuccess: (_d, vars) => {
      invalidateRmaQueries(queryClient, vars.id);
      suppressNotificationToasts();
      toast.success(tt("toast.rmaDisputeReopened"));
    },
    onError: (e) => toast.error(orderErrorMessage(e, tt("toast.rmaActionFailed"))),
  });
}

export function useAdminRmaForceAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      action,
      note,
    }: {
      id: string;
      action:
        | "forceReceive"
        | "forceAccept"
        | "forceRefundSent"
        | "forceComplete"
        | "forceCloseAbandoned"
        | "forceCloseGoodsReturned";
      note?: string;
    }) => {
      const body = note ? { note } : {};
      switch (action) {
        case "forceReceive":
          return adminOrdersApi.forceReceive(id, body);
        case "forceAccept":
          return adminOrdersApi.forceAcceptReturn(id, body);
        case "forceRefundSent":
          return adminOrdersApi.forceRefundSent(id, body);
        case "forceComplete":
          return adminOrdersApi.forceCompleteRma(id, body);
        case "forceCloseAbandoned":
          return adminOrdersApi.forceCloseAbandoned(id, body);
        case "forceCloseGoodsReturned":
          return adminOrdersApi.forceCloseGoodsReturned(id, body);
      }
    },
    onSuccess: (_d, vars) => {
      invalidateRmaQueries(queryClient, vars.id);
      suppressNotificationToasts();
      toast.success(tt("toast.rmaForceDone"));
    },
    onError: (e) => toast.error(orderErrorMessage(e, tt("toast.rmaActionFailed"))),
  });
}

/** @deprecated Prefer useAdminRmaForceAction({ action: "forceComplete" }) */
export function useAdminRmaMarkRefunded() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      adminOrdersApi.forceCompleteRma(id, note ? { note } : {}),
    onSuccess: (_d, vars) => {
      invalidateRmaQueries(queryClient, vars.id);
      suppressNotificationToasts();
      toast.success(tt("toast.markedRefunded"));
    },
    onError: (e) => toast.error(orderErrorMessage(e, tt("toast.markRefundedFailed"))),
  });
}

function invalidateOrder(queryClient: ReturnType<typeof useQueryClient>, orderId: string) {
  void queryClient.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
  void queryClient.invalidateQueries({ queryKey: orderKeys.all });
}

export function useUploadPaymentProof(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => orderApi.uploadPaymentProof(orderId, file),
    onSuccess: (order) => {
      queryClient.setQueryData(orderKeys.detail(orderId), order);
      invalidateOrder(queryClient, orderId);
      toast.success(tt("toast.paymentProofUploaded"));
    },
    onError: (e) => toast.error(orderErrorMessage(e, tt("toast.paymentProofUploadFailed"))),
  });
}

export function useConfirmPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => orderApi.confirmPayment(orderId),
    onSuccess: (order) => {
      queryClient.setQueryData(orderKeys.detail(order.id), order);
      invalidateOrder(queryClient, order.id);
      toast.success(tt("toast.paymentConfirmed"));
    },
    onError: (e) => toast.error(orderErrorMessage(e, tt("toast.paymentConfirmFailed"))),
  });
}

export function useRejectPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, reason }: { orderId: string; reason: string }) =>
      orderApi.rejectPayment(orderId, reason),
    onSuccess: (order) => {
      queryClient.setQueryData(orderKeys.detail(order.id), order);
      invalidateOrder(queryClient, order.id);
      toast.success(tt("toast.paymentRejected"));
    },
    onError: (e) => toast.error(orderErrorMessage(e, tt("toast.paymentRejectFailed"))),
  });
}

export function useAdminForcePaid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, note }: { orderId: string; note?: string }) =>
      adminOrdersApi.forcePaid(orderId, note),
    onSuccess: (order) => {
      queryClient.setQueryData(orderKeys.detail(order.id), order);
      invalidateOrder(queryClient, order.id);
      toast.success(tt("toast.paymentForcePaid"));
    },
    onError: (e) => toast.error(orderErrorMessage(e, tt("toast.paymentForcePaidFailed"))),
  });
}

export function useAdminRejectPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, reason }: { orderId: string; reason: string }) =>
      adminOrdersApi.rejectPayment(orderId, reason),
    onSuccess: (order) => {
      queryClient.setQueryData(orderKeys.detail(order.id), order);
      invalidateOrder(queryClient, order.id);
      toast.success(tt("toast.paymentRejected"));
    },
    onError: (e) => toast.error(orderErrorMessage(e, tt("toast.paymentRejectFailed"))),
  });
}

export function useCreateFulfillmentComplaint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, reason }: { orderId: string; reason: string }) =>
      orderApi.createFulfillmentComplaint(orderId, reason),
    onSuccess: (_data, vars) => {
      invalidateOrder(queryClient, vars.orderId);
      toast.success(tt("toast.fulfillmentComplaintSent"));
    },
    onError: (e) =>
      toast.error(orderErrorMessage(e, tt("toast.fulfillmentComplaintFailed"))),
  });
}
