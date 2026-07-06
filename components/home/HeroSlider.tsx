"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { heroImages } from "@/lib/images";
import { Container } from "@/components/ui/shared";

export function HeroSlider() {
  const { t } = useLanguage();
  const [slide, setSlide] = useState(0);

  const slides = [
    {
      title: t("home.hero1Title"),
      subtitle: t("home.hero1Subtitle"),
      image: heroImages.slide1,
      cta: t("home.heroCta1"),
    },
    {
      title: t("home.hero2Title"),
      subtitle: t("home.hero2Subtitle"),
      image: heroImages.slide2,
      cta: t("home.heroCta2"),
    },
  ];

  useEffect(() => {
    const timer = setInterval(() => setSlide((s) => (s + 1) % slides.length), 7000);
    return () => clearInterval(timer);
  }, [slides.length]);

  return (
    <section className="relative min-h-[380px] sm:min-h-[500px] md:min-h-[700px] lg:min-h-[815px] overflow-hidden">
      {slides.map((s, i) => (
        <div
          key={i}
          className={`absolute inset-0 transition-opacity duration-700 ${i === slide ? "opacity-100 z-10" : "opacity-0 z-0"}`}
        >
          <Image
            src={s.image}
            alt={s.title}
            fill
            className="object-cover"
            priority={i === 0}
            sizes="100vw"
            quality={80}
          />
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute inset-0 z-20 flex items-center">
            <Container>
              <span className="block text-[11px] font-medium uppercase tracking-[0.25em] text-white/70 mb-4">
                {t("common.mqCollection")}
              </span>
              <h1 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl text-white max-w-3xl leading-[1.05] tracking-wide">
                {s.title}
              </h1>
              <p className="mt-5 text-base md:text-lg text-white/75 max-w-md leading-relaxed">
                {s.subtitle}
              </p>
              <Link href="/shop" className="mq-btn mq-btn-primary mt-8 inline-flex bg-white text-black hover:bg-white/90">
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
    </section>
  );
}
