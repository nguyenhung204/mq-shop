"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/lib/data/products";
import { useCart } from "@/components/providers/CartProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { Container, PageHero } from "@/components/ui/shared";

export function CheckoutContent() {
  const { t } = useLanguage();
  const { items, itemCount, subtotal, clearCart } = useCart();
  const [placed, setPlaced] = useState(false);

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
          <p className="text-mq-text-secondary mb-8">{t("checkout.demoNote")}</p>
          <Link href="/shop" className="mq-btn mq-btn-primary">
            {t("cart.continueShopping")}
          </Link>
        </Container>
      </>
    );
  }

  const shipping = subtotal >= 75 ? 0 : 5.99;
  const total = subtotal + shipping;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    clearCart();
    setPlaced(true);
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
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-10">
          <div className="space-y-6">
            <fieldset className="border border-mq-border p-6">
              <legend className="text-sm font-semibold uppercase tracking-wider px-2">
                {t("checkout.billingDetails")}
              </legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm mb-1.5">{t("checkout.firstName")}</label>
                  <input required className="w-full border border-mq-border bg-mq-surface px-3 py-2.5 text-sm outline-none focus:border-mq-text-muted" />
                </div>
                <div>
                  <label className="block text-sm mb-1.5">{t("checkout.lastName")}</label>
                  <input required className="w-full border border-mq-border bg-mq-surface px-3 py-2.5 text-sm outline-none focus:border-mq-text-muted" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm mb-1.5">{t("checkout.email")}</label>
                  <input type="email" required className="w-full border border-mq-border bg-mq-surface px-3 py-2.5 text-sm outline-none focus:border-mq-text-muted" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm mb-1.5">{t("checkout.address")}</label>
                  <input required className="w-full border border-mq-border bg-mq-surface px-3 py-2.5 text-sm outline-none focus:border-mq-text-muted" />
                </div>
              </div>
            </fieldset>
          </div>

          <aside className="border border-mq-border p-6 h-fit bg-mq-surface-subtle">
            <h2 className="text-lg mb-4">{t("checkout.yourOrder")}</h2>
            <ul className="space-y-3 mb-4 max-h-48 overflow-y-auto">
              {items.map((item) => (
                <li key={item.productId} className="flex gap-3 text-sm">
                  <div className="relative w-12 h-12 shrink-0 mq-product-image-bg">
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
            <button type="submit" className="mq-btn mq-btn-primary w-full mt-6">
              {t("checkout.placeOrder")}
            </button>
          </aside>
        </form>
      </Container>
    </>
  );
}
