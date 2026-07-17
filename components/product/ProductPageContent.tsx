"use client";

import Image from "next/image";
import Link from "next/link";
import { Check } from "lucide-react";
import { Product, formatPrice } from "@/lib/data/products";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { ProductActions } from "@/components/cart/ProductActions";
import { ProductCarousel } from "@/components/ui/ProductCarousel";
import { Container, PageHero, Stars } from "@/components/ui/shared";

const TAB_KEYS = [
  "product.tabDescription",
  "product.tabAdditional",
  "product.tabReviews",
  "product.tabShipping",
] as const;

export function ProductPageContent({
  product,
  related,
}: {
  product: Product;
  related: Product[];
}) {
  const { t } = useLanguage();

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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
          <div className="relative aspect-[4/5] mq-product-image-bg mq-product-media">
            <Image
              src={product.image}
              alt={product.name}
              fill
              className="mq-product-media-img"
              sizes="(max-width:1024px) 100vw, 50vw"
              quality={88}
              priority
            />
            {product.salePercent && (
              <span className="absolute top-4 left-4 mq-sale-badge z-10 shadow-sm">
                -{product.salePercent}%
              </span>
            )}
          </div>

          <div>
            <div className="flex flex-wrap gap-2 mb-4 text-xs">
              <span className="mq-badge mq-badge-teal">{t("product.badgeOriginal")}</span>
              <span className="mq-badge mq-badge-teal">{t("product.badgeBestPrice")}</span>
              <span className="mq-badge mq-badge-teal">{t("product.badgeFreeShipping")}</span>
            </div>
            <p className="text-xs text-mq-text-muted uppercase tracking-[0.15em] mb-2">{product.brand}</p>
            <h1 className="text-2xl md:text-[26px] font-sans text-mq-text mb-3">{product.name}</h1>
            <div className="flex items-center gap-3 mb-4">
              <Stars rating={product.rating} />
              <span className="text-sm text-mq-text-muted">
                ({product.reviewCount} {t("product.reviews")})
              </span>
            </div>
            <div className="flex items-center gap-3 mb-6">
              <span className="text-2xl font-medium">{formatPrice(product.price)}</span>
              {product.originalPrice && (
                <span className="text-lg text-mq-text-muted line-through">
                  {formatPrice(product.originalPrice)}
                </span>
              )}
            </div>

            <p className="text-sm text-mq-text-secondary mb-4">
              <span className="text-mq-accent-orange font-medium">12 {t("product.soldLastHour")}</span>
              {" · "}
              <span className="text-mq-accent-orange font-medium">8 {t("product.peopleViewing")}</span>
            </p>

            <ul className="space-y-2 mb-6 text-sm text-mq-text-secondary">
              {product.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-mq-gold mt-0.5 shrink-0" strokeWidth={2} />
                  {f}
                </li>
              ))}
            </ul>

            {product.salePercent && (
              <div className="bg-mq-surface-subtle p-4 mb-6 text-sm">
                <p className="font-medium text-mq-accent-orange mb-1">{t("product.saleEndsSoon")}</p>
                <p className="text-mq-text-muted">02d : 14h : 32m : 18s</p>
              </div>
            )}

            <ProductActions product={product} />

            <div className="flex gap-6 text-sm text-mq-text-secondary mb-8">
              <button type="button" className="hover:text-mq-text">{t("product.compare")}</button>
              <Link href="/wishlist" className="hover:text-mq-text">{t("nav.wishlist")}</Link>
              <button type="button" className="hover:text-mq-text">{t("product.askUs")}</button>
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
                className={`pb-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${i === 0 ? "border-mq-gold text-mq-text" : "border-transparent text-mq-text-muted hover:text-mq-text"}`}
              >
                {t(key)}
              </button>
            ))}
          </div>
          <div className="prose prose-sm max-w-none text-mq-text-secondary">
            <p>{product.description}</p>
            <p className="mt-4">
              {t("product.stock")}: {product.inStock} {t("product.unitsAvailable")}. SKU: MQ-
              {product.id.padStart(4, "0")}
            </p>
          </div>
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
