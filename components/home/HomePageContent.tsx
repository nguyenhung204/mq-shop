"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CreditCard, Headphones, RotateCcw, ShieldCheck } from "lucide-react";
import { catalogApi } from "@/lib/api";
import { mapListingCard } from "@/lib/api/mapProduct";
import type { ApiCategory } from "@/lib/api/types";
import type { Product } from "@/lib/data/products";
import { categoryImages, miscImages } from "@/lib/images";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { HeroSlider } from "@/components/home/HeroSlider";
import { CategoryMarquee } from "@/components/home/CategoryMarquee";
import { FeaturedReviews } from "@/components/home/FeaturedReviews";
import { ProductCarousel } from "@/components/ui/ProductCarousel";
import { Container, SectionHeading } from "@/components/ui/shared";

const FALLBACK_CATEGORY_IMAGES: Record<string, string> = {
  electronics: categoryImages.tech,
  fashion: categoryImages.apparel,
  "home-living": categoryImages.home,
  beauty: categoryImages.gifts,
  toys: categoryImages.accessories,
  accessories: categoryImages.accessories,
  apparel: categoryImages.apparel,
  home: categoryImages.home,
  tech: categoryImages.tech,
  gifts: categoryImages.gifts,
  essentials: categoryImages.essentials,
};

