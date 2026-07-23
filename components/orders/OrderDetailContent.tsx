"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { formatMoney } from "@/lib/api/utils";
import { canCancelOrder, canRequestRma } from "@/lib/api/orders";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCancelOrder, useOrder, useUpdateOrderStatus } from "@/lib/queries/orders";
import { useSellerShop } from "@/lib/queries/seller";
import { nextFulfillmentStatus } from "@/lib/api/orders";
import { AuthGuard } from "@/components/guards/AuthGuard";
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

function OrderDetailInner() {
  const { id } = useParams<{ id: string }>();
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
              <span className="mq-badge mq-badge-cyan">{order.status}</span>
              <span className="mq-badge mq-badge-teal">{order.paymentMethod}</span>
            </div>
            {order.status === "REFUND_APPROVED" ? (
              <div className="mq-alert mq-alert-error text-sm">
                Refund approved — waiting for accountant payout outside the system.
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
                <li key={item.id} className="py-3 flex items-center gap-3 text-sm">
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
                  {updateStatus.isPending ? "Updating…" : `Mark ${nextStatus}`}
                </button>
              </div>
            ) : null}

            {canCancel && (
              <form onSubmit={(e) => void onCancel(e)} className="space-y-3 pt-4 border-t border-mq-border">
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
            {showRma && (
              <Link href={`/orders/${id}/rma`} className="mq-btn mq-btn-primary inline-flex">
                Request return (RMA)
              </Link>
            )}
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
