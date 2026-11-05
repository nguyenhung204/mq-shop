"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import AOS from "aos";
import { CheckCircle2, CreditCard, Headphones, RotateCcw, ShieldCheck, Sparkles } from "lucide-react";
import { catalogApi } from "@/lib/api";
import { mapListingCard } from "@/lib/api/mapProduct";
import type { ApiCategory } from "@/lib/api/types";
import type { Product } from "@/lib/data/products";
import { getErrorMessage } from "@/lib/queries/utils";
import { categoryImages, miscImages } from "@/lib/images";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { useRegion } from "@/components/providers/RegionProvider";
import { HeroSlider } from "@/components/home/HeroSlider";
import { CategoryMarquee } from "@/components/home/CategoryMarquee";
import { FeaturedReviews } from "@/components/home/FeaturedReviews";
import { ProductCarousel } from "@/components/ui/ProductCarousel";
import { Container, SectionHeading } from "@/components/ui/shared";

const FALLBACK_CATEGORY_IMAGES: Record<string, string> = {
  electronics: categoryImages.electronics,
  fashion: categoryImages.fashion,
  "home-living": categoryImages["home-living"],
  beauty: categoryImages.beauty,
  toys: categoryImages.toys,
  sports: categoryImages.sports,
  books: categoryImages.books,
  groceries: categoryImages.groceries,
  accessories: categoryImages.accessories,
  apparel: categoryImages.apparel,
  home: categoryImages.home,
  tech: categoryImages.tech,
  gifts: categoryImages.gifts,
  essentials: categoryImages.essentials,
  audio: categoryImages.audio,
  "phones-accessories": categoryImages["phones-accessories"],
  "computers-peripherals": categoryImages["computers-peripherals"],
  "men-fashion": categoryImages["men-fashion"],
  "women-fashion": categoryImages["women-fashion"],
  footwear: categoryImages.footwear,
  furniture: categoryImages.furniture,
  lighting: categoryImages.lighting,
  kitchen: categoryImages.kitchen,
  skincare: categoryImages.skincare,
  makeup: categoryImages.makeup,
  "building-toys": categoryImages["building-toys"],
  "outdoor-toys": categoryImages["outdoor-toys"],
  fitness: categoryImages.fitness,
  camping: categoryImages.camping,
  fiction: categoryImages.fiction,
  "education-books": categoryImages["education-books"],
  snacks: categoryImages.snacks,
  beverages: categoryImages.beverages,
};

