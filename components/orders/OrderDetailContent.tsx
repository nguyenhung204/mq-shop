"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { X } from "lucide-react";
import { formatMoney } from "@/lib/api/utils";
import {
  canCancelOrder,
  canRequestRma,
  hasBlockingRma,
  nextFulfillmentStatus,
  type RmaStatus,
} from "@/lib/api/orders";
import { translateStatus } from "@/lib/i18n/status";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { useCancelOrder, useOrder, useUpdateOrderStatus } from "@/lib/queries/orders";
import { useSellerShop } from "@/lib/queries/seller";
import { useProductReviews } from "@/lib/queries/reviews";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { ReviewForm } from "@/components/reviews/ReviewForm";
import { Container, PageHero } from "@/components/ui/shared";
import { OrderDetailSkeleton } from "@/components/ui/Skeleton";

const FALLBACK_IMAGE = "/images/products/1.jpg";

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
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: order, isLoading, isError, error } = useOrder(id);
  const { data: shop } = useSellerShop();
  const cancelOrder = useCancelOrder(id);
  const updateStatus = useUpdateOrderStatus();
  const [reason, setReason] = useState("");

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
  const nextStatus = order ? nextFulfillmentStatus(order.status) : null;
  const canCancel =
    Boolean(order && canCancelOrder(order.status) && (isBuyer || isShopOrder));
  const showRma = Boolean(order && isBuyer && canRequestRma(order));
  const rmaInfo = order ? resolveRmaInfo(order) : null;
  const canReview = Boolean(order && isBuyer && order.status === "DELIVERED" && user?.id);

  const onCancel = async (e: FormEvent) => {
    e.preventDefault();
    await cancelOrder.mutateAsync(reason);
    setReason("");
  };

  return (
    <>
      <PageHero
        title="Order detail"
        breadcrumb={[{ label: "Orders", href: "/orders" }, { label: id.slice(0, 8) }]}
      />
      <Container className="py-10 md:py-14 max-w-3xl mx-auto space-y-6">
        {isLoading && <OrderDetailSkeleton />}
        {isError && (
          <div className="mq-alert mq-alert-error">
            {error instanceof Error ? error.message : "Failed to load"}
          </div>
        )}
        {order && (
          <div className="mq-card p-6 space-y-4">
            <div className="flex flex-wrap gap-2 items-center">
              <span className="font-mono text-sm font-medium">{order.code}</span>
              <span className="mq-badge mq-badge-cyan">{translateStatus(t, "order", order.status)}</span>
              <span className="mq-badge mq-badge-teal">{translateStatus(t, "paymentMethod", order.paymentMethod)}</span>
              {order.rma ? (
                <span className="mq-badge mq-badge-pink">RMA · {translateStatus(t, "rma", order.rma.status)}</span>
              ) : null}
            </div>
            {rmaInfo ? (
              <div className="rounded-[var(--mq-radius-sm)] border border-mq-border bg-mq-surface-subtle p-4 space-y-1.5 text-sm">
                <p className="font-medium">
                  {translateStatus(t, "rmaMessage", rmaInfo.status)}
                </p>
                {rmaInfo.reason ? (
                  <p className="text-mq-text-secondary">Reason: {rmaInfo.reason}</p>
                ) : null}
                {rmaInfo.note ? (
                  <p className="text-xs text-mq-text-muted">Note: {rmaInfo.note}</p>
                ) : null}
                {hasBlockingRma(order) && !showRma ? (
                  <p className="text-xs text-mq-text-muted pt-1">
                    A return request is already open for this order.
                  </p>
                ) : null}
              </div>
            ) : null}
            <p className="text-sm">
              Total: <strong>{formatMoney(order.total)}</strong> {order.currency}
              <span className="text-mq-text-muted">
                {" "}
                (subtotal {formatMoney(order.subtotal)} + ship {formatMoney(order.shippingFee)})
              </span>
            </p>
            <p className="text-sm text-mq-text-secondary">
              Ship to: {formatAddress(order.shippingAddress)}
            </p>
            {order.deliveredAt ? (
              <p className="text-xs text-mq-text-muted">
                Delivered {new Date(order.deliveredAt).toLocaleString()}
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
                    </p>
                    {canReview && item.productId && user?.id ? (
                      <OrderLineReview
                        productId={item.productId}
                        orderId={order.id}
                        buyerId={user.id}
                      />
                    ) : null}
                  </div>
                  <span className="shrink-0 font-medium">{formatMoney(item.lineTotal)}</span>
                </li>
              ))}
            </ul>

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
                  {updateStatus.isPending ? "Updating…" : `Mark ${translateStatus(t, "order", nextStatus)}`}
                </button>
              </div>
            ) : null}

            {canCancel && (
              <form
                onSubmit={(e) => void onCancel(e)}
                className="space-y-3 pt-4 border-t border-mq-border"
              >
                <h3 className="text-sm font-medium">Cancel order</h3>
                <input
                  className="mq-input"
                  placeholder="Reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                />
                <button
                  type="submit"
                  className="mq-btn mq-btn-outline"
                  disabled={cancelOrder.isPending}
                >
                  {cancelOrder.isPending ? "Cancelling…" : "Cancel order"}
                </button>
              </form>
            )}
            {showRma ? (
              <Link href={`/orders/${id}/rma`} className="mq-btn mq-btn-primary inline-flex">
                Request return (RMA)
              </Link>
            ) : null}
          </div>
        )}
      </Container>
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
