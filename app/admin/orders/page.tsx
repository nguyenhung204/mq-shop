"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Ban } from "lucide-react";
import { adminApi } from "@/lib/api";
import type { OrderStatus } from "@/lib/api/orders";
import type { ApiProduct, AuthUser, ProductVariant } from "@/lib/api/types";
import { formatMoney, parsePage } from "@/lib/api/utils";
import {
  useAdminCancelOrder,
  useAdminCheckout,
  useAdminOrders,
  useAdminShippingQuote,
} from "@/lib/queries/orders";
import { useAdminProducts, useAdminShops } from "@/lib/queries/admin";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { AdminActions, AdminIconButton } from "@/components/admin/AdminIconButton";
import { CountrySelect } from "@/components/ui/CountrySelect";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { AddressRegionFields } from "@/components/ui/AddressRegionFields";
import { PaginationBar } from "@/components/ui/PaginationBar";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/ui/SearchableSelect";
import { AdminCardListSkeleton } from "@/components/ui/Skeleton";
import { isValidNationalPhone, toE164 } from "@/lib/data/phone";

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
  const [status, setStatus] = useState<OrderStatus | "">("PENDING");
  const [shopId, setShopId] = useState("");
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
  const [phoneNational, setPhoneNational] = useState("");
  const [phoneDialCountry, setPhoneDialCountry] = useState("VN");
  const [country, setCountry] = useState("VN");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [line1, setLine1] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"COD" | "MOCK">("COD");
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
          <label className="block text-sm sm:col-span-2">
            <span className="text-xs text-mq-text-muted">Buyer</span>
            <div className="mt-1">
              <SearchableSelect
                options={buyerOptions}
                value={buyerId}
                required
                aria-label="Buyer"
                placeholder="Search buyer by name or email…"
                searchPlaceholder="Name or email…"
                onChange={(id) => {
                  setBuyerId(id);
                  const user = buyers.find((u) => u.id === id);
                  if (user?.fullName?.trim()) setFullName(user.fullName.trim());
                }}
              />
            </div>
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-xs text-mq-text-muted">Product variant</span>
            <div className="mt-1">
              <SearchableSelect
                options={variantOptions}
                value={variantId}
                required
                aria-label="Product variant"
                placeholder="Search product, SKU, or variant…"
                searchPlaceholder="Product, SKU, options…"
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
            aria-label="Quantity"
          />
          <select
            className="mq-input"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as "COD" | "MOCK")}
            aria-label="Payment method"
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
          <CountrySelect
            className="mq-input"
            value={country}
            onValueChange={(next) => {
              setCountry(next);
              setCity("");
              setDistrict("");
            }}
            required
            aria-label="Country"
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
            placeholder="Address line"
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