export function HomePageContent() {
  const { t, locale } = useLanguage();
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [listing, setListing] = useState<Product[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoadingCats(true);
    void catalogApi
      .categories()
      .then(setCategories)
      .catch(() => setCategories([]))
      .finally(() => setLoadingCats(false));
  }, []);

  useEffect(() => {
    setLoadingProducts(true);
    setError(null);
    void catalogApi
      .listing({ page: 1, pageSize: 24 })
      .then((res) => {
        setListing(res.items.map((p) => mapListingCard(p)));
      })
      .catch((err: unknown) => {
        setListing([]);
        setError(err instanceof Error ? err.message : t("home.loadProductsFailed"));
      })
      .finally(() => setLoadingProducts(false));
  }, [t]);

  const inStock = useMemo(
    () => listing.filter((p) => p.inStock > 0 && p.displayMode !== "OUT_OF_STOCK_WATERMARK"),
    [listing],
  );
  const newest = useMemo(
    () =>
      [...listing]
        .sort((a, b) => {
          const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
          const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
          return tb - ta;
        })
        .slice(0, 12),
    [listing],
  );
  const featured = useMemo(() => {
    const sorted = [...listing].sort((a, b) => b.price - a.price);
    return sorted.slice(0, 12);
  }, [listing]);
  const picks = useMemo(() => (inStock.length ? inStock : listing).slice(0, 12), [inStock, listing]);

  const categoryImage = useCallback(
    (slug: string) => FALLBACK_CATEGORY_IMAGES[slug] || categoryImages.accessories,
    [],
  );

  const trustIcons = [
    { title: t("home.trustPayment"), desc: t("home.trustPaymentDesc"), Icon: CreditCard },
    { title: t("home.trustSupport"), desc: t("home.trustSupportDesc"), Icon: Headphones },
    { title: t("home.trustReturns"), desc: t("home.trustReturnsDesc"), Icon: RotateCcw },
    { title: t("home.trustQuality"), desc: t("home.trustQualityDesc"), Icon: ShieldCheck },
  ];

  return (
    <>
      <HeroSlider />

      <section className="pt-10 pb-14 md:pt-14 md:pb-20">
        <Container>
          {loadingCats ? (
            <div className="mq-carousel-track gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="shrink-0 w-[140px] md:w-[180px] aspect-[3/4] rounded-[var(--mq-radius-lg)] bg-mq-surface-subtle animate-pulse"
                />
              ))}
            </div>
          ) : categories.length === 0 ? (
            <p className="text-sm text-mq-text-muted text-center py-8">{t("home.noCategories")}</p>
          ) : (
            <CategoryMarquee
              categories={categories}
              locale={locale}
              imageFor={categoryImage}
            />
          )}
        </Container>
      </section>

      {error ? (
        <Container className="pb-8">
          <div className="mq-alert mq-alert-error">{error}</div>
        </Container>
      ) : null}

      <section className="py-14 md:py-20 bg-mq-surface-subtle">
        <Container>
          <SectionHeading
            label={t("home.seasonSale")}
            title={t("home.forEveryMoment")}
            action={{ label: t("common.shopAll"), href: "/shop" }}
          />
          {loadingProducts ? (
            <ProductCarouselSkeleton />
          ) : picks.length === 0 ? (
            <EmptyProducts />
          ) : (
            <ProductCarousel products={picks} priorityCount={2} />
          )}
        </Container>
      </section>

      <section className="py-14 md:py-20">
        <Container>
          <SectionHeading
            label={t("home.justArrived")}
            title={t("home.newAtMq")}
            action={{ label: t("common.shopAll"), href: "/shop" }}
          />
          {loadingProducts ? (
            <ProductCarouselSkeleton />
          ) : newest.length === 0 ? (
            <EmptyProducts />
          ) : (
            <ProductCarousel products={newest} />
          )}
        </Container>
      </section>

      <section className="py-14 md:py-20 bg-mq-surface-subtle">
        <Container>
          <SectionHeading
            label={t("home.featured")}
            title={t("home.curatedSelection")}
            action={{ label: t("common.seeCollection"), href: "/shop" }}
          />
          {loadingProducts ? (
            <ProductCarouselSkeleton />
          ) : featured.length === 0 ? (
            <EmptyProducts />
          ) : (
            <ProductCarousel products={featured} priorityCount={2} />
          )}
        </Container>
      </section>

      <FeaturedReviews />

      <section className="py-14 md:py-20">
        <Container>
          <SectionHeading label={t("home.compare")} title={t("home.seeTheDifference")} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-h-[280px] sm:min-h-0 sm:h-[360px] md:h-[480px]">
            <div className="relative min-h-[200px] sm:min-h-0 sm:h-full overflow-hidden rounded-[var(--mq-radius-lg)]">
              <Image
                src={miscImages.compareBefore}
                alt={t("common.standard")}
                fill
                className="object-cover"
                sizes="50vw"
                quality={75}
              />
              <span className="absolute top-4 left-4 bg-black text-white text-[10px] px-3 py-1 uppercase tracking-widest rounded-[var(--mq-radius-sm)]">
                {t("common.standard")}
              </span>
            </div>
            <div className="relative min-h-[200px] sm:min-h-0 sm:h-full overflow-hidden rounded-[var(--mq-radius-lg)]">
              <Image
                src={miscImages.compareAfter}
                alt={t("common.mqQuality")}
                fill
                className="object-cover"
                sizes="50vw"
                quality={75}
              />
              <span className="absolute top-4 right-4 mq-sale-badge uppercase tracking-widest">
                {t("common.mqQuality")}
              </span>
            </div>
          </div>
        </Container>
      </section>

      <section className="py-14 md:py-20 border-t border-mq-border">
        <Container>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-10">
            {trustIcons.map(({ title, desc, Icon }) => (
              <div key={title} className="min-w-0">
                <Icon
                  className="mb-4 text-mq-text"
                  size={28}
                  strokeWidth={1.5}
                  absoluteStrokeWidth
                  aria-hidden
                />
                <h4 className="text-sm font-semibold text-mq-text mb-2 uppercase tracking-[0.08em]">
                  {title}
                </h4>
                <p className="text-sm text-mq-text-secondary leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}

function EmptyProducts() {
  return (
    <p className="text-sm text-mq-text-muted text-center py-10">
      No products in the catalog yet.
    </p>
  );
}

function ProductCarouselSkeleton() {
  return (
    <div className="mq-carousel-track gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="shrink-0 w-[220px] md:w-[260px] space-y-3">
          <div className="aspect-square rounded-[var(--mq-radius-lg)] bg-mq-surface animate-pulse" />
          <div className="h-3 w-3/4 rounded bg-mq-surface animate-pulse" />
          <div className="h-3 w-1/2 rounded bg-mq-surface animate-pulse" />
        </div>
      ))}
    </div>
  );
}
