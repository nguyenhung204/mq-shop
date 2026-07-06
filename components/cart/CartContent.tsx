"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { formatPrice } from "@/lib/data/products";
import { useCart } from "@/components/providers/CartProvider";
import { Container, PageHero } from "@/components/ui/shared";

export function CartContent() {
  const { items, itemCount, subtotal, updateQuantity, removeItem, clearCart } =
    useCart();

  if (itemCount === 0) {
    return (
      <>
        <PageHero title="Shopping Cart" breadcrumb={[{ label: "Cart" }]} />
        <Container className="py-16 md:py-24 text-center">
          <div className="max-w-md mx-auto">
            <ShoppingBag
              className="w-16 h-16 mx-auto text-mq-text-muted mb-6"
              strokeWidth={1}
            />
            <h2 className="text-xl text-mq-text mb-3">Your cart is empty</h2>
            <p className="text-mq-text-secondary mb-8">
              Looks like you haven&apos;t added anything to your cart yet.
            </p>
            <Link href="/shop" className="mq-btn mq-btn-primary">
              Return to shop
            </Link>
          </div>
        </Container>
      </>
    );
  }

  const shipping = subtotal >= 75 ? 0 : 5.99;
  const total = subtotal + shipping;

  return (
    <>
      <PageHero title="Shopping Cart" breadcrumb={[{ label: "Cart" }]} />
      <Container className="py-10 md:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-10">
          <div>
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-mq-border">
              <p className="text-sm text-mq-text-muted">
                {itemCount} item{itemCount !== 1 ? "s" : ""}
              </p>
              <button
                type="button"
                onClick={clearCart}
                className="text-xs uppercase tracking-wider text-mq-text-muted hover:text-mq-text"
              >
                Clear cart
              </button>
            </div>

            <ul className="divide-y divide-mq-border">
              {items.map((item) => (
                <li key={item.productId} className="flex gap-4 py-6">
                  <Link
                    href={`/product/${item.slug}`}
                    className="relative w-24 h-24 shrink-0 mq-product-image-bg overflow-hidden"
                  >
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      className="object-contain p-2"
                      sizes="96px"
                    />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/product/${item.slug}`}
                      className="text-sm text-mq-text hover:text-mq-gold transition-colors line-clamp-2"
                    >
                      {item.name}
                    </Link>
                    <p className="text-sm font-medium text-mq-text mt-1">
                      {formatPrice(item.price)}
                    </p>
                    <div className="flex items-center gap-3 mt-3">
                      <div className="flex items-center border border-mq-border">
                        <button
                          type="button"
                          className="w-8 h-8 flex items-center justify-center hover:bg-mq-surface-subtle"
                          onClick={() =>
                            updateQuantity(item.productId, item.quantity - 1)
                          }
                          aria-label="Decrease quantity"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-8 text-center text-sm">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          className="w-8 h-8 flex items-center justify-center hover:bg-mq-surface-subtle"
                          onClick={() =>
                            updateQuantity(item.productId, item.quantity + 1)
                          }
                          aria-label="Increase quantity"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(item.productId)}
                        className="text-mq-text-muted hover:text-mq-text"
                        aria-label="Remove item"
                      >
                        <Trash2 size={16} strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-mq-text shrink-0">
                    {formatPrice(item.price * item.quantity)}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <aside className="border border-mq-border p-6 h-fit bg-mq-surface-subtle">
            <h2 className="text-lg text-mq-text mb-6">Order Summary</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-mq-text-secondary">Subtotal</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-mq-text-secondary">Shipping</span>
                <span>
                  {shipping === 0 ? "Free" : formatPrice(shipping)}
                </span>
              </div>
              {subtotal < 75 && (
                <p className="text-xs text-mq-text-muted">
                  Add {formatPrice(75 - subtotal)} more for free shipping
                </p>
              )}
              <div className="flex justify-between pt-3 border-t border-mq-border text-base font-medium">
                <span>Total</span>
                <span>{formatPrice(total)}</span>
              </div>
            </div>
            <Link
              href="/checkout"
              className="mq-btn mq-btn-primary w-full mt-6 block text-center"
            >
              Proceed to Checkout
            </Link>
            <Link
              href="/shop"
              className="block text-center text-xs uppercase tracking-wider text-mq-text-muted hover:text-mq-text mt-4"
            >
              Continue shopping
            </Link>
          </aside>
        </div>
      </Container>
    </>
  );
}
