"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { BarChart2, Eye, Heart, iconProps } from "@/components/ui/icons";
import { AddToCartButton } from "@/components/cart/AddToCartButton";
import { SaleCountdown } from "@/components/ui/SaleCountdown";
import { Product, formatPrice } from "@/lib/data/products";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { useWishlist } from "@/components/providers/WishlistProvider";
import { useFlyToCart } from "@/components/cart/FlyToCartProvider";
import { Stars } from "./shared";

export function ProductCard({
  product,
  compact = false,
  priority = false,
}: {
  product: Product;
  compact?: boolean;
  priority?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const { locale, t } = useLanguage();
  const { toggleItem, isInWishlist } = useWishlist();
  const { flyToWishlist } = useFlyToCart();
  const wished = isInWishlist(product.id);
  const watermark =
    locale?.startsWith("vi")
      ? product.watermarkText?.vi
      : locale?.startsWith("zh")
        ? product.watermarkText?.zh
        : product.watermarkText?.en;

  return (
    <article
      className="group mq-product-card"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Link href={`/product/${product.slug}`} className="block flex-1">
        <div data-mq-fly-source className="relative aspect-square mq-product-image-bg mq-product-media mb-3.5">
          <Image
            src={product.image}
            alt={product.name}
            fill
            priority={priority}
            className="mq-product-media-img"
            sizes={compact ? "120px" : "(max-width:768px) 48vw, 300px"}
            quality={82}
          />

          {product.salePercent && (
            <span className="absolute top-3 left-3 mq-sale-badge z-10 shadow-sm">
              -{product.salePercent}%
            </span>
          )}

          {product.displayMode === "OUT_OF_STOCK_WATERMARK" && (
            <div className="absolute inset-0 z-[5] flex items-center justify-center bg-black/35 rounded-[inherit]">
              <span className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white bg-black/70 rounded-[var(--mq-radius-sm)]">
                {watermark ||
                  product.watermarkText?.en ||
                  product.watermarkText?.vi ||
                  "Out of stock"}
              </span>
            </div>
          )}

          <div
            className={`absolute top-3 right-3 z-10 flex items-center gap-0.5 rounded-full bg-white/90 dark:bg-black/55 backdrop-blur-md px-1 py-1 shadow-[var(--mq-shadow-sm)] transition-all duration-300 max-md:opacity-100 ${
              hovered ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1"
            }`}
          >
            <button
              type="button"
              className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
                wished
                  ? "text-mq-gold"
                  : "text-mq-text dark:text-white hover:text-mq-gold"
              }`}
              aria-label={t("nav.wishlist")}
              aria-pressed={wished}
              onClick={(e) => {
                e.preventDefault();
                const willAdd = !wished;
                toggleItem(product);
                if (willAdd) flyToWishlist(product.image, e.currentTarget);
              }}
            >
              <Heart {...iconProps} fill={wished ? "currentColor" : "none"} />
            </button>
            <button
              type="button"
              className="w-8 h-8 flex items-center justify-center rounded-full text-mq-text dark:text-white hover:text-mq-gold transition-colors"
              aria-label="Compare"
              onClick={(e) => e.preventDefault()}
            >
              <BarChart2 {...iconProps} />
            </button>
            <button
              type="button"
              className="w-8 h-8 flex items-center justify-center rounded-full text-mq-text dark:text-white hover:text-mq-gold transition-colors"
              aria-label="Quick view"
              onClick={(e) => e.preventDefault()}
            >
              <Eye {...iconProps} />
            </button>
          </div>

          {product.salePercent ? <SaleCountdown seed={product.id} /> : null}
        </div>

        <h3
          className="text-[16px] leading-snug text-mq-text font-medium truncate"
          title={product.name}
        >
          {product.name}
        </h3>
        <div className="mt-1.5">
          <Stars rating={product.rating} />
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-sm font-semibold text-mq-text">
            {product.minPrice != null &&
            product.maxPrice != null &&
            product.minPrice !== product.maxPrice
              ? `${formatPrice(product.minPrice)} – ${formatPrice(product.maxPrice)}`
              : formatPrice(product.price)}
          </span>
          {product.originalPrice && (
            <span className="text-sm text-mq-text-muted line-through">
              {formatPrice(product.originalPrice)}
            </span>
          )}
        </div>
      </Link>

      <AddToCartButton
        product={product}
        className={`mq-btn mq-btn-cart mt-2.5 max-md:opacity-100 transition-opacity duration-200 ${hovered ? "opacity-100" : "opacity-0"}`}
      />
    </article>
  );
}

export function ProductCardMini({
  product,
  onNavigate,
}: {
  product: Product;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={`/product/${product.slug}`}
      className="flex items-center gap-3 group py-2"
      onClick={onNavigate}
    >
      <div className="relative w-[4.25rem] h-[4.25rem] shrink-0 mq-product-image-bg mq-product-media">
        <Image
          src={product.image}
          alt={product.name}
          fill
          className="mq-product-media-img"
          sizes="68px"
          quality={70}
        />
      </div>
      <div className="min-w-0">
        <p
          className="text-xs text-mq-text leading-snug truncate group-hover:text-mq-gold transition-colors"
          title={product.name}
        >
          {product.name}
        </p>
        <p className="text-xs font-semibold text-mq-text mt-0.5">
          {product.minPrice != null &&
          product.maxPrice != null &&
          product.minPrice !== product.maxPrice
            ? `${formatPrice(product.minPrice)} – ${formatPrice(product.maxPrice)}`
            : formatPrice(product.price)}
          {product.originalPrice && (
            <span className="text-mq-text-muted line-through ml-1.5 font-normal">
              {formatPrice(product.originalPrice)}
            </span>
          )}
        </p>
      </div>
    </Link>
  );
}

export function CategoryCard({
  name,
  slug,
  image,
  priority = false,
}: {
  name: string;
  slug: string;
  image: string;
  priority?: boolean;
}) {
  return (
    <Link
      href={`/shop?category=${slug}`}
      className="group flex flex-col items-center gap-3 shrink-0 w-[min(150px,28vw)]"
    >
      <div className="relative w-full max-w-[130px] aspect-square rounded-full overflow-hidden border border-mq-border mq-product-image-bg shadow-[var(--mq-shadow-sm)]">
        <Image
          src={image}
          alt={name}
          fill
          priority={priority}
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          sizes="130px"
          quality={75}
        />
      </div>
      <span className="text-sm font-medium text-mq-text group-hover:text-mq-gold transition-colors">
        {name}
      </span>
    </Link>
  );
}
