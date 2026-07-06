"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { BarChart2, Eye, Heart, iconProps } from "@/components/ui/icons";
import { AddToCartButton } from "@/components/cart/AddToCartButton";
import { Product, formatPrice } from "@/lib/data/products";
import { Stars } from "./shared";

export function ProductCard({
  product,
  compact = false,
}: {
  product: Product;
  compact?: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <article
      className="group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Link href={`/product/${product.slug}`} className="block">
        <div className="relative aspect-square mq-product-image-bg overflow-hidden mb-3">
          <Image
            src={product.image}
            alt={product.name}
            fill
            className="object-contain p-4 transition-opacity duration-300 group-hover:opacity-90"
            sizes={compact ? "120px" : "(max-width:768px) 45vw, 240px"}
            quality={75}
          />

          {product.salePercent && (
            <span className="absolute top-0 left-0 mq-sale-badge">
              -{product.salePercent}%
            </span>
          )}

          {/* Hover action bar — top */}
          <div
            className={`absolute top-0 left-0 right-0 flex items-center justify-center gap-1 bg-black/60 py-2 transition-opacity duration-200 ${hovered ? "opacity-100" : "opacity-0"}`}
          >
            <button
              type="button"
              className="w-8 h-8 flex items-center justify-center text-white hover:text-mq-gold transition-colors"
              aria-label="Wishlist"
              onClick={(e) => e.preventDefault()}
            >
              <Heart {...iconProps} />
            </button>
            <button
              type="button"
              className="w-8 h-8 flex items-center justify-center text-white hover:text-mq-gold transition-colors"
              aria-label="Compare"
              onClick={(e) => e.preventDefault()}
            >
              <BarChart2 {...iconProps} />
            </button>
            <button
              type="button"
              className="w-8 h-8 flex items-center justify-center text-white hover:text-mq-gold transition-colors"
              aria-label="Quick view"
              onClick={(e) => e.preventDefault()}
            >
              <Eye {...iconProps} />
            </button>
          </div>

          {product.salePercent && (
            <div className="mq-countdown">
              565d : 19h : 08m : 10s
            </div>
          )}
        </div>

        <h3 className="text-[13px] leading-snug text-mq-text font-normal line-clamp-2 min-h-[2.5rem]">
          {product.name}
        </h3>
        <div className="mt-1.5">
          <Stars rating={product.rating} />
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-sm font-medium text-mq-text">
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
        className={`mq-btn mq-btn-cart mt-2 max-md:opacity-100 transition-opacity duration-200 ${hovered ? "opacity-100" : "opacity-0"}`}
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
      <div className="relative w-16 h-16 shrink-0 mq-product-image-bg overflow-hidden">
        <Image
          src={product.image}
          alt={product.name}
          fill
          className="object-contain p-1"
          sizes="64px"
          quality={60}
        />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-mq-text leading-snug line-clamp-2 group-hover:text-mq-gold transition-colors">
          {product.name}
        </p>
        <p className="text-xs font-medium text-mq-text mt-0.5">
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
}: {
  name: string;
  slug: string;
  image: string;
}) {
  return (
    <Link
      href={`/shop?category=${slug}`}
      className="group flex flex-col items-center gap-3 shrink-0"
      style={{ width: 150 }}
    >
      <div className="relative w-[130px] h-[130px] rounded-full overflow-hidden border border-mq-border mq-product-image-bg">
        <Image
          src={image}
          alt={name}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          sizes="130px"
          quality={70}
        />
      </div>
      <span className="text-sm font-medium text-mq-text group-hover:text-mq-gold transition-colors">
        {name}
      </span>
    </Link>
  );
}
