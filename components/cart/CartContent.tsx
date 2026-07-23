"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatPrice } from "@/lib/data/products";
import { useCart } from "@/components/providers/CartProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { Container, PageHero } from "@/components/ui/shared";

export function CartContent() {
  const { t } = useLanguage();
  const { items, itemCount, subtotal, updateQuantity, removeItem, clearCart } = useCart();

  if (itemCount === 0) {
    return (
      <>
        <PageHero title={t("cart.title")} breadcrumb={[{ label: t("nav.cart") }]} />
        <Container className="py-16 md:py-24 text-center">
          <div className="max-w-md mx-auto">
            <ShoppingBag className="w-16 h-16 mx-auto text-mq-text-muted mb-6" strokeWidth={1} />
            <h2 className="text-xl text-mq-text mb-3">{t("cart.emptyTitle")}</h2>
            <p className="text-mq-text-secondary mb-8">{t("cart.emptyDesc")}</p>
            <Link href="/shop" className="mq-btn mq-btn-primary">
              {t("cart.returnToShop")}
            </Link>
          </div>
        </Container>
      </>
    );
  }

  const itemLabel = itemCount === 1 ? t("cart.item") : t("cart.items");

  return (
    <>
      <PageHero title={t("cart.title")} breadcrumb={[{ label: t("nav.cart") }]} />
      <Container className="py-10 md:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-10">
          <div>
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-mq-border">
              <p className="text-sm text-mq-text-muted">
                {itemCount} {itemLabel} · one shop only
              </p>
              <button
                type="button"
                onClick={() => {
                  clearCart();
                  toast.success(t("cart.clearCart"));
                }}
                className="text-xs uppercase tracking-wider text-mq-text-muted hover:text-mq-text"
              >
                {t("cart.clearCart")}
              </button>
            </div>

            <ul className="divide-y divide-mq-border">
              {items.map((item) => (
                <li key={item.variantId} className="flex flex-wrap sm:flex-nowrap gap-4 py-6">
                  <Link
                    href={`/product/${item.productId}`}
                    className="relative w-24 h-[7.5rem] shrink-0 mq-product-image-bg mq-product-media"
                  >
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      className="mq-product-media-img"
                      sizes="96px"
                    />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/product/${item.productId}`}
                      className="text-sm text-mq-text hover:text-mq-gold transition-colors line-clamp-2"
                    >
                      {item.name}
                    </Link>
                    <p className="text-xs text-mq-text-muted mt-0.5">{item.sku}</p>
                    <p className="text-sm font-medium text-mq-text mt-1">
                      {formatPrice(item.unitPrice)}
                    </p>
                    <div className="flex items-center gap-3 mt-3">
                      <div className="flex items-center border border-mq-border">
                        <button
                          type="button"
                          className="w-8 h-8 flex items-center justify-center hover:bg-mq-surface-subtle"
                          onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                          aria-label="Decrease quantity"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-8 text-center text-sm">{item.quantity}</span>
                        <button
                          type="button"
                          className="w-8 h-8 flex items-center justify-center hover:bg-mq-surface-subtle"
                          onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                          aria-label="Increase quantity"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(item.variantId)}
                        className="text-mq-text-muted hover:text-mq-text"
                        aria-label="Remove item"
                      >
                        <Trash2 size={16} strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-mq-text w-full sm:w-auto text-left sm:text-right sm:shrink-0 sm:self-start">
                    {formatPrice(item.unitPrice * item.quantity)}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <aside className="border border-mq-border p-6 h-fit bg-mq-surface-subtle">
            <h2 className="text-lg text-mq-text mb-6">{t("cart.orderSummary")}</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-mq-text-secondary">{t("cart.subtotal")}</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              <p className="text-xs text-mq-text-muted">
                Shipping fee is calculated at checkout via API quote.
              </p>
              <div className="flex justify-between pt-3 border-t border-mq-border text-base font-medium">
                <span>{t("cart.subtotal")}</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
            </div>
            <Link href="/checkout" className="mq-btn mq-btn-primary w-full mt-6 block text-center">
              {t("cart.proceedCheckout")}
            </Link>
            <Link
              href="/shop"
              className="block text-center text-xs uppercase tracking-wider text-mq-text-muted hover:text-mq-text mt-4"
            >
              {t("cart.continueShopping")}
            </Link>
          </aside>
        </div>
      </Container>
    </>
  );
}
