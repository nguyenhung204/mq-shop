"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { usePublicBanners } from "@/lib/queries/promotions";
import type { BannerLang } from "@/lib/api/promotions";
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

function localeToBannerLang(locale: string | null): BannerLang {
  return locale === "vi" ? "VI" : "EN";
}

export function HeroSlider() {
  const { t, locale } = useLanguage();
  const [slide, setSlide] = useState(0);
  const bannerLang = localeToBannerLang(locale);
  const { data: cmsBanners = [] } = usePublicBanners(bannerLang);

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

    return [...staticSlides, ...cmsSlides];
  }, [cmsBanners, t]);

  useEffect(() => {
    setSlide(0);
  }, [bannerLang, slides.length]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => setSlide((s) => (s + 1) % slides.length), 7000);
    return () => clearInterval(timer);
  }, [slides.length]);

  return (
    <section className="pt-3 md:pt-4 px-3 md:px-4">
      <div className="relative min-h-[420px] sm:min-h-[520px] md:min-h-[660px] lg:min-h-[760px] overflow-hidden rounded-[var(--mq-radius-lg)]">
        {slides.map((s, i) => (
          <div
            key={s.key}
            className={`absolute inset-0 transition-opacity duration-[900ms] ease-out ${i === slide ? "opacity-100 z-10" : "opacity-0 z-0"}`}
          >
            <Image
              src={s.image}
              alt={s.title}
              fill
              className={`object-cover transition-transform duration-[9000ms] ease-out ${i === slide ? "scale-105" : "scale-100"}`}
              priority={i === 0}
              sizes="100vw"
              quality={80}
            />
            <div className="absolute inset-0 bg-black/40" />
            <div className="absolute inset-0 z-20 flex items-center justify-center text-center">
              <Container>
                {!s.fromCms && (
                  <span className="block text-[11px] font-medium uppercase tracking-[0.22em] text-white/75 mb-4">
                    {t("common.mqCollection")}
                  </span>
                )}
                <h1 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl text-white max-w-4xl mx-auto leading-[1.1] tracking-tight font-display uppercase">
                  {s.title}
                </h1>
                {s.subtitle ? (
                  <p className="mt-5 text-base md:text-lg text-white/80 max-w-xl mx-auto leading-relaxed">
                    {s.subtitle}
                  </p>
                ) : null}
                <Link
                  href={s.href}
                  className="mq-btn mq-btn-primary mt-8 inline-flex bg-white text-black border-black hover:bg-white/90"
                >
                  {s.cta}
                </Link>
              </Container>
            </div>
          </div>
        ))}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 flex gap-2">
          {slides.map((s, i) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSlide(i)}
              className={`h-1 rounded-full transition-all ${i === slide ? "w-10 bg-white" : "w-6 bg-white/40"}`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
