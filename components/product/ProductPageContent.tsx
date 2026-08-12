"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Heart } from "lucide-react";
import { Product } from "@/lib/data/products";
import { useDisplayMoney } from "@/components/providers/DisplayMoneyProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { useWishlist } from "@/components/providers/WishlistProvider";
import { useFlyToCart } from "@/components/cart/FlyToCartProvider";
import { ProductActions } from "@/components/cart/ProductActions";
import { ProductShopCard } from "@/components/product/ProductShopCard";
import { ReviewList } from "@/components/reviews/ReviewList";
import { ReviewSummaryPanel } from "@/components/reviews/ReviewSummary";
import { ProductCarousel } from "@/components/ui/ProductCarousel";
import { Container, PageHero, Stars } from "@/components/ui/shared";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { useProductReviews, useProductReviewSummary } from "@/lib/queries/reviews";
import { getErrorMessage } from "@/lib/queries/utils";

const TAB_KEYS = [
  "product.tabDescription",
  "product.tabAdditional",
  "product.tabReviews",
  "product.tabShipping",
] as const;

function variantLabel(v: NonNullable<Product["variants"]>[number]): string {
  if (v.options && Object.keys(v.options).length > 0) {
    return Object.entries(v.options)
      .map(([k, val]) => `${k}: ${val}`)
      .join(" · ");
  }
  return v.sku;
}

function ProductReviewsTab({ productId }: { productId: string }) {
  const { t } = useLanguage();
  const [page, setPage] = useState(1);
  const { data: summary, isLoading: summaryLoading } = useProductReviewSummary(productId);
  const { data, isLoading, isError, error } = useProductReviews(productId, page, 10);
  const items = data?.items ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      {summaryLoading ? (
        <p className="text-sm text-mq-text-muted">{t("admin.common.loading")}</p>
      ) : summary ? (
        <ReviewSummaryPanel summary={summary} />
      ) : null}
      {isError ? (
        <div className="mq-alert mq-alert-error text-sm">
          {getErrorMessage(error, t("admin.common.failed"))}
        </div>
      ) : null}
      {isLoading ? (
        <p className="text-sm text-mq-text-muted">{t("admin.common.loading")}</p>
      ) : (
        <ReviewList items={items} />
      )}
      <PaginationBar page={page} meta={meta} onPageChange={setPage} />
    </div>
  );
}

