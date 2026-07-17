"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { BarChart2, Eye, Heart, iconProps } from "@/components/ui/icons";
import { AddToCartButton } from "@/components/cart/AddToCartButton";
import { SaleCountdown } from "@/components/ui/SaleCountdown";
import { Product, formatPrice } from "@/lib/data/products";
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

  return (
    <article
      className="group mq-product-card"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Link href={`/product/${product.slug}`} className="block flex-1">
        <div data-mq-fly-source className="relative aspect-[4/5] mq-product-image-bg mq-product-media mb-3.5">
          <Image
            src={product.image}
            alt={product.name}
            fill
            priority={priority}
            className="mq-product-media-img"
            sizes={compact ? "120px" : "(max-width:768px) 45vw, 260px"}
            quality={82}
          />

          {product.salePercent && (
            <span className="absolute top-3 left-3 mq-sale-badge z-10 shadow-sm">
              -{product.salePercent}%
            </span>
          )}

          <div
            className={`absolute top-3 right-3 z-10 flex items-center gap-0.5 rounded-full bg-white/90 dark:bg-black/55 backdrop-blur-md px-1 py-1 shadow-[var(--mq-shadow-sm)] transition-all duration-300 max-md:opacity-100 ${
              hovered ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1"
            }`}
          >
            <button
              type="button"
              className="w-8 h-8 flex items-center justify-center rounded-full text-mq-text dark:text-white hover:text-mq-gold transition-colors"
              aria-label="Wishlist"
              onClick={(e) => e.preventDefault()}
            >
              <Heart {...iconProps} />
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

        <h3 className="text-[13px] leading-snug text-mq-text font-medium line-clamp-2 min-h-[2.5rem]">
          {product.name}
        </h3>
        <div className="mt-1.5">
          <Stars rating={product.rating} />
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-sm font-semibold text-mq-text">
            {formatPrice(product.price)}
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

export function ProductCardMini({ product }: { product: Product }) {
  return (
    <Link
      href={`/product/${product.slug}`}
      className="flex items-center gap-3 group py-2"
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
        <p className="text-xs text-mq-text leading-snug line-clamp-2 group-hover:text-mq-gold transition-colors">
          {product.name}
        </p>
        <p className="text-xs font-semibold text-mq-text mt-0.5">
          {formatPrice(product.price)}
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
