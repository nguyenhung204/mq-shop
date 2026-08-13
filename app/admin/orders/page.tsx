"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Ban, CircleDollarSign, X } from "lucide-react";
import { adminApi } from "@/lib/api";
import { canAdminForcePaid, type OrderStatus, type PaymentMethod } from "@/lib/api/orders";
import type { ApiProduct, AuthUser, ProductVariant } from "@/lib/api/types";
import { formatMoney, parsePage } from "@/lib/api/utils";
import {
  useAdminCancelOrder,
  useAdminCheckout,
  useAdminForcePaid,
  useAdminOrders,
  useAdminShippingQuote,
  useAdminRejectPayment,
} from "@/lib/queries/orders";
import { useAdminProducts, useAdminShops } from "@/lib/queries/admin";
import { LedgerTwdNote } from "@/components/finance/LedgerTwdNote";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { AdminActions, AdminIconButton } from "@/components/admin/AdminIconButton";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { translateStatus } from "@/lib/i18n/status";
import { CountrySelect } from "@/components/ui/CountrySelect";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { AddressRegionFields } from "@/components/ui/AddressRegionFields";
import { PaginationBar } from "@/components/ui/PaginationBar";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/ui/SearchableSelect";
import { AdminCardListSkeleton } from "@/components/ui/Skeleton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AdminReasonModal } from "@/components/admin/AdminReasonModal";
import { useAuth } from "@/components/providers/AuthProvider";
import { isValidNationalPhone, toE164 } from "@/lib/data/phone";
import { getErrorMessage } from "@/lib/queries/utils";

function buyerLabel(u: AuthUser): string {
  const name = u.fullName?.trim();
  return name ? `${name} · ${u.email}` : u.email;
}

function productTitle(p: ApiProduct): string {
  return p.title || p.name || "Product";
}

function variantOptionLabel(v: ProductVariant): string {
  const opts =
    v.options && Object.keys(v.options).length > 0
      ? Object.entries(v.options)
          .map(([k, val]) => `${k}:${val}`)
          .join(" · ")
      : null;
  const stock = typeof v.availableStock === "number" ? ` · stock ${v.availableStock}` : "";
  const bits = [v.sku, opts, formatMoney(v.sellingPrice)].filter(Boolean);
  return `${bits.join(" · ")}${stock} · ${v.id.slice(0, 8)}`;
}

