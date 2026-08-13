"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { formatMoney } from "@/lib/api/utils";
import { formatOrderMoney } from "@/lib/fx/formatOrderMoney";
import {
  canCancelOrder,
  canRequestRma,
  canSellerReviewPayment,
  canUploadPaymentProof,
  hasBlockingRma,
  nextFulfillmentStatus,
  type RmaStatus,
} from "@/lib/api/orders";
import { translateStatus } from "@/lib/i18n/status";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";
import {
  useCancelOrder,
  useConfirmPayment,
  useCreateFulfillmentComplaint,
  useBuyerRmaAction,
  useOrder,
  useRejectPayment,
  useRemoveRmaEvidence,
  useShopRmaAction,
  useUpdateOrderStatus,
  useUploadPaymentProof,
  useUploadRefundProof,
  useUploadRmaEvidence,
} from "@/lib/queries/orders";
import { useSellerShop, useShopPaymentProfile } from "@/lib/queries/seller";
import { useWarehouses } from "@/lib/queries/inventory";
import { useProductReviews } from "@/lib/queries/reviews";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { ReviewForm } from "@/components/reviews/ReviewForm";
import { Container, PageHero } from "@/components/ui/shared";
import { AdminReasonModal } from "@/components/admin/AdminReasonModal";
import { OrderDetailSkeleton } from "@/components/ui/Skeleton";

import { PRODUCT_FALLBACK_IMAGE } from "@/lib/images";
import { getErrorMessage } from "@/lib/queries/utils";

const FALLBACK_IMAGE = PRODUCT_FALLBACK_IMAGE;

function formatAddress(addr: {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  district?: string;
  country?: string;
}): string {
  return [
    addr.fullName,
    addr.phone,
    addr.line1,
    addr.line2,
    [addr.district, addr.city].filter(Boolean).join(", "),
    addr.country,
  ]
    .filter(Boolean)
    .join(" · ");
}

function resolveRmaInfo(order: {
  status: string;
  rma?: {
    status: RmaStatus;
    reason?: string;
    reviewNote?: string | null;
  } | null;
}): {
  status: RmaStatus | "REFUND_APPROVED" | "REFUNDED";
  reason?: string;
  note?: string | null;
} | null {
  if (order.rma) {
    return {
      status: order.rma.status,
      reason: order.rma.reason,
      note: order.rma.reviewNote,
    };
  }
  if (order.status === "REFUND_APPROVED" || order.status === "REFUNDED") {
    return { status: order.status };
  }
  return null;
}

