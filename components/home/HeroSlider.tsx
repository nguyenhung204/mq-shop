"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { catalogApi } from "@/lib/api";
import type { ApiBanner } from "@/lib/api/types";
import { heroImages } from "@/lib/images";
import { Container } from "@/components/ui/shared";

type Slide = { title: string; subtitle: string; image: string; cta: string; href: string };

export function HeroSlider() {
  const { t, locale } = useLanguage();
  const [slide, setSlide] = useState(0);
  const [apiBanners, setApiBanners] = useState<ApiBanner[] | null>(null);

  useEffect(() => {
    if (!locale) return;
    const apiLocale = locale === "zh-TW" ? "zh_TW" : locale;
    void catalogApi
      .banners(apiLocale)
      .then((b) => setApiBanners(Array.isArray(b) ? b.filter((x) => x.isActive) : []))
      .catch(() => setApiBanners([]));
  }, [locale]);

  const fallback: Slide[] = [
    {
      title: t("home.hero1Title"),
      subtitle: t("home.hero1Subtitle"),
      image: heroImages.slide1,
      cta: t("home.heroCta1"),
      href: "/shop",
    },
    {
      title: t("home.hero2Title"),
      subtitle: t("home.hero2Subtitle"),
      image: heroImages.slide2,
      cta: t("home.heroCta2"),
      href: "/shop",
    },
  ];

  const slides: Slide[] =
    apiBanners && apiBanners.length > 0
      ? apiBanners.map((b) => ({
          title: b.title,
          subtitle: t("home.hero1Subtitle"),
          image: b.imageUrl,
          cta: t("home.heroCta1"),
          href: b.targetUrl || "/shop",
        }))
      : fallback;

  useEffect(() => {
    const timer = setInterval(() => setSlide((s) => (s + 1) % slides.length), 7000);
    return () => clearInterval(timer);
  }, [slides.length]);

  useEffect(() => {
    setSlide(0);
  }, [slides.length]);

  return (
    <section className="pt-3 md:pt-4 px-3 md:px-4">
      <div className="relative min-h-[380px] sm:min-h-[500px] md:min-h-[640px] lg:min-h-[760px] overflow-hidden rounded-[var(--mq-radius-lg)]">
        {slides.map((s, i) => (
          <div
            key={`${s.image}-${i}`}
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
              unoptimized={s.image.startsWith("http")}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/35 to-black/20" />
            <div className="absolute inset-0 z-20 flex items-center">
              <Container>
                <span className="block text-[11px] font-medium uppercase tracking-[0.2em] text-white/70 mb-4">
                  {t("common.mqCollection")}
                </span>
                <h1 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl text-white max-w-3xl leading-[1.1] tracking-tight font-display">
                  {s.title}
                </h1>
                <p className="mt-5 text-base md:text-lg text-white/75 max-w-md leading-relaxed">
                  {s.subtitle}
                </p>
                <Link href={s.href} className="mq-btn mq-btn-primary mt-8 inline-flex bg-white text-black hover:bg-white/90 shadow-lg">
                  {s.cta}
                </Link>
              </Container>
            </div>
          </div>
        ))}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 flex gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setSlide(i)}
              className={`h-2.5 rounded-full transition-all ${i === slide ? "w-10 bg-white" : "w-5 bg-white/40"}`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
