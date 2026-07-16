"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { formatPrice } from "@/lib/data/products";
import { orderApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import {
  checkoutSchema,
  type CheckoutFormValues,
} from "@/lib/validations/checkout";
import { useCart } from "@/components/providers/CartProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { Container, PageHero } from "@/components/ui/shared";

export function CheckoutContent() {
  const { t } = useLanguage();
  const { isAuthenticated } = useAuth();
  const { items, itemCount, subtotal, clearCart } = useCart();
  const [placedId, setPlacedId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      shippingAddress: "",
      shippingCountry: "VN",
      paymentMethod: "COD",
    },
  });

  if (!isAuthenticated) {
    return (
      <>
        <PageHero title={t("checkout.title")} breadcrumb={[{ label: t("checkout.title") }]} />
        <Container className="py-16 text-center">
          <p className="text-mq-text-secondary mb-6">Please sign in to checkout.</p>
          <Link href="/my-account" className="mq-btn mq-btn-primary">Sign in</Link>
        </Container>
      </>
    );
  }

  if (itemCount === 0 && !placedId) {
    return (
      <>
        <PageHero title={t("checkout.title")} breadcrumb={[{ label: t("checkout.title") }]} />
        <Container className="py-16 text-center">
          <p className="text-mq-text-secondary mb-6">{t("checkout.empty")}</p>
          <Link href="/shop" className="mq-btn mq-btn-primary">{t("checkout.goToShop")}</Link>
        </Container>
      </>
    );
  }

  if (placedId) {
    return (
      <>
        <PageHero title={t("checkout.orderPlaced")} breadcrumb={[{ label: t("checkout.title") }]} />
        <Container className="py-16 text-center max-w-lg mx-auto">
          <h2 className="text-2xl text-mq-text mb-3">{t("checkout.thankYou")}</h2>
          <p className="text-mq-text-secondary mb-2">
            Payment is recorded in the system only — no automatic card/bank transfer.
          </p>
          <p className="text-sm text-mq-text-muted mb-8">Order ID: {placedId}</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href={`/orders/${placedId}`} className="mq-btn mq-btn-primary">View order</Link>
            <Link href="/shop" className="mq-btn mq-btn-outline">{t("cart.continueShopping")}</Link>
          </div>
        </Container>
      </>
    );
  }

  const shipping = subtotal >= 75 ? 0 : 5.99;
  const total = subtotal + shipping;

  const onSubmit = async (values: CheckoutFormValues) => {
    try {
      const order = await orderApi.checkout({
        paymentMethod: values.paymentMethod,
        shippingAddress: values.shippingAddress,
        shippingCountry: values.shippingCountry || undefined,
      });
      clearCart();
      setPlacedId(order.id);
      toast.success(t("checkout.orderPlaced"), {
        description: `Order #${order.id.slice(0, 8)}`,
      });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Checkout failed. Ensure API is running and cart is synced (1 shop only).";
      toast.error("Checkout failed", { description: message });
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
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-10">
          <div className="space-y-6">
            <fieldset className="border border-mq-border p-6 rounded-[var(--mq-radius-lg)] shadow-[var(--mq-shadow-sm)]">
              <legend className="text-sm font-semibold uppercase tracking-wider px-2">
                Shipping
              </legend>
              <div className="space-y-4 mt-4">
                <div>
                  <label className="block text-sm mb-1.5" htmlFor="shippingAddress">
                    {t("checkout.address")}
                  </label>
                  <textarea
                    id="shippingAddress"
                    className="mq-textarea"
                    aria-invalid={Boolean(errors.shippingAddress)}
                    {...register("shippingAddress")}
                  />
                  {errors.shippingAddress && (
                    <p className="text-xs text-mq-accent-orange mt-1.5">
                      {errors.shippingAddress.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm mb-1.5" htmlFor="shippingCountry">
                    Country (ISO α-2)
                  </label>
                  <input
                    id="shippingCountry"
                    className="mq-input"
                    maxLength={2}
                    aria-invalid={Boolean(errors.shippingCountry)}
                    {...register("shippingCountry", {
                      onChange: (e) => {
                        e.target.value = e.target.value.toUpperCase();
                      },
                    })}
                  />
                  {errors.shippingCountry && (
                    <p className="text-xs text-mq-accent-orange mt-1.5">
                      {errors.shippingCountry.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm mb-1.5" htmlFor="paymentMethod">
                    Payment method
                  </label>
                  <select
                    id="paymentMethod"
                    className="mq-input"
                    {...register("paymentMethod")}
                  >
                    <option value="COD">Cash on delivery (COD)</option>
                    <option value="BANK_TRANSFER">Bank transfer</option>
                    <option value="CARD">Card</option>
                  </select>
                  <p className="text-xs text-mq-text-muted mt-2">
                    No PSP redirect yet — selection is recorded only. COD awaits Admin confirm.
                  </p>
                </div>
              </div>
            </fieldset>
          </div>

          <aside className="border border-mq-border p-6 h-fit bg-mq-surface-subtle rounded-[var(--mq-radius-lg)] shadow-[var(--mq-shadow-sm)]">
            <h2 className="text-lg mb-4">{t("checkout.yourOrder")}</h2>
            <ul className="space-y-3 mb-4 max-h-48 overflow-y-auto">
              {items.map((item) => (
                <li key={item.productId} className="flex gap-3 text-sm">
                  <div className="relative w-12 h-12 shrink-0 mq-product-image-bg rounded-[var(--mq-radius-sm)] overflow-hidden">
                    <Image src={item.image} alt="" fill className="object-contain p-1" sizes="48px" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="line-clamp-1">{item.name}</p>
                    <p className="text-mq-text-muted">× {item.quantity}</p>
                  </div>
                  <span>{formatPrice(item.price * item.quantity)}</span>
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
                <span>{shipping === 0 ? t("cart.free") : formatPrice(shipping)}</span>
              </div>
              <div className="flex justify-between font-medium text-base pt-2">
                <span>{t("cart.total")}</span>
                <span>{formatPrice(total)}</span>
              </div>
            </div>
            <button type="submit" className="mq-btn mq-btn-primary w-full mt-6" disabled={isSubmitting}>
              {isSubmitting ? "Placing…" : t("checkout.placeOrder")}
            </button>
          </aside>
        </form>
      </Container>
    </>
  );
}
