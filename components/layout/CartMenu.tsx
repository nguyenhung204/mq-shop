"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { formatPrice } from "@/lib/data/products";
import { useCart } from "@/components/providers/CartProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { QuantityStepper } from "@/components/ui/QuantityStepper";

const PREVIEW_LIMIT = 5;

export function CartMenu({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useLanguage();
  const { items, itemCount, formatSubtotal, updateQuantity } = useCart();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const preview = items.slice(0, PREVIEW_LIMIT);
  const remaining = Math.max(0, items.length - PREVIEW_LIMIT);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (rootRef.current && !rootRef.current.contains(target)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    onNavigate?.();
  };

  return (
    <div
      ref={rootRef}
      className={`mq-cart-menu${open ? " is-open" : ""}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <Link
        id="mq-cart-target"
        href="/cart"
        className="mq-icon-btn mq-cart-menu-trigger relative text-mq-text hover:text-mq-gold transition-colors"
        aria-label={t("nav.cart")}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={close}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
          />
        </svg>
        {itemCount > 0 ? <span className="mq-count-badge">{itemCount}</span> : null}
      </Link>

      <div id={menuId} className="mq-cart-menu-dropdown" role="dialog" aria-label={t("nav.cart")}>
        {itemCount === 0 ? (
          <div className="mq-cart-menu-empty">
            <p className="text-sm text-mq-text-secondary">{t("cart.emptyTitle")}</p>
            <Link href="/shop" className="mq-btn mq-btn-outline text-xs mt-3 w-full" onClick={close}>
              {t("cart.returnToShop")}
            </Link>
          </div>
        ) : (
          <>
            <div className="mq-cart-menu-head">
              <p className="mq-cart-menu-count">
                {itemCount} {itemCount === 1 ? t("cart.item") : t("cart.items")}
              </p>
              <p className="mq-cart-menu-subtotal">
                {t("cart.subtotal")}: <strong>{formatSubtotal()}</strong>
              </p>
            </div>
            <ul className="mq-cart-menu-list">
              {preview.map((item) => (
                <li key={item.variantId} className="mq-cart-menu-item">
                  <Link
                    href={`/product/${item.productId}`}
                    className="mq-cart-menu-row"
                    onClick={close}
                  >
                    <span className="mq-cart-menu-thumb mq-product-image-bg mq-product-media">
                      <Image
                        src={item.image}
                        alt=""
                        fill
                        className="mq-product-media-img"
                        sizes="48px"
                      />
                    </span>
                    <span className="mq-cart-menu-meta">
                      <span className="mq-cart-menu-name">{item.name}</span>
                      <span className="mq-cart-menu-sku">{item.sku}</span>
                    </span>
                    <span className="mq-cart-menu-price">
                      {formatPrice(item.unitPrice * item.quantity)}
                    </span>
                  </Link>
                  <div className="mq-cart-menu-qty">
                    <QuantityStepper
                      size="sm"
                      value={item.quantity}
                      min={1}
                      onChange={(next) => updateQuantity(item.variantId, next)}
                    />
                  </div>
                </li>
              ))}
            </ul>
            {remaining > 0 ? (
              <p className="mq-cart-menu-more">
                +{remaining} {t("cart.moreInCart")}
              </p>
            ) : null}
            <div className="mq-cart-menu-actions">
              <Link href="/cart" className="mq-btn mq-btn-primary w-full text-xs" onClick={close}>
                {t("cart.viewAll")}
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
