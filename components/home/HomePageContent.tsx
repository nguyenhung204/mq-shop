"use client";

import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";
import { categories } from "@/lib/data/categories";
import { products } from "@/lib/data/products";
import { heroImages, miscImages } from "@/lib/images";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { HeroSlider } from "@/components/home/HeroSlider";
import { CategoryCard } from "@/components/ui/ProductCard";
import { ProductCarousel } from "@/components/ui/ProductCarousel";
import { Container, SectionHeading } from "@/components/ui/shared";

export function HomePageContent() {
  const { t } = useLanguage();
  const saleProducts = products.filter((p) => p.salePercent);
  const newProducts = products.filter((p) => p.badge === "new");
  const hotProducts = products.filter((p) => p.badge === "hot");

  const trustIcons = [
    { title: t("home.trustPayment"), desc: t("home.trustPaymentDesc") },
    { title: t("home.trustSupport"), desc: t("home.trustSupportDesc") },
    { title: t("home.trustReturns"), desc: t("home.trustReturnsDesc") },
    { title: t("home.trustQuality"), desc: t("home.trustQualityDesc") },
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
          <div className="mq-carousel-track">
            {categories.map((cat, i) => (
              <CategoryCard
                key={cat.slug}
                name={t(`categories.${cat.slug}`)}
                slug={cat.slug}
                image={cat.image}
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { title: t("home.timelessDesign"), image: heroImages.promo1 },
              { title: t("home.thoughtfulGifts"), image: heroImages.promo2 },
            ].map((banner) => (
              <div key={banner.title} className="relative h-[280px] md:h-[380px] overflow-hidden group rounded-[var(--mq-radius-lg)]">
                <Image
                  src={banner.image}
                  alt={banner.title}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                  sizes="(max-width:768px) 100vw, 50vw"
                  quality={75}
                />
                <div className="absolute inset-0 bg-black/35 flex flex-col justify-end p-8">
                  <h3 className="text-2xl md:text-3xl text-white font-display tracking-wide">{banner.title}</h3>
                  <Link href="/shop" className="mq-btn mq-btn-primary mt-4 w-fit text-xs bg-white text-black hover:bg-white/90">
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
          <ProductCarousel products={products.slice(0, 6)} />
        </Container>
      </section>

      <section className="py-14 md:py-20 bg-mq-surface-subtle">
        <Container>
          <SectionHeading label={t("home.reviews")} title={t("home.whatClientsSay")} />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((item) => (
              <blockquote key={item.name} className="bg-mq-surface p-8 border border-mq-border">
                <div className="flex gap-0.5 mb-4 text-mq-gold">
                  {Array.from({ length: item.rating }).map((_, i) => (
                    <Star key={i} size={14} fill="currentColor" strokeWidth={0} />
                  ))}
                </div>
                <p className="text-mq-text-secondary text-sm leading-relaxed">&ldquo;{item.quote}&rdquo;</p>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 min-h-[280px] sm:min-h-0 sm:h-[360px] md:h-[480px] overflow-hidden">
            <div className="relative min-h-[200px] sm:min-h-0 sm:h-full">
              <Image src={miscImages.compareBefore} alt={t("common.standard")} fill className="object-cover" sizes="50vw" quality={75} />
              <span className="absolute top-4 left-4 bg-black text-white text-[10px] px-3 py-1 uppercase tracking-widest">
                {t("common.standard")}
              </span>
            </div>
            <div className="relative min-h-[200px] sm:min-h-0 sm:h-full">
              <Image src={miscImages.compareAfter} alt={t("common.mqQuality")} fill className="object-cover" sizes="50vw" quality={75} />
              <span className="absolute top-4 right-4 mq-sale-badge uppercase tracking-widest">
                {t("common.mqQuality")}
              </span>
            </div>
          </div>
        </Container>
      </section>

      <section className="py-14 md:py-20 border-t border-mq-border">
        <Container>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 md:gap-8">
            {trustIcons.map((item) => (
              <div key={item.title}>
                <h4 className="text-sm font-semibold text-mq-text mb-2 uppercase tracking-wider">{item.title}</h4>
                <p className="text-sm text-mq-text-secondary leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}