function OrdersInner() {
  const { t } = useLanguage();
  const { hasRole } = useAuth();
  const [status, setStatus] = useState<OrderStatus | "">("");
  const [shopId, setShopId] = useState("");
  const [escalatedOnly, setEscalatedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);

  const { data: shopsPage } = useAdminShops("APPROVED", 1, 100);
  const shops = shopsPage?.items ?? [];

  const { data: buyersPage } = useQuery({
    queryKey: ["admin", "users", "ACTIVE", "create-order"],
    queryFn: async () =>
      parsePage<AuthUser>(
        await adminApi.users({ status: "ACTIVE", page: 1, pageSize: 100 }),
      ),
    enabled: createOpen,
  });
  const buyers = useMemo(() => {
    const list = buyersPage?.items ?? [];
    return [...list].sort((a, b) =>
      buyerLabel(a).localeCompare(buyerLabel(b), undefined, { sensitivity: "base" }),
    );
  }, [buyersPage?.items]);

  const buyerOptions = useMemo<SearchableSelectOption[]>(
    () =>
      buyers.map((u) => ({
        value: u.id,
        label: buyerLabel(u),
        keywords: `${u.fullName ?? ""} ${u.email} ${u.id}`,
      })),
    [buyers],
  );

  const { data: productsPage } = useAdminProducts("ACTIVE", 1, 100);
  const products = useMemo(() => {
    const list = (productsPage?.items ?? []).filter(
      (p) => Array.isArray(p.variants) && p.variants.length > 0,
    );
    return [...list].sort((a, b) =>
      productTitle(a).localeCompare(productTitle(b), undefined, { sensitivity: "base" }),
    );
  }, [productsPage?.items]);

  const variantOptions = useMemo<SearchableSelectOption[]>(() => {
    const opts: SearchableSelectOption[] = [];
    for (const p of products) {
      const title = productTitle(p);
      for (const v of p.variants ?? []) {
        opts.push({
          value: v.id,
          label: `${title} — ${variantOptionLabel(v)}`,
          group: title,
          keywords: `${title} ${v.sku} ${v.id} ${JSON.stringify(v.options ?? {})}`,
        });
      }
    }
    return opts;
  }, [products]);

  const { data, isLoading, isError, error } = useAdminOrders({
    status: status || undefined,
    shopId: shopId || undefined,
    paymentEscalated: escalatedOnly || undefined,
    page,
    pageSize: 20,
  });
  const cancelOrder = useAdminCancelOrder();
  const forcePaid = useAdminForcePaid();
  const rejectPayment = useAdminRejectPayment();
  const [cancelTarget, setCancelTarget] = useState<{ id: string; code: string; displayName: string } | null>(null);
  const [forcePaidTarget, setForcePaidTarget] = useState<{ id: string; displayName: string } | null>(null);
  const [rejectPaymentTarget, setRejectPaymentTarget] = useState<{ id: string; displayName: string } | null>(null);
  const canReviewPayment = hasRole("ADMIN") || hasRole("SUPER_ADMIN");
  const rawItems = data?.items ?? [];
  const items = escalatedOnly
    ? rawItems.filter((o) => Boolean(o.paymentEscalatedAt))
    : rawItems;
  const meta = data?.meta;

  const [buyerId, setBuyerId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [qty, setQty] = useState("1");
  const [fullName, setFullName] = useState("");
  const [phoneNational, setPhoneNational] = useState("");
  const [phoneDialCountry, setPhoneDialCountry] = useState("VN");
  const [country, setCountry] = useState("VN");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [line1, setLine1] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("MOCK");
  const [quoteFee, setQuoteFee] = useState<number | null>(null);
  const adminQuote = useAdminShippingQuote();
  const adminCheckout = useAdminCheckout();

  const quoteBody = useMemo(() => {
    if (
      !buyerId ||
      !variantId ||
      !fullName ||
      !phoneNational ||
      !line1 ||
      !city ||
      !isValidNationalPhone(phoneDialCountry, phoneNational)
    ) {
      return null;
    }
    return {
      buyerId,
      items: [{ variantId, quantity: Number(qty) || 1 }],
      shippingAddress: {
        fullName,
        phone: toE164(phoneDialCountry, phoneNational),
        line1,
        city,
        district: district || undefined,
        country,
      },
    };
  }, [
    buyerId,
    variantId,
    qty,
    fullName,
    phoneNational,
    phoneDialCountry,
    line1,
    city,
    district,
    country,
  ]);

  useEffect(() => {
    if (!quoteBody) {
      const t = window.setTimeout(() => setQuoteFee(null), 0);
      return () => window.clearTimeout(t);
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
        title={t("admin.orders.title")}
        description={t("admin.orders.description")}
        actions={
          <button
            type="button"
            className="mq-btn mq-btn-primary text-xs"
            onClick={() => setCreateOpen((v) => !v)}
          >
            {createOpen ? t("admin.common.closeForm") : t("admin.ordersPage.createForBuyer")}
          </button>
        }
      />

      <LedgerTwdNote className="mb-4" />

      {createOpen ? (
        <form className="mq-admin-panel p-5 mb-6 grid sm:grid-cols-2 gap-3" onSubmit={(e) => void onCreate(e)}>
          <p className="text-xs text-mq-text-muted sm:col-span-2">
            {t("admin.ordersPage.ledgerCheckoutNote")}
          </p>
          <label className="block text-sm sm:col-span-2">
            <span className="text-xs text-mq-text-muted">{t("admin.ordersPage.buyer")}</span>
            <div className="mt-1">
              <SearchableSelect
                options={buyerOptions}
                value={buyerId}
                required
                aria-label={t("admin.ordersPage.buyer")}
                placeholder={t("admin.ordersPage.searchBuyer")}
                searchPlaceholder={t("admin.ordersPage.searchBuyer")}
                onChange={(id) => {
                  setBuyerId(id);
                  const user = buyers.find((u) => u.id === id);
                  if (user?.fullName?.trim()) setFullName(user.fullName.trim());
                }}
              />
            </div>
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-xs text-mq-text-muted">{t("admin.ordersPage.productVariant")}</span>
            <div className="mt-1">
              <SearchableSelect
                options={variantOptions}
                value={variantId}
                required
                aria-label={t("admin.ordersPage.productVariant")}
                placeholder={t("admin.ordersPage.searchProduct")}
                searchPlaceholder={t("admin.ordersPage.searchProductHint")}
                onChange={setVariantId}
              />
            </div>
          </label>
          <input
            className="mq-input"
            type="number"
            min="1"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            aria-label={t("admin.ordersPage.quantity")}
          />
          <select
            className="mq-input"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
            aria-label={t("checkout.paymentMethod")}
          >
            <option value="OFF_PLATFORM">{t("checkout.paymentOffPlatform")}</option>
            <option value="MOCK">{t("checkout.paymentMock")}</option>
            <option value="COD">{t("checkout.paymentCod")}</option>
          </select>
          <input
            className="mq-input"
            placeholder={t("admin.ordersPage.fullName")}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
          <CountrySelect
            className="mq-input"
            value={country}
            onValueChange={(next) => {
              setCountry(next);
              setCity("");
              setDistrict("");
            }}
            required
            aria-label={t("admin.ordersPage.country")}
          />
          <div className="sm:col-span-2">
            <PhoneInput
              dialCountry={phoneDialCountry}
              onDialCountryChange={setPhoneDialCountry}
              value={phoneNational}
              onChange={setPhoneNational}
              required
            />
          </div>
          <AddressRegionFields
            countryCode={country}
            city={city}
            district={district}
            onCityChange={setCity}
            onDistrictChange={setDistrict}
          />
          <input
            className="mq-input sm:col-span-2"
            placeholder={t("admin.ordersPage.addressLine")}
            value={line1}
            onChange={(e) => setLine1(e.target.value)}
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
          aria-label={t("admin.common.filterStatus")}
          onChange={(e) => {
            setStatus(e.target.value as OrderStatus | "");
            setPage(1);
          }}
        >
          <option value="">{t("admin.common.all")}</option>
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
              {translateStatus(t, "order", s)}
            </option>
          ))}
        </select>
        <select
          className="mq-input max-w-[16rem]"
          value={shopId}
          aria-label={t("admin.common.shop")}
          onChange={(e) => {
            setShopId(e.target.value);
            setPage(1);
          }}
        >
          <option value="">{t("admin.common.allShops")}</option>
          {shops.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={`mq-btn text-xs ${
            escalatedOnly ? "mq-btn-primary" : "mq-btn-outline"
          }`}
          onClick={() => {
            setEscalatedOnly((v) => !v);
            setPage(1);
          }}
        >
          {t("admin.ordersPage.escalatedPayments")}
        </button>
      </div>

      <div className="space-y-4">
        {isError && (
          <div className="mq-alert mq-alert-error">
            {getErrorMessage(error, t("admin.common.failed"))}
          </div>
        )}
        {isLoading ? <AdminCardListSkeleton count={4} /> : null}
        {!isLoading && items.length === 0 ? (
          <p className="text-sm text-mq-text-muted">{t("admin.ordersPage.empty")}</p>
        ) : null}
        {items.map((o) => (
          <div
            key={o.id}
            className="mq-card p-4 flex flex-wrap justify-between gap-3 text-sm"
          >
            <div>
              <Link href={`/orders/${o.id}`} className="font-medium hover:underline">
                {o.displayName}
              </Link>
              <span className="mq-badge mq-badge-cyan ml-2">{translateStatus(t, "order", o.status)}</span>
              <p className="text-xs text-mq-text-muted mt-1">
                {o.shopName ?? `Shop ${o.shopId.slice(0, 8)}…`} · {o.buyerName ?? `Buyer ${o.buyerId.slice(0, 8)}…`} ·{" "}
                {formatMoney(o.total)} {o.currency}
              </p>
            </div>
            {o.status !== "CANCELLED" && o.status !== "DELIVERED" && o.status !== "REFUND_APPROVED" ? (
              <AdminActions>
                {canReviewPayment && canAdminForcePaid(o) ? (
                  <AdminIconButton
                    label={
                      o.paymentEscalatedAt
                        ? t("admin.ordersPage.forcePaidEscalated")
                        : t("admin.ordersPage.forcePaid")
                    }
                    icon={CircleDollarSign}
                    disabled={forcePaid.isPending}
                    onClick={() =>
                      setForcePaidTarget({ id: o.id, displayName: o.displayName })
                    }
                  />
                ) : null}
                {canReviewPayment && canAdminForcePaid(o) ? (
                  <AdminIconButton
                    label={t("orders.payment.rejectBtn")}
                    icon={X}
                    tone="reject"
                    disabled={rejectPayment.isPending}
                    onClick={() =>
                      setRejectPaymentTarget({ id: o.id, displayName: o.displayName })
                    }
                  />
                ) : null}
                <AdminIconButton
                  label={t("admin.common.cancel")}
                  icon={Ban}
                  tone="danger"
                  disabled={cancelOrder.isPending}
                  onClick={() => setCancelTarget({ id: o.id, code: o.code, displayName: o.displayName })}
                />
              </AdminActions>
            ) : null}
          </div>
        ))}
        <PaginationBar page={page} meta={meta} onPageChange={setPage} />
      </div>
      <ConfirmDialog
        open={Boolean(cancelTarget)}
        title={t("confirm.orderAdminCancelTitle")}
        description={
          cancelTarget
            ? t("confirm.orderAdminCancelDesc", { code: cancelTarget.displayName })
            : undefined
        }
        confirmLabel={t("confirm.orderAdminCancelBtn")}
        tone="danger"
        busy={cancelOrder.isPending}
        onClose={() => setCancelTarget(null)}
        onConfirm={async () => {
          if (!cancelTarget) return;
          await cancelOrder.mutateAsync({
            orderId: cancelTarget.id,
            reason: "Admin force cancel",
          });
          setCancelTarget(null);
        }}
      />
      <ConfirmDialog
        open={Boolean(forcePaidTarget)}
        title={t("admin.ordersPage.forcePaidTitle")}
        description={
          forcePaidTarget
            ? t("admin.ordersPage.forcePaidDesc", { name: forcePaidTarget.displayName })
            : undefined
        }
        confirmLabel={t("admin.ordersPage.forcePaid")}
        busy={forcePaid.isPending}
        onClose={() => setForcePaidTarget(null)}
        onConfirm={async () => {
          if (!forcePaidTarget) return;
          await forcePaid.mutateAsync({ orderId: forcePaidTarget.id });
          setForcePaidTarget(null);
        }}
      />
      <AdminReasonModal
        open={Boolean(rejectPaymentTarget)}
        title={t("orders.payment.rejectTitle")}
        description={
          rejectPaymentTarget
            ? t("admin.ordersPage.rejectPaymentDesc", {
                name: rejectPaymentTarget.displayName,
              })
            : t("orders.payment.rejectDesc")
        }
        confirmLabel={t("orders.payment.rejectBtn")}
        maxLength={500}
        busy={rejectPayment.isPending}
        onClose={() => setRejectPaymentTarget(null)}
        onConfirm={async (reason) => {
          if (!rejectPaymentTarget) return;
          await rejectPayment.mutateAsync({ orderId: rejectPaymentTarget.id, reason });
          setRejectPaymentTarget(null);
        }}
      />
    </>
  );
}

export default function AdminOrdersPage() {
  return (
    <AuthGuard roles={["ADMIN", "SUPER_ADMIN", "CS", "WAREHOUSE"]} permissions={["VIEW_ORDER", "CREATE_ORDER"]}>
      <OrdersInner />
    </AuthGuard>
  );
}
