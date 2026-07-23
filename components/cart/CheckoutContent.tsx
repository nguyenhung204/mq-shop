"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { formatPrice } from "@/lib/data/products";
import { ApiError } from "@/lib/api/client";
import {
  checkoutSchema,
  type CheckoutFormValues,
} from "@/lib/validations/checkout";
import { useCheckout, useShippingQuote } from "@/lib/queries/orders";
import { useCart } from "@/components/providers/CartProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { Container, PageHero } from "@/components/ui/shared";

export function CheckoutContent() {
  const { t } = useLanguage();
  const { isAuthenticated } = useAuth();
  const { items, itemCount, subtotal, clearCart, checkoutItems } = useCart();
  const [placed, setPlaced] = useState<{ id: string; code: string; total: number } | null>(
    null,
  );
  const [shippingFee, setShippingFee] = useState<number | null>(null);
  const quote = useShippingQuote();
  const checkout = useCheckout();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      shippingAddress: {
        fullName: "",
        phone: "",
        line1: "",
        line2: "",
        city: "",
        district: "",
        postalCode: "",
        country: "VN",
      },
      paymentMethod: "MOCK",
      note: "",
    },
  });

  const address = watch("shippingAddress");
  const lineItems = useMemo(() => checkoutItems(), [items]);

  useEffect(() => {
    if (!isAuthenticated || lineItems.length === 0) return;
    if (!address?.fullName || !address.phone || !address.line1 || !address.city) {
      setShippingFee(null);
      return;
    }
    const handle = window.setTimeout(() => {
      void quote
        .mutateAsync({
          items: lineItems,
          shippingAddress: {
            ...address,
            country: address.country || "VN",
          },
        })
        .then((q) => setShippingFee(q.shippingFee))
        .catch(() => setShippingFee(null));
    }, 400);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce on address/items only
  }, [
    isAuthenticated,
    lineItems,
    address?.fullName,
    address?.phone,
    address?.line1,
    address?.city,
    address?.district,
    address?.country,
  ]);

  if (!isAuthenticated) {
    return (
      <>
        <PageHero title={t("checkout.title")} breadcrumb={[{ label: t("checkout.title") }]} />
        <Container className="py-16 text-center">
          <p className="text-mq-text-secondary mb-6">Please sign in to checkout.</p>
          <Link href="/my-account" className="mq-btn mq-btn-primary">
            Sign in
          </Link>
        </Container>
      </>
    );
  }

  if (itemCount === 0 && !placed) {
    return (
      <>
        <PageHero title={t("checkout.title")} breadcrumb={[{ label: t("checkout.title") }]} />
        <Container className="py-16 text-center">
          <p className="text-mq-text-secondary mb-6">{t("checkout.empty")}</p>
          <Link href="/shop" className="mq-btn mq-btn-primary">
            {t("checkout.goToShop")}
          </Link>
        </Container>
      </>
    );
  }

  if (placed) {
    return (
      <>
        <PageHero title={t("checkout.orderPlaced")} breadcrumb={[{ label: t("checkout.title") }]} />
        <Container className="py-16 text-center max-w-lg mx-auto">
          <h2 className="text-2xl text-mq-text mb-3">{t("checkout.thankYou")}</h2>
          <p className="text-mq-text-secondary mb-2">
            Order <strong>{placed.code}</strong> · {formatPrice(placed.total)} USD
          </p>
          <p className="text-sm text-mq-text-muted mb-8">
            Payment is stubbed (COD → PENDING, MOCK → PAID). No PSP redirect.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href={`/orders/${placed.id}`} className="mq-btn mq-btn-primary">
              View order
            </Link>
            <Link href="/shop" className="mq-btn mq-btn-outline">
              {t("cart.continueShopping")}
            </Link>
          </div>
        </Container>
      </>
    );
  }

  const previewTotal = subtotal + (shippingFee ?? 0);

  const onSubmit = async (values: CheckoutFormValues) => {
    try {
      const order = await checkout.mutateAsync({
        items: checkoutItems(),
        shippingAddress: {
          ...values.shippingAddress,
          country: values.shippingAddress.country || "VN",
        },
        paymentMethod: values.paymentMethod,
        note: values.note || undefined,
      });
      clearCart();
      setPlaced({ id: order.id, code: order.code, total: order.total });
      toast.success(t("checkout.orderPlaced"), {
        description: order.code,
      });
    } catch (err) {
      if (!(err instanceof ApiError)) {
        toast.error("Checkout failed");
      }
    }
  };

  return (
    <>
      <PageHero
        title={t("checkout.title")}
        breadcrumb={[
          { label: t("nav.cart"), href: "/cart" },
          { label: t("checkout.title") },
        ]}
      />
      <Container className="py-10 md:py-16">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-10"
        >
          <div className="space-y-6">
            <fieldset className="border border-mq-border p-6 rounded-[var(--mq-radius-lg)] shadow-[var(--mq-shadow-sm)]">
              <legend className="text-sm font-semibold uppercase tracking-wider px-2">
                Shipping
              </legend>
              <div className="grid sm:grid-cols-2 gap-4 mt-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm mb-1.5" htmlFor="fullName">
                    Full name
                  </label>
                  <input
                    id="fullName"
                    className="mq-input"
                    {...register("shippingAddress.fullName")}
                  />
                  {errors.shippingAddress?.fullName && (
                    <p className="text-xs text-mq-accent-orange mt-1.5">
                      {errors.shippingAddress.fullName.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm mb-1.5" htmlFor="phone">
                    Phone
                  </label>
                  <input id="phone" className="mq-input" {...register("shippingAddress.phone")} />
                  {errors.shippingAddress?.phone && (
                    <p className="text-xs text-mq-accent-orange mt-1.5">
                      {errors.shippingAddress.phone.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm mb-1.5" htmlFor="country">
                    Country
                  </label>
                  <input
                    id="country"
                    className="mq-input"
                    maxLength={2}
                    {...register("shippingAddress.country", {
                      onChange: (e) => {
                        e.target.value = e.target.value.toUpperCase();
                      },
                    })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm mb-1.5" htmlFor="line1">
                    Address
                  </label>
                  <input id="line1" className="mq-input" {...register("shippingAddress.line1")} />
                  {errors.shippingAddress?.line1 && (
                    <p className="text-xs text-mq-accent-orange mt-1.5">
                      {errors.shippingAddress.line1.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm mb-1.5" htmlFor="city">
                    City
                  </label>
                  <input id="city" className="mq-input" {...register("shippingAddress.city")} />
                  {errors.shippingAddress?.city && (
                    <p className="text-xs text-mq-accent-orange mt-1.5">
                      {errors.shippingAddress.city.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm mb-1.5" htmlFor="district">
                    District
                  </label>
                  <input
                    id="district"
                    className="mq-input"
                    {...register("shippingAddress.district")}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm mb-1.5" htmlFor="paymentMethod">
                    Payment method
                  </label>
                  <select
                    id="paymentMethod"
                    className="mq-input"
                    {...register("paymentMethod")}
                  >
                    <option value="MOCK">MOCK (instant PAID — dev)</option>
                    <option value="COD">COD (PENDING until paid outside)</option>
                  </select>
                  <p className="text-xs text-mq-text-muted mt-2">
                    Currency USD. Shipping fee from `POST /orders/shipping-quote` (stub).
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm mb-1.5" htmlFor="note">
                    Note (optional)
                  </label>
                  <textarea id="note" className="mq-textarea" {...register("note")} />
                </div>
              </div>
            </fieldset>
          </div>

          <aside className="border border-mq-border p-6 h-fit bg-mq-surface-subtle rounded-[var(--mq-radius-lg)] shadow-[var(--mq-shadow-sm)]">
            <h2 className="text-lg mb-4">{t("checkout.yourOrder")}</h2>
            <ul className="space-y-3 mb-4 max-h-48 overflow-y-auto">
              {items.map((item) => (
                <li key={item.variantId} className="flex gap-3 text-sm">
                  <div className="relative w-12 h-12 shrink-0 mq-product-image-bg mq-product-media">
                    <Image src={item.image} alt="" fill className="mq-product-media-img" sizes="48px" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="line-clamp-1">{item.name}</p>
                    <p className="text-mq-text-muted text-xs">
                      {item.sku} × {item.quantity}
                    </p>
                  </div>
                  <span>{formatPrice(item.unitPrice * item.quantity)}</span>
                </li>
              ))}
            </ul>
            <div className="space-y-2 text-sm border-t border-mq-border pt-4">
              <div className="flex justify-between">
                <span>{t("cart.subtotal")}</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>{t("cart.shipping")}</span>
                <span>
                  {shippingFee == null
                    ? quote.isPending
                      ? "…"
                      : "—"
                    : formatPrice(shippingFee)}
                </span>
              </div>
              <div className="flex justify-between font-medium text-base pt-2">
                <span>{t("cart.total")} (est.)</span>
                <span>{formatPrice(previewTotal)}</span>
              </div>
            </div>
            <button
              type="submit"
              className="mq-btn mq-btn-primary w-full mt-6"
              disabled={isSubmitting || checkout.isPending}
            >
              {isSubmitting || checkout.isPending ? "Placing…" : t("checkout.placeOrder")}
            </button>
          </aside>
        </form>
      </Container>
    </>
  );
}
