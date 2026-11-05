"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { usePublicBanners } from "@/lib/queries/promotions";
import type { PublicBannerLang } from "@/lib/api/promotions";
import type { Locale } from "@/lib/i18n/types";
import { heroImages } from "@/lib/images";
import { Container } from "@/components/ui/shared";

type Slide = {
  key: string;
  title: string;
  subtitle: string;
  image: string;
  cta: string;
  href: string;
  /** CMS slides may skip marketing copy overlay density */
  fromCms?: boolean;
};

/** Map app locale → public banner `lang` query (never ALL). */
export function localeToBannerLang(locale: Locale | string | null): PublicBannerLang {
  if (locale === "vi") return "VI";
  if (locale === "zh-TW") return "TW";
  return "EN";
}

export function HeroSlider() {
  const { t, locale, ready } = useLanguage();
  const [slide, setSlide] = useState(0);
  const bannerLang = localeToBannerLang(locale);
  const { data: cmsBanners = [] } = usePublicBanners(bannerLang, ready && Boolean(locale));

  const slides: Slide[] = useMemo(() => {
    const staticSlides: Slide[] = [
      {
        key: "static-1",
        title: t("home.hero1Title"),
        subtitle: t("home.hero1Subtitle"),
        image: heroImages.slide1,
        cta: t("home.heroCta1"),
        href: "/shop",
      },
      {
        key: "static-2",
        title: t("home.hero2Title"),
        subtitle: t("home.hero2Subtitle"),
        image: heroImages.slide2,
        cta: t("home.heroCta2"),
        href: "/shop",
      },
    ];

    const cmsSlides: Slide[] = [...cmsBanners]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((b) => ({
        key: `cms-${b.id}`,
        title: b.title,
        subtitle: "",
        image: b.imageUrl,
        cta: t("home.heroCta1"),
        href: b.linkUrl?.trim() || "/shop",
        fromCms: true,
      }));

    // CMS banners first (after matching lang), then keep static hero slides.
    return [...cmsSlides, ...staticSlides];
  }, [cmsBanners, t]);

  useEffect(() => {
    setSlide(0);
  }, [bannerLang, slides.length]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => setSlide((s) => (s + 1) % slides.length), 7000);
    return () => clearInterval(timer);
  }, [slides.length]);

  const prevSlide = () => {
    setSlide((s) => (s - 1 + slides.length) % slides.length);
  };

  const nextSlide = () => {
    setSlide((s) => (s + 1) % slides.length);
  };

  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const minSwipeDistance = 45;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0]?.clientX ?? null);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0]?.clientX ?? null);
  };

  const onTouchEnd = () => {
    if (touchStart === null || touchEnd === null) return;
    const distance = touchStart - touchEnd;
    if (distance > minSwipeDistance) {
      nextSlide();
    } else if (distance < -minSwipeDistance) {
      prevSlide();
    }
  };

  return (
    <section className="pt-3 md:pt-4 px-3 sm:px-4 md:px-6 max-w-[1600px] mx-auto" data-aos="fade-in">
      <div
        className="relative min-h-[460px] sm:min-h-[520px] md:min-h-[580px] lg:min-h-[640px] xl:min-h-[680px] overflow-hidden rounded-[var(--mq-radius-lg)] shadow-[var(--mq-shadow-md)]"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {slides.map((s, i) => (
          <div
            key={s.key}
            className={`absolute inset-0 transition-opacity duration-[1000ms] ease-out ${
              i === slide ? "opacity-100 z-10 pointer-events-auto" : "opacity-0 z-0 pointer-events-none"
            }`}
          >
            <Image
              src={s.image}
              alt={s.title}
              fill
              className={`object-cover transition-transform duration-[9000ms] ease-out ${
                i === slide ? "scale-105" : "scale-100"
              }`}
              priority={i === 0}
              sizes="100vw"
              quality={85}
            />
            {/* Multi-layered luxury gradients for optimal text contrast and rich tone */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/30" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.45)_100%)]" />

            {/* Slide Content */}
            <div className="absolute inset-0 z-20 flex items-center justify-center text-center px-4">
              <Container className="max-w-4xl py-12">
                {!s.fromCms && (
                  <div className="mb-4 inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-[11px] md:text-xs font-semibold uppercase tracking-[0.24em] bg-white/15 backdrop-blur-md border border-white/25 text-white/95 shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-mq-gold shadow-[0_0_8px_var(--mq-gold)]" />
                    <span>{t("common.mqCollection")}</span>
                  </div>
                )}
                <h1 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl text-white max-w-3xl mx-auto leading-[1.08] tracking-tight font-display uppercase font-bold drop-shadow-md">
                  {s.title}
                </h1>
                {s.subtitle ? (
                  <p className="mt-4 md:mt-5 text-sm sm:text-base md:text-lg text-white/85 max-w-xl mx-auto leading-relaxed font-normal">
                    {s.subtitle}
                  </p>
                ) : null}
                <div className="mt-6 md:mt-8 flex justify-center">
                  <Link
                    href={s.href}
                    className="group inline-flex items-center gap-2.5 px-8 py-3.5 rounded-full text-sm md:text-base font-semibold bg-white text-black hover:bg-mq-gold hover:text-black border border-transparent hover:border-mq-gold transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-105 active:scale-[0.98]"
                  >
                    <span>{s.cta}</span>
                    <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" />
                  </Link>
                </div>
              </Container>
            </div>
          </div>
        ))}

        {/* Previous & Next chevron navigation */}
        {slides.length > 1 && (
          <>
            <button
              type="button"
              onClick={prevSlide}
              className="absolute left-4 md:left-6 top-1/2 -translate-y-1/2 z-30 w-11 h-11 rounded-full bg-black/25 hover:bg-black/60 text-white/80 hover:text-white border border-white/20 backdrop-blur-md hidden sm:flex items-center justify-center transition-all duration-200 hover:scale-110 shadow-lg cursor-pointer"
              aria-label="Previous slide"
            >
              <ChevronLeft size={22} />
            </button>
            <button
              type="button"
              onClick={nextSlide}
              className="absolute right-4 md:right-6 top-1/2 -translate-y-1/2 z-30 w-11 h-11 rounded-full bg-black/25 hover:bg-black/60 text-white/80 hover:text-white border border-white/20 backdrop-blur-md hidden sm:flex items-center justify-center transition-all duration-200 hover:scale-110 shadow-lg cursor-pointer"
              aria-label="Next slide"
            >
              <ChevronRight size={22} />
            </button>
          </>
        )}

        {/* Polished Slide Indicators with comfortable touch targets */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/30 backdrop-blur-md border border-white/15">
          {slides.map((s, i) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSlide(i)}
              className="p-1.5 flex items-center justify-center cursor-pointer group"
              aria-label={`Slide ${i + 1}`}
            >
              <span
                className={`h-1.5 rounded-full transition-all duration-300 block ${
                  i === slide
                    ? "w-8 bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)]"
                    : "w-2.5 bg-white/40 group-hover:bg-white/70"
                }`}
              />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
