"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Ban } from "lucide-react";
import type { OrderStatus } from "@/lib/api/orders";
import { formatMoney } from "@/lib/api/utils";
import {
  useAdminCancelOrder,
  useAdminCheckout,
  useAdminOrders,
  useAdminShippingQuote,
} from "@/lib/queries/orders";
import { useAdminShops } from "@/lib/queries/admin";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { AdminActions, AdminIconButton } from "@/components/admin/AdminIconButton";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { AdminCardListSkeleton } from "@/components/ui/Skeleton";

function OrdersInner() {
  const [status, setStatus] = useState<OrderStatus | "">("PENDING");
  const [shopId, setShopId] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);

  const { data: shopsPage } = useAdminShops("APPROVED", 1, 100);
  const shops = shopsPage?.items ?? [];

  const { data, isLoading, isError, error } = useAdminOrders({
    status: status || undefined,
    shopId: shopId || undefined,
    page,
    pageSize: 20,
  });
  const cancelOrder = useAdminCancelOrder();
  const items = data?.items ?? [];
  const meta = data?.meta;

  const [buyerId, setBuyerId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [qty, setQty] = useState("1");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"COD" | "MOCK">("COD");
  const [quoteFee, setQuoteFee] = useState<number | null>(null);
  const adminQuote = useAdminShippingQuote();
  const adminCheckout = useAdminCheckout();

  const quoteBody = useMemo(() => {
    if (!buyerId || !variantId || !fullName || !phone || !line1 || !city) return null;
    return {
      buyerId,
      items: [{ variantId, quantity: Number(qty) || 1 }],
      shippingAddress: { fullName, phone, line1, city, country: "VN" },
    };
  }, [buyerId, variantId, qty, fullName, phone, line1, city]);

  useEffect(() => {
    if (!quoteBody) {
      setQuoteFee(null);
      return;
    }
    const t = window.setTimeout(() => {
      void adminQuote
        .mutateAsync(quoteBody)
        .then((q) => setQuoteFee(q.shippingFee))
        .catch(() => setQuoteFee(null));
    }, 400);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteBody]);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!quoteBody) return;
    await adminCheckout.mutateAsync({
      ...quoteBody,
      paymentMethod,
    });
    setCreateOpen(false);
  };

  return (
    <>
      <AdminPageHeader
        title="Orders"
        description="Cross-shop inbox, force cancel, and create orders on behalf of buyers."
        actions={
          <button
            type="button"
            className="mq-btn mq-btn-primary text-xs"
            onClick={() => setCreateOpen((v) => !v)}
          >
            {createOpen ? "Close form" : "Create for buyer"}
          </button>
        }
      />

      {createOpen ? (
        <form className="mq-admin-panel p-5 mb-6 grid sm:grid-cols-2 gap-3" onSubmit={(e) => void onCreate(e)}>
          <input
            className="mq-input"
            placeholder="Buyer user ID"
            value={buyerId}
            onChange={(e) => setBuyerId(e.target.value)}
            required
          />
          <input
            className="mq-input"
            placeholder="Variant ID"
            value={variantId}
            onChange={(e) => setVariantId(e.target.value)}
            required
          />
          <input
            className="mq-input"
            type="number"
            min="1"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
          <select
            className="mq-input"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as "COD" | "MOCK")}
          >
            <option value="COD">COD</option>
            <option value="MOCK">MOCK</option>
          </select>
          <input
            className="mq-input"
            placeholder="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
          <input
            className="mq-input"
            placeholder="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          <input
            className="mq-input sm:col-span-2"
            placeholder="Address line"
            value={line1}
            onChange={(e) => setLine1(e.target.value)}
            required
          />
          <input
            className="mq-input"
            placeholder="City"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            required
          />
          <p className="text-sm text-mq-text-muted self-center">
            Ship fee: {quoteFee == null ? "—" : formatMoney(quoteFee)}
          </p>
          <button
            className="mq-btn mq-btn-primary sm:col-span-2"
            disabled={adminCheckout.isPending}
          >
            {adminCheckout.isPending ? "Placing…" : "Place order"}
          </button>
        </form>
      ) : null}

      <div className="flex flex-wrap gap-3 mb-4">
        <select
          className="mq-input max-w-[12rem]"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as OrderStatus | "");
            setPage(1);
          }}
        >
          <option value="">All</option>
          {(
            [
              "PENDING",
              "PAID",
              "CONFIRMED",
              "PACKED",
              "SHIPPED",
              "DELIVERED",
              "CANCELLED",
              "REFUND_APPROVED",
            ] as OrderStatus[]
          ).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          className="mq-input max-w-[16rem]"
          value={shopId}
          onChange={(e) => {
            setShopId(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All shops</option>
          {shops.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-4">
        {isError && (
          <div className="mq-alert mq-alert-error">
            {error instanceof Error ? error.message : "Failed"}
          </div>
        )}
        {isLoading ? <AdminCardListSkeleton count={4} /> : null}
        {!isLoading && items.length === 0 ? (
          <p className="text-sm text-mq-text-muted">No orders for this filter.</p>
        ) : null}
        {items.map((o) => (
          <div
            key={o.id}
            className="mq-card p-4 flex flex-wrap justify-between gap-3 text-sm"
          >
            <div>
              <Link href={`/orders/${o.id}`} className="font-mono font-medium hover:underline">
                {o.code}
              </Link>
              <span className="mq-badge mq-badge-cyan ml-2">{o.status}</span>
              <p className="text-xs text-mq-text-muted mt-1">
                Shop {o.shopId.slice(0, 8)}… · Buyer {o.buyerId.slice(0, 8)}… ·{" "}
                {formatMoney(o.total)} {o.currency}
              </p>
            </div>
            {o.status !== "CANCELLED" && o.status !== "DELIVERED" && o.status !== "REFUND_APPROVED" ? (
              <AdminActions>
                <AdminIconButton
                  label="Cancel"
                  icon={Ban}
                  tone="danger"
                  disabled={cancelOrder.isPending}
                  onClick={() =>
                    void cancelOrder.mutateAsync({
                      orderId: o.id,
                      reason: "Admin force cancel",
                    })
                  }
                />
              </AdminActions>
            ) : null}
          </div>
        ))}
        <PaginationBar page={page} meta={meta} onPageChange={setPage} />
      </div>
    </>
  );
}

export default function AdminOrdersPage() {
  return (
    <AuthGuard roles={["ADMIN", "SUPER_ADMIN"]} permissions={["VIEW_ORDER", "CREATE_ORDER"]}>
      <OrdersInner />
    </AuthGuard>
  );
}