export function ProductPageContent({
  product,
  related,
}: {
  product: Product;
  related: Product[];
}) {
  const { t } = useLanguage();
  const { formatDisplay } = useDisplayMoney();
  const { toggleItem, isInWishlist } = useWishlist();
  const { flyToWishlist } = useFlyToCart();
  const wished = isInWishlist(product.id);
  const variants = product.variants ?? [];
  const [selectedId, setSelectedId] = useState(
    product.selectedVariantId || variants[0]?.id || "",
  );
  const [tab, setTab] = useState(0);

  const selected = useMemo(
    () => variants.find((v) => v.id === selectedId) ?? variants[0],
    [variants, selectedId],
  );

  const galleryImages = useMemo(() => {
    const imgs =
      selected?.images && selected.images.length > 0
        ? selected.images
        : product.images && product.images.length > 0
          ? product.images
          : [product.image];
    return imgs.filter(Boolean);
  }, [selected, product.images, product.image]);

  const [activeIndex, setActiveIndex] = useState(0);

  // Reset to the first image whenever the selected variant's image set changes.
  useEffect(() => {
    setActiveIndex(0);
  }, [selected?.id]);

  const safeIndex = activeIndex >= galleryImages.length ? 0 : activeIndex;
  const displayImage = galleryImages[safeIndex] || product.image;

  const goToImage = (dir: -1 | 1) => {
    if (galleryImages.length <= 1) return;
    setActiveIndex((prev) => {
      const current = prev >= galleryImages.length ? 0 : prev;
      return (current + dir + galleryImages.length) % galleryImages.length;
    });
  };

  const displayPrice = selected?.price ?? product.price;
  const displayStock = selected?.availableStock ?? product.inStock;
  const outOfStock = displayStock <= 0;

  const cartProduct: Product = {
    ...product,
    price: displayPrice,
    image: displayImage,
    inStock: displayStock,
    selectedVariantId: selected?.id,
    features: outOfStock
      ? ["Out of stock"]
      : product.features.filter((f) => f !== "Out of stock"),
  };

  return (
    <>
      <PageHero
        title={product.name}
        breadcrumb={[
          { label: t("nav.shop"), href: "/shop" },
          {
            label: t(`categories.${product.categorySlug}`),
            href: `/shop?category=${product.categorySlug}`,
          },
          { label: product.name },
        ]}
      />
      <Container className="py-10 md:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,520px)_1fr] gap-10 lg:gap-16">
          <div className="mx-auto w-full max-w-[520px] lg:mx-0">
            <div
              data-mq-fly-source
              data-mq-product-gallery
              className="relative aspect-square mq-product-image-bg mq-product-media"
            >
              <Image
                key={displayImage}
                src={displayImage}
                alt={product.name}
                fill
                className="mq-product-media-img"
                sizes="(max-width:1024px) 90vw, 520px"
                quality={88}
                priority
              />
              {product.salePercent && (
                <span className="absolute top-4 left-4 mq-sale-badge z-10 shadow-sm">
                  -{product.salePercent}%
                </span>
              )}
              {outOfStock && product.displayMode === "OUT_OF_STOCK_WATERMARK" ? (
                <span className="absolute inset-0 z-10 flex items-center justify-center bg-black/35 text-white text-sm font-medium tracking-wide uppercase">
                  {t("product.outOfStock") || "Out of stock"}
                </span>
              ) : null}
              {galleryImages.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() => goToImage(-1)}
                    className="mq-carousel-btn mq-icon-btn absolute left-3 top-1/2 -translate-y-1/2 z-10"
                    aria-label={t("product.prevImage") || "Previous image"}
                  >
                    <ChevronLeft size={20} strokeWidth={1.5} />
                  </button>
                  <button
                    type="button"
                    onClick={() => goToImage(1)}
                    className="mq-carousel-btn mq-icon-btn absolute right-3 top-1/2 -translate-y-1/2 z-10"
                    aria-label={t("product.nextImage") || "Next image"}
                  >
                    <ChevronRight size={20} strokeWidth={1.5} />
                  </button>
                </>
              ) : null}
            </div>
            {galleryImages.length > 1 ? (
              <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                {galleryImages.map((img, i) => (
                  <button
                    key={img + i}
                    type="button"
                    onClick={() => setActiveIndex(i)}
                    className={`relative shrink-0 w-16 h-16 rounded-[var(--mq-radius-sm)] overflow-hidden border transition-colors ${
                      i === safeIndex
                        ? "border-mq-text"
                        : "border-mq-border hover:border-mq-text-muted"
                    }`}
                    aria-label={`${t("product.thumbnail") || "Image"} ${i + 1}`}
                  >
                    <Image
                      src={img}
                      alt={`${product.name} ${i + 1}`}
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div>
            <div className="flex flex-wrap gap-2 mb-4 text-xs">
              <span className="mq-badge mq-badge-teal">{t("product.badgeOriginal")}</span>
              <span className="mq-badge mq-badge-teal">{t("product.badgeBestPrice")}</span>
              <span className="mq-badge mq-badge-teal">{t("product.badgeFreeShipping")}</span>
            </div>
            <p className="text-xs text-mq-text-muted uppercase tracking-[0.15em] mb-2">
              {product.shop?.name || product.brand}
            </p>
            <h1 className="text-2xl md:text-[26px] font-sans text-mq-text mb-3">{product.name}</h1>
            <button
              type="button"
              className="flex items-center gap-3 mb-4 hover:opacity-80"
              onClick={() => setTab(2)}
            >
              <Stars rating={product.rating} />
              <span className="text-sm text-mq-text-muted">
                ({product.reviewCount} {t("product.reviews")})
              </span>
            </button>
            <div className="flex items-center gap-3 mb-6">
              <span className="text-2xl font-medium">{formatDisplay(displayPrice)}</span>
              {product.originalPrice && (
                <span className="text-lg text-mq-text-muted line-through">
                  {formatDisplay(product.originalPrice)}
                </span>
              )}
            </div>

            {variants.length > 0 ? (
              <div className="mb-6 space-y-2">
                <p className="text-sm font-medium text-mq-text">{t("product.options")}</p>
                <div className="flex flex-wrap gap-2">
                  {variants.map((v) => {
                    const active = v.id === selected?.id;
                    const disabled = v.availableStock <= 0;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        disabled={disabled && variants.some((x) => x.availableStock > 0)}
                        onClick={() => setSelectedId(v.id)}
                        className={`px-3 py-1.5 text-xs border rounded-[var(--mq-radius-sm)] transition-colors ${
                          active
                            ? "border-mq-text bg-mq-text text-mq-surface dark:text-mq-surface"
                            : "border-mq-border text-mq-text hover:border-mq-text"
                        } ${disabled ? "opacity-50" : ""}`}
                      >
                        {variantLabel(v)}
                      </button>
                    );
                  })}
                </div>
                {selected ? (
                  <p className="text-xs text-mq-text-muted">
                    {selected.sku}
                    {" · "}
                    {selected.availableStock > 0
                      ? t("product.stockLeft", { count: String(selected.availableStock) })
                      : t("product.outOfStock")}
                  </p>
                ) : null}
              </div>
            ) : null}

            <ul className="space-y-2 mb-6 text-sm text-mq-text-secondary">
              {cartProduct.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-mq-gold mt-0.5 shrink-0" strokeWidth={2} />
                  {f}
                </li>
              ))}
            </ul>

            {product.salePercent && (
              <div className="bg-mq-surface-subtle p-4 mb-6 text-sm">
                <p className="font-medium text-mq-accent-orange mb-1">
                  {t("product.saleEndsSoon")}
                </p>
                <p className="text-mq-text-muted">02d : 14h : 32m : 18s</p>
              </div>
            )}

            {outOfStock ? (
              <p className="mq-alert mq-alert-error mb-6 text-sm">
                This option is out of stock.
              </p>
            ) : (
              <ProductActions product={cartProduct} />
            )}

            {product.shop ? (
              <div className="mt-8 mb-2">
                <ProductShopCard shop={product.shop} />
              </div>
            ) : product.shopId ? (
              <div className="mt-8 mb-2">
                <ProductShopCard
                  shop={{
                    id: product.shopId,
                    name: t("product.sellerShop"),
                    logoUrl: null,
                  }}
                />
              </div>
            ) : null}

            <div className="flex gap-6 text-sm text-mq-text-secondary mb-8 mt-6">
              <button type="button" className="hover:text-mq-text">
                {t("product.compare")}
              </button>
              <button
                type="button"
                className={`flex items-center gap-1.5 transition-colors ${
                  wished ? "text-mq-gold" : "hover:text-mq-text"
                }`}
                onClick={(e) => {
                  const willAdd = !wished;
                  toggleItem(cartProduct);
                  if (willAdd) flyToWishlist(displayImage, e.currentTarget);
                }}
                aria-pressed={wished}
              >
                <Heart className="w-4 h-4" strokeWidth={1.5} fill={wished ? "currentColor" : "none"} />
                {wished ? t("product.wishlisted") || t("nav.wishlist") : t("nav.wishlist")}
              </button>
              <button type="button" className="hover:text-mq-text">
                {t("product.askUs")}
              </button>
            </div>

            <div className="border-t border-mq-border pt-6 space-y-3 text-sm text-mq-text-secondary">
              <p>{t("product.deliveryEstimate")}</p>
              <p>{t("product.freeShippingNote")}</p>
              <p className="text-xs text-mq-text-muted">{t("product.secureCheckout")}</p>
            </div>
          </div>
        </div>

        <div className="mt-16 border-t border-mq-border pt-10">
          <div className="flex gap-8 border-b border-mq-border mb-8 overflow-x-auto">
            {TAB_KEYS.map((key, i) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(i)}
                className={`pb-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  i === tab
                    ? "border-mq-gold text-mq-text"
                    : "border-transparent text-mq-text-muted hover:text-mq-text"
                }`}
              >
                {t(key)}
              </button>
            ))}
          </div>
          {tab === 0 ? (
            <div className="prose prose-sm max-w-none text-mq-text-secondary">
              <p>{product.description}</p>
              <p className="mt-4">
                {t("product.stock")}: {displayStock} {t("product.unitsAvailable")}
                {selected ? ` · ${selected.sku}` : null}
              </p>
            </div>
          ) : null}
          {tab === 1 ? (
            <p className="text-sm text-mq-text-secondary">
              {t("product.reviewsPage.additionalInfo")}
            </p>
          ) : null}
          {tab === 2 ? <ProductReviewsTab productId={product.id} /> : null}
          {tab === 3 ? (
            <div className="text-sm text-mq-text-secondary space-y-2">
              <p>{t("product.deliveryEstimate")}</p>
              <p>{t("product.freeShippingNote")}</p>
            </div>
          ) : null}
        </div>

        {related.length > 0 && (
          <div className="mt-16">
            <h2 className="text-2xl md:text-3xl text-mq-text mb-8">{t("product.relatedTitle")}</h2>
            <ProductCarousel products={related} />
          </div>
        )}
      </Container>
    </>
  );
}
