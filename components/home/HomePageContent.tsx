"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CreditCard, Headphones, RotateCcw, ShieldCheck, Star } from "lucide-react";
import { catalogApi } from "@/lib/api";
import { mapListingCard } from "@/lib/api/mapProduct";
import type { ApiCategory } from "@/lib/api/types";
import type { Product } from "@/lib/data/products";
import { heroImages, miscImages, categoryImages } from "@/lib/images";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { HeroSlider } from "@/components/home/HeroSlider";
import { CategoryCard } from "@/components/ui/ProductCard";
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

  useEffect(() => {
    void catalogApi
      .categories()
      .then(setCategories)
      .catch(() => setCategories([]));
    void catalogApi
      .listing({ page: 1, pageSize: 24 })
      .then((res) => setListing(res.items.map((p) => mapListingCard(p))))
      .catch(() => setListing([]));
  }, []);

  const saleProducts = listing.filter((p) => p.salePercent || p.inStock > 0).slice(0, 12);
  const newProducts = listing.slice(0, 12);
  const hotProducts = [...listing].sort((a, b) => b.price - a.price).slice(0, 12);
  const featured = listing.slice(0, 12);

  const trustIcons = [
    { title: t("home.trustPayment"), desc: t("home.trustPaymentDesc"), Icon: CreditCard },
    { title: t("home.trustSupport"), desc: t("home.trustSupportDesc"), Icon: Headphones },
    { title: t("home.trustReturns"), desc: t("home.trustReturnsDesc"), Icon: RotateCcw },
    { title: t("home.trustQuality"), desc: t("home.trustQualityDesc"), Icon: ShieldCheck },
  ];

  const testimonials = [
    { quote: t("home.testimonial1"), name: "Sarah M.", date: "May 2026", rating: 5 },
    { quote: t("home.testimonial2"), name: "James L.", date: "April 2026", rating: 5 },
    { quote: t("home.testimonial3"), name: "Elena K.", date: "March 2026", rating: 5 },
  ];

  return (
    <>
      <HeroSlider />

      <section className="py-14 md:py-20">
        <Container>
          <div
            className="mq-carousel-track"
            style={{ justifyContent: "space-between" }}
          >
            {categories.map((cat, i) => (
              <CategoryCard
                key={cat.id}
                name={
                  locale === "vi" && cat.nameVi ? cat.nameVi : cat.name || cat.slug
                }
                slug={cat.id}
                image={
                  FALLBACK_CATEGORY_IMAGES[cat.slug] ||
                  categoryImages.accessories
                }
                priority={i < 4}
              />
            ))}
          </div>
        </Container>
      </section>

      <section className="py-14 md:py-20 bg-mq-surface-subtle">
        <Container>
          <SectionHeading
            label={t("home.seasonSale")}
            title={t("home.forEveryMoment")}
            action={{ label: t("common.shopAll"), href: "/shop?sort=deals" }}
          />
          <ProductCarousel products={saleProducts} priorityCount={2} />
        </Container>
      </section>

      <section className="py-8">
        <Container>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { title: t("home.timelessDesign"), image: heroImages.promo1 },
              { title: t("home.thoughtfulGifts"), image: heroImages.promo2 },
            ].map((banner) => (
              <div
                key={banner.title}
                className="relative h-[300px] md:h-[420px] overflow-hidden group rounded-[var(--mq-radius-lg)]"
              >
                <Image
                  src={banner.image}
                  alt={banner.title}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                  sizes="(max-width:768px) 100vw, 50vw"
                  quality={75}
                />
                <div className="absolute inset-0 bg-black/35 flex flex-col items-center justify-center text-center p-8">
                  <h3 className="text-2xl md:text-3xl text-white font-display tracking-tight uppercase">
                    {banner.title}
                  </h3>
                  <Link
                    href="/shop"
                    className="mq-btn mq-btn-primary mt-5 w-fit text-xs bg-white text-black border-black hover:bg-white/90"
                  >
                    {t("common.discoverNow")}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="py-14 md:py-20">
        <Container>
          <SectionHeading
            label={t("home.justArrived")}
            title={t("home.newAtMq")}
            action={{ label: t("common.shopAll"), href: "/shop?sort=new" }}
          />
          <ProductCarousel products={newProducts} />
        </Container>
      </section>

      <section className="py-14 md:py-20 bg-mq-surface-subtle">
        <Container>
          <SectionHeading
            label={t("home.featured")}
            title={t("home.curatedSelection")}
            action={{ label: t("common.seeCollection"), href: "/shop" }}
          />
          <ProductCarousel products={hotProducts} priorityCount={2} />
        </Container>
      </section>

      <section className="py-14 md:py-20">
        <Container>
          <SectionHeading label={t("home.newCollection")} title={t("home.styleForEveryStory")} />
          <ProductCarousel products={featured} />
        </Container>
      </section>

      <section className="py-14 md:py-20 bg-mq-surface-subtle">
        <Container>
          <SectionHeading label={t("home.reviews")} title={t("home.whatClientsSay")} />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((item) => (
              <blockquote
                key={item.name}
                className="bg-mq-surface p-8 border border-mq-border rounded-[var(--mq-radius-lg)]"
              >
                <div className="flex gap-0.5 mb-4 text-mq-gold">
                  {Array.from({ length: item.rating }).map((_, i) => (
                    <Star key={i} size={14} fill="currentColor" strokeWidth={0} />
                  ))}
                </div>
                <p className="text-mq-text-secondary text-sm leading-relaxed">
                  &ldquo;{item.quote}&rdquo;
                </p>
                <footer className="mt-5">
                  <p className="text-sm font-medium text-mq-text">{item.name}</p>
                  <time className="text-xs text-mq-text-muted">{item.date}</time>
                </footer>
              </blockquote>
            ))}
          </div>
        </Container>
      </section>

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
