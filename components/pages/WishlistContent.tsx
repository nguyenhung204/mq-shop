"use client";

import Link from "next/link";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { useWishlist, type WishlistItem } from "@/components/providers/WishlistProvider";
import { ProductCard } from "@/components/ui/ProductCard";
import { Container, PageHero } from "@/components/ui/shared";
import type { Product } from "@/lib/data/products";

/** Build a minimal Product shape from a stored wishlist item for card rendering. */
function toProduct(item: WishlistItem): Product {
  return {
    id: item.productId,
    slug: item.slug,
    name: item.name,
    brand: "",
    price: item.price,
    minPrice: item.minPrice,
    maxPrice: item.maxPrice,
    originalPrice: item.originalPrice,
    image: item.image,
    category: "",
    categorySlug: "",
    rating: item.rating,
    reviewCount: 0,
    description: "",
    features: [],
    inStock: 1,
  };
}

export function WishlistContent() {
  const { t } = useLanguage();
  const { items, clearWishlist } = useWishlist();

  if (items.length === 0) {
    return (
      <>
        <PageHero title={t("nav.wishlist")} breadcrumb={[{ label: t("nav.wishlist") }]} />
        <Container className="py-16 md:py-24 text-center">
          <div className="max-w-md mx-auto">
            <svg
              className="w-16 h-16 mx-auto text-mq-text-muted mb-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
            <h2 className="text-xl text-mq-text mb-3">{t("wishlist.emptyTitle")}</h2>
            <p className="text-mq-text-secondary mb-8">{t("wishlist.emptyDesc")}</p>
            <Link href="/shop" className="mq-btn mq-btn-primary">
              {t("wishlist.browse")}
            </Link>
          </div>
        </Container>
      </>
    );
  }

  return (
    <>
      <PageHero title={t("nav.wishlist")} breadcrumb={[{ label: t("nav.wishlist") }]} />
      <Container className="py-10 md:py-16">
        <div className="flex items-center justify-between mb-8">
          <p className="text-sm text-mq-text-muted">
            {items.length} {t("nav.wishlist")}
          </p>
          <button
            type="button"
            className="text-sm text-mq-text-secondary hover:text-mq-gold transition-colors"
            onClick={clearWishlist}
          >
            {t("wishlist.clearAll") || "Clear all"}
          </button>
        </div>
        <div className="mq-product-grid">
          {items.map((item) => (
            <ProductCard key={item.productId} product={toProduct(item)} />
          ))}
        </div>
      </Container>
    </>
  );
}