export function HomePageContent() {
  const { t, locale } = useLanguage();
  const { regionCode } = useRegion();
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
      .listing({ page: 1, pageSize: 24, countryCode: regionCode || undefined })
      .then((res) => {
        setListing(res.items.map((p) => mapListingCard(p)));
      })
      .catch((err: unknown) => {
        setListing([]);
        setError(getErrorMessage(err, t("home.loadProductsFailed")));
      })
      .finally(() => setLoadingProducts(false));
  }, [t, regionCode]);

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

  useEffect(() => {
    if (!loadingCats && !loadingProducts) {
      AOS.refresh();
    }
  }, [loadingCats, loadingProducts]);

  return (
    <>
      <HeroSlider />

      <section className="pt-6 pb-8 md:pt-8 md:pb-12 overflow-hidden">
        <Container>
          <div>
            {loadingCats ? (
              <div className="flex items-center gap-[1.75rem] px-3.5 py-1 overflow-hidden" aria-hidden="true">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex flex-col items-center gap-3 shrink-0 w-[min(150px,28vw)]">
                    <div className="w-full max-w-[130px] aspect-square rounded-full bg-mq-surface-subtle animate-pulse border border-mq-border/50" />
                    <div className="h-4 w-16 bg-mq-surface-subtle rounded-md animate-pulse" />
                  </div>
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
          </div>
        </Container>
      </section>

      {error ? (
        <Container className="pb-8">
          <div className="mq-alert mq-alert-error">{error}</div>
        </Container>
      ) : null}

      <section className="py-8 md:py-12 bg-mq-surface-subtle">
        <Container>
          <div data-aos="fade-up">
            <SectionHeading
              label={t("home.seasonSale")}
              title={t("home.forEveryMoment")}
              action={{ label: t("common.shopAll"), href: "/shop" }}
            />
          </div>
          <div>
            {loadingProducts ? (
              <ProductCarouselSkeleton />
            ) : picks.length === 0 ? (
              <EmptyProducts />
            ) : (
              <ProductCarousel products={picks} priorityCount={2} />
            )}
          </div>
        </Container>
      </section>

      <section className="py-8 md:py-12">
        <Container>
          <div data-aos="fade-up">
            <SectionHeading
              label={t("home.justArrived")}
              title={t("home.newAtMq")}
              action={{ label: t("common.shopAll"), href: "/shop" }}
            />
          </div>
          <div>
            {loadingProducts ? (
              <ProductCarouselSkeleton />
            ) : newest.length === 0 ? (
              <EmptyProducts />
            ) : (
              <ProductCarousel products={newest} />
            )}
          </div>
        </Container>
      </section>

      <section className="py-8 md:py-12 bg-mq-surface-subtle">
        <Container>
          <div data-aos="fade-up">
            <SectionHeading
              label={t("home.featured")}
              title={t("home.curatedSelection")}
              action={{ label: t("common.seeCollection"), href: "/shop" }}
            />
          </div>
          <div>
            {loadingProducts ? (
              <ProductCarouselSkeleton />
            ) : featured.length === 0 ? (
              <EmptyProducts />
            ) : (
              <ProductCarousel products={featured} priorityCount={2} />
            )}
          </div>
        </Container>
      </section>

      <FeaturedReviews />

      <section className="py-14 md:py-20 bg-mq-surface-subtle border-b border-mq-border">
        <Container>
          <div data-aos="fade-up">
            <SectionHeading label={t("home.compare")} title={t("home.seeTheDifference")} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 w-full">
            {/* Standard Grade Card */}
            <div data-aos="fade-up" className="group relative rounded-[var(--mq-radius-lg)] overflow-hidden border border-mq-border bg-mq-surface shadow-[var(--mq-shadow-sm)] hover:shadow-md transition-all duration-300 flex flex-col">
              <div className="relative w-full h-[280px] sm:h-[340px] md:h-[380px] lg:h-[420px] overflow-hidden bg-neutral-900">
                <Image
                  src={miscImages.compareBefore}
                  alt={t("common.standard")}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-105 filter contrast-[0.95] brightness-[0.9]"
                  sizes="(max-width: 768px) 100vw, 50vw"
                  quality={85}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/20" />
                
                {/* Standard Badge */}
                <div className="absolute top-4 left-4 inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-black/75 backdrop-blur-md text-white/90 border border-white/15 shadow-md">
                  <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
                  <span>{t("common.standard")}</span>
                </div>
              </div>

              {/* Bottom Feature Box */}
              <div className="p-5 md:p-6 bg-mq-surface border-t border-mq-border flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm md:text-base font-bold text-mq-text uppercase tracking-wide">
                      {t("home.compareStandardTitle")}
                    </h4>
                    <span className="text-[11px] font-medium text-mq-text-muted bg-mq-surface-subtle px-2.5 py-0.5 rounded-full border border-mq-border">
                      {t("home.compareStandardBadge")}
                    </span>
                  </div>
                  <p className="text-xs md:text-sm text-mq-text-secondary leading-relaxed">
                    {t("home.compareStandardDesc")}
                  </p>
                </div>
                
                <div className="mt-4 pt-3 border-t border-mq-border/60 flex items-center gap-2 text-xs text-mq-text-muted">
                  <span className="text-neutral-400 font-bold">✕</span>
                  <span>{t("home.compareStandardNote")}</span>
                </div>
              </div>
            </div>

            {/* MQ Premium Quality Card */}
            <div data-aos="fade-up" data-aos-delay="100" className="group relative rounded-[var(--mq-radius-lg)] overflow-hidden border-2 border-mq-gold/70 bg-mq-surface shadow-[0_4px_24px_rgba(255,210,29,0.12)] hover:shadow-[0_8px_32px_rgba(255,210,29,0.25)] transition-all duration-300 flex flex-col">
              <div className="relative w-full h-[280px] sm:h-[340px] md:h-[380px] lg:h-[420px] overflow-hidden bg-neutral-900">
                <Image
                  src={miscImages.compareAfter}
                  alt={t("common.mqQuality")}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                  sizes="(max-width: 768px) 100vw, 50vw"
                  quality={85}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                
                {/* MQ Quality Luxury Badge */}
                <div className="absolute top-4 right-4 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-mq-gold text-black shadow-[0_4px_16px_rgba(255,210,29,0.6)] border border-yellow-200">
                  <Sparkles size={14} className="text-black fill-black" />
                  <span>{t("common.mqQuality")}</span>
                </div>
              </div>

              {/* Bottom Feature Box */}
              <div className="p-5 md:p-6 bg-gradient-to-br from-mq-surface via-mq-surface to-mq-gold/[0.04] border-t border-mq-gold/30 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm md:text-base font-bold text-mq-text uppercase tracking-wide flex items-center gap-1.5">
                      <span className="text-mq-gold">{t("home.compareMqTitle")}</span>
                      <CheckCircle2 size={16} className="text-mq-gold fill-mq-gold/20" />
                    </h4>
                    <span className="text-[11px] font-bold text-amber-700 dark:text-mq-gold bg-amber-500/15 px-2.5 py-0.5 rounded-full border border-amber-400/30">
                      {t("home.compareMqBadge")}
                    </span>
                  </div>
                  <p className="text-xs md:text-sm text-mq-text leading-relaxed font-medium">
                    {t("home.compareMqDesc")}
                  </p>
                </div>
                
                <div className="mt-4 pt-3 border-t border-mq-gold/20 flex items-center gap-2 text-xs font-semibold text-mq-text">
                  <span className="text-mq-gold font-bold text-sm">✓</span>
                  <span>{t("home.compareMqNote")}</span>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <section className="py-8 md:py-12 border-t border-mq-border">
        <Container>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-10">
            {trustIcons.map(({ title, desc, Icon }, idx) => (
              <div key={title} className="min-w-0" data-aos="fade-up" data-aos-delay={idx * 80}>
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
  const { t } = useLanguage();
  return (
    <p className="text-sm text-mq-text-muted text-center py-10">
      {t("nav.noProductsYet")}
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