function OrderLineReview({
  productId,
  orderId,
  buyerId,
}: {
  productId: string;
  orderId: string;
  buyerId: string;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const { data } = useProductReviews(productId, 1, 50);
  const mine = (data?.items ?? []).find((r) => r.buyer?.id === buyerId) ?? null;

  return (
    <div className="mt-2">
      {!open ? (
        <button
          type="button"
          className="text-xs text-mq-gold hover:underline"
          onClick={() => setOpen(true)}
        >
          {mine ? t("orders.review.edit") : t("orders.review.write")}
        </button>
      ) : (
        <div className="mt-2 rounded-[var(--mq-radius-sm)] border border-mq-border p-3 bg-mq-surface-subtle relative">
          <button
            type="button"
            className="absolute top-2 right-2 mq-admin-icon-btn"
            aria-label={t("admin.common.close")}
            onClick={() => setOpen(false)}
          >
            <X size={14} />
          </button>
          <p className="text-xs font-medium mb-2 pr-6">
            {mine ? t("orders.review.editTitle") : t("orders.review.writeTitle")}
          </p>
          <ReviewForm
            productId={productId}
            orderId={orderId}
            existing={mine}
            onDone={() => setOpen(false)}
            onCancel={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  );
}

function OrderDetailInner() {
  const { id } = useParams<{ id: string }>();
  const { t, locale } = useLanguage();
  const intlLocale =
    locale === "zh-TW" ? "zh-TW" : locale === "vi" ? "vi-VN" : "en-US";
  const { user } = useAuth();
  const { data: order, isLoading, isError, error } = useOrder(id);
  const { data: shop } = useSellerShop();
  const { data: paymentProfile } = useShopPaymentProfile(order?.shopId);
  const cancelOrder = useCancelOrder(id);
  const updateStatus = useUpdateOrderStatus();
  const uploadProof = useUploadPaymentProof(id);
  const confirmPayment = useConfirmPayment();
  const rejectPayment = useRejectPayment();
  const fulfillmentComplaint = useCreateFulfillmentComplaint();
  const buyerRma = useBuyerRmaAction();
  const shopRma = useShopRmaAction();
  const removeEvidence = useRemoveRmaEvidence(id);
  const uploadEvidence = useUploadRmaEvidence(id);
  const uploadRefundProof = useUploadRefundProof(id);
  const [complaintModalOpen, setComplaintModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [disputeModalOpen, setDisputeModalOpen] = useState(false);
  const [goodsReturnIssueOpen, setGoodsReturnIssueOpen] = useState(false);
  const [sellerRejectOpen, setSellerRejectOpen] = useState<
    null | "reject" | "rejectReturn"
  >(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [trackingCode, setTrackingCode] = useState("");
  const [carrier, setCarrier] = useState("");

  const formatOrderAmount = (twd: number, field: "total" | "subtotal" | "shippingFee" = "total") => {
    if (!order) return formatMoney(twd);
    const base = {
      total: order.total,
      subtotal: order.subtotal,
      shippingFee: order.shippingFee,
      currency: order.currency,
      displayCurrency: order.displayCurrency,
      fxRate: order.fxRate,
      displayTotal: order.displayTotal,
    };
    if (field !== "total") {
      return formatOrderMoney({ ...base, total: twd }, field, intlLocale).primary;
    }
    return formatOrderMoney(base, "total", intlLocale).primary;
  };

  const orderTotalMoney = order
    ? formatOrderMoney(order, "total", intlLocale)
    : null;

  const roles = user?.roles ?? [];
  const myShopId = user?.shopId || shop?.id || null;
  const isBuyer = Boolean(order && user && order.buyerId === user.id);
  const isShopOrder = Boolean(order && myShopId && order.shopId === myShopId);
  const canFulfill =
    isShopOrder &&
    (roles.includes("SELLER") ||
      roles.includes("WAREHOUSE") ||
      roles.includes("CS") ||
      roles.includes("ADMIN") ||
      roles.includes("SUPER_ADMIN"));
  const canConfirmPayment =
    Boolean(order && canSellerReviewPayment(order)) &&
    ((isShopOrder && roles.includes("SELLER")) ||
      roles.includes("ADMIN") ||
      roles.includes("SUPER_ADMIN"));
  // Fulfillment staff can see which warehouse ships each line (checklist §5 item 6).
  const { data: warehouses = [] } = useWarehouses({ enabled: canFulfill });
  const warehouseCodeById = useMemo(() => {
    const map = new Map<string, string>();
    for (const w of warehouses) map.set(w.id, w.code);
    return map;
  }, [warehouses]);
  const nextStatus = order ? nextFulfillmentStatus(order.status) : null;
  const canCancel =
    Boolean(order && canCancelOrder(order.status) && (isBuyer || isShopOrder));
  const showRma = Boolean(order && isBuyer && canRequestRma(order));
  const canComplaintNoShip = Boolean(
    order &&
      isBuyer &&
      (order.status === "PAID" ||
        order.status === "CONFIRMED" ||
        order.status === "PACKED") &&
      (order.fulfillmentEscalatedAt ||
        (order.paidAt &&
          Date.now() - new Date(order.paidAt).getTime() >= 72 * 3600_000)),
  );
  const rmaInfo = order ? resolveRmaInfo(order) : null;
  const canReview = Boolean(order && isBuyer && order.status === "DELIVERED" && user?.id);
  const showBuyerPayment =
    Boolean(order && isBuyer && canUploadPaymentProof(order));
  const showSellerPayment =
    Boolean(order && canConfirmPayment);

  const confirmCancel = async (reason: string) => {
    await cancelOrder.mutateAsync(reason);
    setCancelModalOpen(false);
  };

  const onUploadProof = async () => {
    if (!proofFile) return;
    await uploadProof.mutateAsync(proofFile);
    setProofFile(null);
  };

  return (
    <>
      <PageHero
        title={t("orders.detail.title")}
        breadcrumb={[
          { label: t("orders.detail.breadcrumbOrders"), href: "/orders" },
          { label: id.slice(0, 8) },
        ]}
      />
      <Container className="py-10 md:py-14 max-w-3xl mx-auto space-y-6">
        {isLoading && <OrderDetailSkeleton />}
        {isError && (
          <div className="mq-alert mq-alert-error">
            {getErrorMessage(error, t("orders.loadDetailFailed"))}
          </div>
        )}
        {order && (
          <div className="mq-card p-6 space-y-4">
            <div className="flex flex-wrap gap-2 items-center">
              <h1 className="text-xl font-bold text-mq-text">{order.displayName}</h1>
              <span className="font-mono text-sm text-mq-text-muted">{order.code}</span>
              <span className="mq-badge mq-badge-cyan">{translateStatus(t, "order", order.status)}</span>
              <span className="mq-badge mq-badge-teal">{translateStatus(t, "paymentMethod", order.paymentMethod)}</span>
              {order.rma ? (
                <span className="mq-badge mq-badge-pink">RMA · {translateStatus(t, "rma", order.rma.status)}</span>
              ) : null}
            </div>
            {rmaInfo ? (
              <div className="rounded-[var(--mq-radius-sm)] border border-mq-border bg-mq-surface-subtle p-4 space-y-2 text-sm">
                <p className="font-medium">
                  {translateStatus(t, "rmaMessage", rmaInfo.status)}
                </p>
                {order.rma?.escalatedAt ? (
                  <p className="text-xs text-mq-accent-orange font-medium">
                    {t("orders.rma.escalatedBanner")}
                  </p>
                ) : null}
                {rmaInfo.reason ? (
                  <p className="text-mq-text-secondary">
                    {t("orders.detail.reasonLabel", { reason: rmaInfo.reason })}
                  </p>
                ) : null}
                {rmaInfo.note ? (
                  <p className="text-xs text-mq-text-muted">
                    {t("orders.detail.noteLabel", { note: rmaInfo.note })}
                  </p>
                ) : null}
                {order.rma?.returnTrackingCode ? (
                  <p className="text-xs text-mq-text-muted">
                    {t("orders.rma.trackingLabel")}:{" "}
                    {order.rma.returnCarrier ? `${order.rma.returnCarrier} · ` : ""}
                    {order.rma.returnTrackingCode}
                  </p>
                ) : null}
                {order.rma?.disputeReason ? (
                  <p className="text-xs text-mq-text-muted">
                    {t("orders.rma.disputeLabel")}: {order.rma.disputeReason}
                  </p>
                ) : null}
                {hasBlockingRma(order) && !showRma ? (
                  <p className="text-xs text-mq-text-muted pt-1">
                    {t("orders.detail.blockingRmaHint")}
                  </p>
                ) : null}

                {order.rma?.bankInfo ? (
                  <div className="pt-2 border-t border-mq-border space-y-1.5">
                    <p className="text-xs font-medium text-mq-text-muted uppercase tracking-wide">
                      {t("orders.rma.bankInfoTitle")}
                    </p>
                    <dl className="grid gap-1 text-mq-text-secondary">
                      <div className="flex flex-wrap gap-x-2">
                        <dt className="text-mq-text-muted">{t("orders.rma.bankName")}:</dt>
                        <dd>{order.rma.bankInfo.bankName}</dd>
                      </div>
                      <div className="flex flex-wrap gap-x-2">
                        <dt className="text-mq-text-muted">{t("orders.rma.accountNumber")}:</dt>
                        <dd className="font-mono">{order.rma.bankInfo.accountNumber}</dd>
                      </div>
                      <div className="flex flex-wrap gap-x-2">
                        <dt className="text-mq-text-muted">{t("orders.rma.accountName")}:</dt>
                        <dd>{order.rma.bankInfo.accountName}</dd>
                      </div>
                    </dl>
                  </div>
                ) : null}

                {isShopOrder && order.rma && (order.rma.evidenceUrls?.length ?? 0) > 0 ? (
                  <div className="pt-2 border-t border-mq-border space-y-2">
                    <p className="text-xs font-medium text-mq-text-muted uppercase tracking-wide">
                      {t("orders.rma.evidenceTitle", {
                        count: String(order.rma.evidenceUrls.length),
                      })}
                    </p>
                    <ul className="flex flex-wrap gap-2">
                      {order.rma.evidenceUrls.map((url) => (
                        <li key={url}>
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="relative block h-20 w-20 overflow-hidden rounded border border-mq-border mq-product-image-bg"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={url}
                              alt={t("orders.rma.evidenceAlt")}
                              className="h-full w-full object-cover"
                            />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {isShopOrder &&
                order.rma &&
                (order.rma.evidenceUrls?.length ?? 0) === 0 ? (
                  <p className="text-xs text-mq-text-muted pt-2 border-t border-mq-border">
                    {t("orders.rma.noEvidence")}
                  </p>
                ) : null}

                {isBuyer &&
                (order.rma?.status === "REQUESTED" || order.rma?.status === "PENDING") ? (
                  <div className="pt-2 border-t border-mq-border space-y-2">
                    <p className="text-xs text-mq-text-muted">{t("orders.rma.evidenceManage")}</p>
                    {(order.rma.evidenceUrls?.length ?? 0) > 0 ? (
                      <ul className="flex flex-wrap gap-2">
                        {order.rma.evidenceUrls.map((url) => (
                          <li key={url} className="relative">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={url}
                              alt={t("orders.rma.evidenceAlt")}
                              className="h-16 w-16 rounded object-cover border border-mq-border"
                            />
                            <button
                              type="button"
                              className="absolute -top-1 -right-1 mq-admin-icon-btn"
                              disabled={removeEvidence.isPending}
                              aria-label={t("orders.rma.removeEvidence")}
                              onClick={() =>
                                void removeEvidence.mutateAsync({
                                  rmaId: order.rma!.id,
                                  urls: [url],
                                })
                              }
                            >
                              <X size={12} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {(order.rma.evidenceUrls?.length ?? 0) < 5 ? (
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        multiple
                        className="mq-input"
                        disabled={uploadEvidence.isPending}
                        onChange={(e) => {
                          const files = Array.from(e.target.files ?? []).slice(
                            0,
                            5 - (order.rma?.evidenceUrls?.length ?? 0),
                          );
                          e.target.value = "";
                          if (!files.length || !order.rma) return;
                          void uploadEvidence.mutateAsync({
                            rmaId: order.rma.id,
                            files,
                          });
                        }}
                      />
                    ) : null}
                  </div>
                ) : null}

                {isBuyer && order.rma?.status === "APPROVED" ? (
                  <div className="pt-2 space-y-2 border-t border-mq-border">
                    <p className="text-xs text-mq-text-muted">{t("orders.rma.shipHint")}</p>
                    <input
                      className="mq-input"
                      placeholder={t("orders.rma.trackingPlaceholder")}
                      value={trackingCode}
                      onChange={(e) => setTrackingCode(e.target.value)}
                    />
                    <input
                      className="mq-input"
                      placeholder={t("orders.rma.carrierPlaceholder")}
                      value={carrier}
                      onChange={(e) => setCarrier(e.target.value)}
                    />
                    <button
                      type="button"
                      className="mq-btn mq-btn-primary"
                      disabled={buyerRma.isPending || trackingCode.trim().length < 3}
                      onClick={() =>
                        void buyerRma.mutateAsync({
                          id: order.rma!.id,
                          orderId: order.id,
                          action: "ship",
                          trackingCode: trackingCode.trim(),
                          carrier: carrier.trim() || undefined,
                        })
                      }
                    >
                      {t("orders.rma.markShipped")}
                    </button>
                  </div>
                ) : null}

                {isBuyer && order.rma?.status === "RETURN_REJECTED" ? (
                  <div className="pt-2 border-t border-mq-border">
                    <button
                      type="button"
                      className="mq-btn mq-btn-outline"
                      disabled={buyerRma.isPending}
                      onClick={() => setDisputeModalOpen(true)}
                    >
                      {t("orders.rma.openDispute")}
                    </button>
                  </div>
                ) : null}

                {order.rma?.refundProofUrl ? (
                  <div className="pt-2 border-t border-mq-border space-y-2">
                    <p className="text-xs font-medium text-mq-text-muted uppercase tracking-wide">
                      {t("orders.rma.refundProofTitle")}
                    </p>
                    <a
                      href={order.rma.refundProofUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={order.rma.refundProofUrl}
                        alt={t("orders.rma.refundProofAlt")}
                        className="max-h-48 w-auto rounded border border-mq-border object-contain bg-white"
                      />
                    </a>
                    {order.rma.refundProofUploadedAt ? (
                      <p className="text-xs text-mq-text-muted">
                        {t("orders.rma.refundProofUploadedAt", {
                          date: new Date(order.rma.refundProofUploadedAt).toLocaleString(),
                        })}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {order.rma?.goodsReturnTrackingCode ? (
                  <p className="text-sm text-mq-text-secondary">
                    {t("orders.rma.goodsReturnTrackingLabel")}:{" "}
                    {order.rma.goodsReturnCarrier
                      ? `${order.rma.goodsReturnCarrier} · `
                      : ""}
                    {order.rma.goodsReturnTrackingCode}
                  </p>
                ) : null}
                {order.rma?.goodsReturnIssueNote ? (
                  <p className="text-sm text-mq-accent-orange">
                    {t("orders.rma.goodsReturnIssueLabel")}: {order.rma.goodsReturnIssueNote}
                  </p>
                ) : null}

                {isBuyer && order.rma?.status === "REFUND_SENT" ? (
                  <div className="pt-2 border-t border-mq-border space-y-2">
                    <p className="text-xs text-mq-text-muted">{t("orders.rma.confirmHint")}</p>
                    <button
                      type="button"
                      className="mq-btn mq-btn-primary"
                      disabled={buyerRma.isPending}
                      onClick={() =>
                        void buyerRma.mutateAsync({
                          id: order.rma!.id,
                          orderId: order.id,
                          action: "confirmCompleted",
                        })
                      }
                    >
                      {t("orders.rma.confirmReceived")}
                    </button>
                  </div>
                ) : null}

                {isBuyer && order.rma?.status === "GOODS_RETURN_SHIPPED" ? (
                  <div className="pt-2 border-t border-mq-border space-y-2">
                    <p className="text-xs text-mq-text-muted">
                      {t("orders.rma.confirmGoodsHint")}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="mq-btn mq-btn-primary"
                        disabled={buyerRma.isPending}
                        onClick={() =>
                          void buyerRma.mutateAsync({
                            id: order.rma!.id,
                            orderId: order.id,
                            action: "confirmGoodsReceived",
                          })
                        }
                      >
                        {t("orders.rma.confirmGoodsReceived")}
                      </button>
                      <button
                        type="button"
                        className="mq-btn mq-btn-outline"
                        disabled={buyerRma.isPending}
                        onClick={() => setGoodsReturnIssueOpen(true)}
                      >
                        {order.rma.goodsReturnIssueNote
                          ? t("orders.rma.updateGoodsIssue")
                          : t("orders.rma.reportGoodsIssue")}
                      </button>
                    </div>
                    <p className="text-xs text-mq-text-muted">
                      {t("orders.rma.reportGoodsIssueHint")}
                    </p>
                    {order.shopOwnerEmail ? (
                      <p className="text-sm text-mq-text-secondary">
                        {t("orders.rma.shopContactEmailLabel")}:{" "}
                        <a
                          className="text-mq-accent underline break-all"
                          href={`mailto:${order.shopOwnerEmail}?subject=${encodeURIComponent(
                            t("orders.rma.shopContactEmailSubject", {
                              code: order.code,
                            }),
                          )}`}
                        >
                          {order.shopOwnerEmail}
                        </a>
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {isBuyer && order.rma?.status === "GOODS_RETURN_PENDING" ? (
                  <div className="pt-2 border-t border-mq-border space-y-2">
                    <p className="text-xs text-mq-text-muted">
                      {t("orders.rma.goodsReturnPendingBuyerHint")}
                    </p>
                    {order.shopOwnerEmail ? (
                      <p className="text-sm text-mq-text-secondary">
                        {t("orders.rma.shopContactEmailLabel")}:{" "}
                        <a
                          className="text-mq-accent underline break-all"
                          href={`mailto:${order.shopOwnerEmail}?subject=${encodeURIComponent(
                            t("orders.rma.shopContactEmailSubject", {
                              code: order.code,
                            }),
                          )}`}
                        >
                          {order.shopOwnerEmail}
                        </a>
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {isShopOrder && order.rma ? (
                  <div className="pt-2 border-t border-mq-border space-y-3">
                    <div className="flex flex-wrap gap-2">
                    {(order.rma.status === "REQUESTED" ||
                      order.rma.status === "PENDING") && (
                      <>
                        <button
                          type="button"
                          className="mq-btn mq-btn-primary text-xs"
                          disabled={shopRma.isPending}
                          onClick={() =>
                            void shopRma.mutateAsync({
                              id: order.rma!.id,
                              action: "approve",
                              orderId: order.id,
                            })
                          }
                        >
                          {t("seller.rmaPage.approve")}
                        </button>
                        <button
                          type="button"
                          className="mq-btn mq-btn-outline text-xs"
                          disabled={shopRma.isPending}
                          onClick={() => setSellerRejectOpen("reject")}
                        >
                          {t("seller.rmaPage.reject")}
                        </button>
                      </>
                    )}
                    {order.rma.status === "RETURN_SHIPPED" ? (
                      <button
                        type="button"
                        className="mq-btn mq-btn-primary text-xs"
                        disabled={shopRma.isPending}
                        onClick={() =>
                          void shopRma.mutateAsync({
                            id: order.rma!.id,
                            action: "returnReceived",
                            orderId: order.id,
                          })
                        }
                      >
                        {t("seller.rmaPage.markReceived")}
                      </button>
                    ) : null}
                    {order.rma.status === "RETURN_RECEIVED" ? (
                      <>
                        <button
                          type="button"
                          className="mq-btn mq-btn-primary text-xs"
                          disabled={shopRma.isPending}
                          onClick={() =>
                            void shopRma.mutateAsync({
                              id: order.rma!.id,
                              action: "acceptReturn",
                              orderId: order.id,
                            })
                          }
                        >
                          {t("seller.rmaPage.acceptReturn")}
                        </button>
                        <button
                          type="button"
                          className="mq-btn mq-btn-outline text-xs"
                          disabled={shopRma.isPending}
                          onClick={() => setSellerRejectOpen("rejectReturn")}
                        >
                          {t("seller.rmaPage.rejectReturn")}
                        </button>
                      </>
                    ) : null}
                    </div>
                    {order.rma.status === "REFUND_PENDING" ? (
                      <div className="space-y-2">
                        <p className="text-xs text-mq-text-muted">
                          {t("orders.rma.refundProofHint")}
                        </p>
                        <label className="block text-sm" htmlFor="refund-proof">
                          {t("orders.rma.refundProofUpload")}
                        </label>
                        <input
                          id="refund-proof"
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          className="mq-input"
                          disabled={uploadRefundProof.isPending || shopRma.isPending}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = "";
                            if (!file || !order.rma) return;
                            void uploadRefundProof.mutateAsync({
                              rmaId: order.rma.id,
                              file,
                            });
                          }}
                        />
                        <button
                          type="button"
                          className="mq-btn mq-btn-primary text-xs"
                          disabled={
                            shopRma.isPending ||
                            uploadRefundProof.isPending ||
                            !order.rma.refundProofUrl
                          }
                          onClick={() =>
                            void shopRma.mutateAsync({
                              id: order.rma!.id,
                              action: "refundSent",
                              orderId: order.id,
                            })
                          }
                        >
                          {t("seller.rmaPage.markRefundSent")}
                        </button>
                        {!order.rma.refundProofUrl ? (
                          <p className="text-xs text-mq-accent-orange">
                            {t("orders.rma.refundProofRequired")}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    {order.rma.status === "GOODS_RETURN_PENDING" ? (
                      <div className="space-y-2 w-full">
                        <p className="text-xs text-mq-text-muted">
                          {t("orders.rma.goodsReturnShipHint")}
                        </p>
                        <input
                          className="mq-input"
                          placeholder={t("orders.rma.goodsReturnTrackingPlaceholder")}
                          value={trackingCode}
                          onChange={(e) => setTrackingCode(e.target.value)}
                        />
                        <input
                          className="mq-input"
                          placeholder={t("orders.rma.carrierPlaceholder")}
                          value={carrier}
                          onChange={(e) => setCarrier(e.target.value)}
                        />
                        <button
                          type="button"
                          className="mq-btn mq-btn-primary text-xs"
                          disabled={
                            shopRma.isPending || trackingCode.trim().length < 3
                          }
                          onClick={() =>
                            void shopRma.mutateAsync({
                              id: order.rma!.id,
                              action: "shipGoodsToBuyer",
                              orderId: order.id,
                              trackingCode: trackingCode.trim(),
                              carrier: carrier.trim() || undefined,
                            })
                          }
                        >
                          {t("seller.rmaPage.shipGoodsToBuyer")}
                        </button>
                      </div>
                    ) : null}
                    {order.rma.status === "GOODS_RETURN_SHIPPED" ? (
                      <div className="space-y-2 w-full">
                        <p className="text-xs text-mq-text-muted">
                          {order.rma.goodsReturnIssueNote
                            ? t("orders.rma.goodsReturnFixTrackingHint")
                            : t("orders.rma.goodsReturnUpdateTrackingHint")}
                        </p>
                        <input
                          className="mq-input"
                          placeholder={t("orders.rma.goodsReturnTrackingPlaceholder")}
                          value={trackingCode}
                          onChange={(e) => setTrackingCode(e.target.value)}
                        />
                        <input
                          className="mq-input"
                          placeholder={t("orders.rma.carrierPlaceholder")}
                          value={carrier}
                          onChange={(e) => setCarrier(e.target.value)}
                        />
                        <button
                          type="button"
                          className="mq-btn mq-btn-primary text-xs"
                          disabled={
                            shopRma.isPending || trackingCode.trim().length < 3
                          }
                          onClick={() =>
                            void shopRma.mutateAsync({
                              id: order.rma!.id,
                              action: "updateGoodsReturnTracking",
                              orderId: order.id,
                              trackingCode: trackingCode.trim(),
                              carrier: carrier.trim() || undefined,
                            })
                          }
                        >
                          {t("seller.rmaPage.updateGoodsReturnTracking")}
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
            <p className="text-sm">
              {t("orders.detail.totalLabel")}: <strong>{formatOrderAmount(order.total)}</strong>
              {orderTotalMoney?.ledgerHint ? (
                <span className="text-mq-text-muted text-xs ml-1">
                  ({orderTotalMoney.ledgerHint} {order.currency})
                </span>
              ) : orderTotalMoney?.showCurrencySuffix ? (
                <span className="text-mq-text-muted"> {order.currency}</span>
              ) : null}
              <span className="text-mq-text-muted">
                {" "}
                {t("orders.detail.subtotalShipHint", {
                  subtotal: formatOrderAmount(order.subtotal, "subtotal"),
                  shippingFee: formatOrderAmount(order.shippingFee, "shippingFee"),
                })}
              </span>
            </p>
            <p className="text-sm text-mq-text-secondary">
              {t("orders.detail.shipTo")}: {formatAddress(order.shippingAddress)}
            </p>
            {order.deliveredAt ? (
              <p className="text-xs text-mq-text-muted">
                {t("orders.detail.delivered", {
                  date: new Date(order.deliveredAt).toLocaleString(),
                })}
              </p>
            ) : null}
            <ul className="divide-y divide-mq-border">
              {(order.items || []).map((item) => (
                <li key={item.id} className="py-3 flex items-start gap-3 text-sm">
                  <Link
                    href={`/product/${item.productId}`}
                    className="relative w-14 h-14 shrink-0 overflow-hidden rounded-[var(--mq-radius-sm)] mq-product-image-bg mq-product-media"
                  >
                    <Image
                      src={item.imageSnapshot || FALLBACK_IMAGE}
                      alt={item.titleSnapshot || item.sku}
                      fill
                      className="mq-product-media-img object-cover"
                      sizes="56px"
                    />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/product/${item.productId}`}
                      className="line-clamp-2 font-medium hover:text-mq-gold transition-colors"
                    >
                      {item.titleSnapshot || item.sku}
                    </Link>
                    <p className="text-xs text-mq-text-muted mt-0.5">
                      {item.sku} × {item.quantity}
                      {canFulfill && item.warehouseId ? (
                        <span className="ml-2 text-mq-text-secondary">
                          {t("orders.detail.shipFromWarehouse", {
                            warehouse:
                              warehouseCodeById.get(item.warehouseId) ||
                              item.warehouseId.slice(0, 8) + "…",
                          })}
                        </span>
                      ) : null}
                    </p>
                    {canReview && item.productId && user?.id ? (
                      <OrderLineReview
                        productId={item.productId}
                        orderId={order.id}
                        buyerId={user.id}
                      />
                    ) : null}
                  </div>
                  <span className="shrink-0 font-medium">{formatOrderAmount(item.lineTotal)}</span>
                </li>
              ))}
            </ul>

            {showBuyerPayment ? (
              <div className="pt-4 border-t border-mq-border space-y-3">
                <h2 className="text-sm font-semibold">{t("orders.payment.title")}</h2>
                <p className="text-sm text-mq-text-secondary">{t("orders.payment.paySellerHint")}</p>
                {paymentProfile ? (
                  <div className="rounded-[var(--mq-radius-sm)] border border-mq-border bg-mq-surface-subtle p-4 text-sm space-y-2">
                    <p className="font-medium text-mq-text">
                      {paymentProfile.shopName || t("checkout.sellerPaymentProfile")}
                    </p>
                    {paymentProfile.bankName || paymentProfile.accountNumber ? (
                      <dl className="grid gap-1.5 text-mq-text-secondary">
                        {paymentProfile.bankName ? (
                          <div className="flex flex-wrap gap-x-2">
                            <dt className="text-mq-text-muted">{t("checkout.bankName")}:</dt>
                            <dd>{paymentProfile.bankName}</dd>
                          </div>
                        ) : null}
                        {paymentProfile.accountNumber ? (
                          <div className="flex flex-wrap gap-x-2">
                            <dt className="text-mq-text-muted">{t("checkout.accountNumber")}:</dt>
                            <dd className="font-mono">{paymentProfile.accountNumber}</dd>
                          </div>
                        ) : null}
                        {paymentProfile.accountName ? (
                          <div className="flex flex-wrap gap-x-2">
                            <dt className="text-mq-text-muted">{t("checkout.accountName")}:</dt>
                            <dd>{paymentProfile.accountName}</dd>
                          </div>
                        ) : null}
                      </dl>
                    ) : (
                      <p className="text-mq-accent-orange text-xs">
                        {t("checkout.bankInfoUnavailable")}
                      </p>
                    )}
                    {paymentProfile.qrUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={paymentProfile.qrUrl}
                        alt={t("checkout.paymentQr")}
                        className="mt-2 max-h-40 w-auto rounded border border-mq-border bg-white object-contain"
                      />
                    ) : null}
                  </div>
                ) : (
                  <p className="text-xs text-mq-text-muted">
                    {t("checkout.loadingPaymentProfile")}
                  </p>
                )}
                {order.paymentRejectedReason ? (
                  <div className="mq-alert mq-alert-warn text-sm">
                    <p className="font-medium">{t("orders.payment.rejectedTitle")}</p>
                    <p>{t("orders.detail.reasonLabel", { reason: order.paymentRejectedReason })}</p>
                    <p className="text-xs mt-1">{t("orders.payment.reuploadHint")}</p>
                  </div>
                ) : null}
                {order.paymentProofUrl && !order.paymentRejectedReason ? (
                  <div className="rounded-[var(--mq-radius-sm)] border border-mq-border bg-mq-surface-subtle p-4 space-y-2 text-sm">
                    <p className="font-medium text-mq-text">{t("orders.payment.waitingSeller")}</p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={order.paymentProofUrl}
                      alt={t("orders.payment.proofAlt")}
                      className="max-h-48 w-auto rounded border border-mq-border object-contain bg-white"
                    />
                    {order.paymentProofUploadedAt ? (
                      <p className="text-xs text-mq-text-muted">
                        {t("orders.payment.uploadedAt", {
                          date: new Date(order.paymentProofUploadedAt).toLocaleString(),
                        })}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="block text-sm" htmlFor="payment-proof">
                      {t("orders.payment.uploadLabel")}
                    </label>
                    <input
                      id="payment-proof"
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="mq-input"
                      onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                    />
                    <p className="text-xs text-mq-text-muted">{t("orders.payment.uploadHint")}</p>
                    <button
                      type="button"
                      className="mq-btn mq-btn-primary"
                      disabled={!proofFile || uploadProof.isPending}
                      onClick={() => void onUploadProof()}
                    >
                      {uploadProof.isPending
                        ? t("orders.payment.uploading")
                        : t("orders.payment.uploadBtn")}
                    </button>
                  </div>
                )}
              </div>
            ) : null}

            {showSellerPayment ? (
              <div className="pt-4 border-t border-mq-border space-y-3">
                <h2 className="text-sm font-semibold">{t("orders.payment.sellerReviewTitle")}</h2>
                {order.paymentProofUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={order.paymentProofUrl}
                    alt={t("orders.payment.proofAlt")}
                    className="max-h-56 w-auto rounded border border-mq-border object-contain bg-white"
                  />
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="mq-btn mq-btn-primary"
                    disabled={confirmPayment.isPending || rejectPayment.isPending}
                    onClick={() => void confirmPayment.mutateAsync(order.id)}
                  >
                    {confirmPayment.isPending
                      ? t("orders.payment.confirming")
                      : t("orders.payment.confirmBtn")}
                  </button>
                  <button
                    type="button"
                    className="mq-btn mq-btn-outline"
                    disabled={confirmPayment.isPending || rejectPayment.isPending}
                    onClick={() => setRejectModalOpen(true)}
                  >
                    {t("orders.payment.rejectBtn")}
                  </button>
                </div>
              </div>
            ) : null}

            {canFulfill && nextStatus ? (
              <div className="pt-4 border-t border-mq-border">
                <button
                  type="button"
                  className="mq-btn mq-btn-primary"
                  disabled={updateStatus.isPending}
                  onClick={() =>
                    void updateStatus.mutateAsync({
                      orderId: order.id,
                      body: { status: nextStatus },
                    })
                  }
                >
                  {updateStatus.isPending
                    ? t("orders.detail.updating")
                    : t("orders.detail.markStatus", {
                        status: translateStatus(t, "order", nextStatus),
                      })}
                </button>
              </div>
            ) : null}

            {canCancel && (
              <div className="pt-4 border-t border-mq-border">
                <button
                  type="button"
                  className="mq-btn mq-btn-outline"
                  onClick={() => setCancelModalOpen(true)}
                >
                  {t("orders.detail.cancelOrderBtn")}
                </button>
              </div>
            )}
            {showRma ? (
              <Link href={`/orders/${id}/rma`} className="mq-btn mq-btn-primary inline-flex">
                {t("orders.detail.requestReturn")}
              </Link>
            ) : null}
            {canComplaintNoShip ? (
              <button
                type="button"
                className="mq-btn mq-btn-outline"
                onClick={() => setComplaintModalOpen(true)}
              >
                {t("orders.detail.fulfillmentComplaintBtn")}
              </button>
            ) : null}
          </div>
        )}
      </Container>
      <AdminReasonModal
        open={cancelModalOpen}
        title={t("orders.detail.cancelOrderTitle")}
        description={t("confirm.orderCancelDesc")}
        confirmLabel={t("confirm.orderCancelBtn")}
        maxLength={300}
        busy={cancelOrder.isPending}
        onClose={() => setCancelModalOpen(false)}
        onConfirm={(reason) => void confirmCancel(reason)}
      />
      <AdminReasonModal
        open={rejectModalOpen}
        title={t("orders.payment.rejectTitle")}
        description={t("orders.payment.rejectDesc")}
        confirmLabel={t("orders.payment.rejectBtn")}
        maxLength={500}
        busy={rejectPayment.isPending}
        onClose={() => setRejectModalOpen(false)}
        onConfirm={(reason) => {
          if (!order) return;
          void rejectPayment.mutateAsync({ orderId: order.id, reason }).then(() => {
            setRejectModalOpen(false);
          });
        }}
      />
      <AdminReasonModal
        open={complaintModalOpen}
        title={t("orders.detail.fulfillmentComplaintTitle")}
        description={t("orders.detail.fulfillmentComplaintDesc")}
        confirmLabel={t("orders.detail.fulfillmentComplaintBtn")}
        maxLength={500}
        busy={fulfillmentComplaint.isPending}
        onClose={() => setComplaintModalOpen(false)}
        onConfirm={(reason) => {
          if (!order) return;
          void fulfillmentComplaint
            .mutateAsync({ orderId: order.id, reason })
            .then(() => setComplaintModalOpen(false));
        }}
      />
      <AdminReasonModal
        open={disputeModalOpen}
        title={t("orders.rma.disputeTitle")}
        description={t("orders.rma.disputeDesc")}
        confirmLabel={t("orders.rma.openDispute")}
        maxLength={500}
        busy={buyerRma.isPending}
        onClose={() => setDisputeModalOpen(false)}
        onConfirm={(reason) => {
          if (!order?.rma) return;
          void buyerRma
            .mutateAsync({
              id: order.rma.id,
              orderId: order.id,
              action: "dispute",
              reason,
            })
            .then(() => setDisputeModalOpen(false));
        }}
      />
      <AdminReasonModal
        open={goodsReturnIssueOpen}
        title={t("orders.rma.reportGoodsIssueTitle")}
        description={t("orders.rma.reportGoodsIssueDesc")}
        confirmLabel={t("orders.rma.reportGoodsIssue")}
        maxLength={500}
        busy={buyerRma.isPending}
        onClose={() => setGoodsReturnIssueOpen(false)}
        onConfirm={(reason) => {
          if (!order?.rma) return;
          void buyerRma
            .mutateAsync({
              id: order.rma.id,
              orderId: order.id,
              action: "reportGoodsReturnIssue",
              reason,
            })
            .then(() => setGoodsReturnIssueOpen(false));
        }}
      />
      <AdminReasonModal
        open={Boolean(sellerRejectOpen)}
        title={
          sellerRejectOpen === "rejectReturn"
            ? t("seller.rmaPage.rejectReturnTitle")
            : t("seller.rmaPage.rejectTitle")
        }
        description={
          sellerRejectOpen === "rejectReturn"
            ? t("seller.rmaPage.rejectReturnDesc")
            : t("seller.rmaPage.rejectDesc")
        }
        confirmLabel={t("seller.rmaPage.reject")}
        maxLength={500}
        busy={shopRma.isPending}
        onClose={() => setSellerRejectOpen(null)}
        onConfirm={async (note) => {
          if (!order?.rma || !sellerRejectOpen) return;
          await shopRma.mutateAsync({
            id: order.rma.id,
            orderId: order.id,
            action: sellerRejectOpen === "rejectReturn" ? "rejectReturn" : "reject",
            note,
          });
          setSellerRejectOpen(null);
        }}
      />
    </>
  );
}

export function OrderDetailContent() {
  return (
    <AuthGuard>
      <OrderDetailInner />
    </AuthGuard>
  );
}
