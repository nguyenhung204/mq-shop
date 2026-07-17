"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, Headphones, MapPin } from "lucide-react";
import { RegionFlag } from "@/components/i18n/RegionFlag";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { getTranslation } from "@/lib/i18n/get-translation";
import { GATE_REGIONS, type GateRegionId } from "@/lib/i18n/regions";

export function LanguageGate() {
  const { needsSelection, setLocale } = useLanguage();
  const [picked, setPicked] = useState<GateRegionId | null>(null);

  if (!needsSelection) return null;

  const selectedRegion = GATE_REGIONS.find((r) => r.id === picked);
  const previewLocale = selectedRegion?.locale ?? "en";
  const gt = (key: string) => getTranslation(previewLocale, key);

  const handleContinue = () => {
    if (selectedRegion) setLocale(selectedRegion.locale);
  };

  return (
    <div className="mq-lang-gate fixed inset-0 z-[100] flex flex-col bg-white">
      <header className="shrink-0 flex items-center justify-between px-5 sm:px-8 h-14 border-b border-black/5 bg-white">
        <Link href="/" className="text-[15px] font-semibold tracking-[0.08em] text-[#0d8f8a]">
          MQ SHOP
        </Link>
        <div className="flex items-center gap-5 sm:gap-7 text-[12px] text-mq-text-secondary">
          <span className="inline-flex items-center gap-1.5">
            <MapPin size={14} strokeWidth={1.75} className="text-[#0d8f8a]" />
            <span className="hidden sm:inline">{gt("gate.regionSelector")}</span>
          </span>
          <Link
            href="/contact-us"
            className="inline-flex items-center gap-1.5 hover:text-mq-text transition-colors"
          >
            <Headphones size={14} strokeWidth={1.75} className="text-[#0d8f8a]" />
            <span className="hidden sm:inline">{gt("gate.support")}</span>
          </Link>
        </div>
      </header>

      <div className="relative flex-1 flex flex-col items-center justify-center px-4 py-10 overflow-y-auto">
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(145deg, #0a4f8c 0%, #0d7a9c 38%, #12a3a0 68%, #1ec4b0 100%)",
          }}
          aria-hidden
        />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background:
              "radial-gradient(ellipse 70% 55% at 75% 20%, rgba(255,255,255,0.28), transparent 55%), radial-gradient(ellipse 50% 40% at 15% 85%, rgba(0,40,80,0.25), transparent 50%)",
          }}
          aria-hidden
        />

        <div className="relative w-full max-w-[720px] text-center">
          <span className="inline-flex items-center rounded-full bg-white/20 backdrop-blur-sm px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/95 mb-5">
            {gt("gate.label")}
          </span>

          <h1
            id="lang-gate-title"
            className="font-display text-[2rem] sm:text-[2.75rem] md:text-[3.25rem] font-semibold text-[#0b1f33] tracking-tight leading-[1.15]"
          >
            {gt("gate.title")}
          </h1>
          <p className="mt-4 text-sm sm:text-[15px] text-[#1a3348]/85 leading-relaxed max-w-xl mx-auto">
            {gt("gate.subtitle")}
          </p>

          <div
            role="listbox"
            aria-labelledby="lang-gate-title"
            className="mt-9 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-left"
          >
            {GATE_REGIONS.map((region) => {
              const selected = picked === region.id;
              return (
                <button
                  key={region.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => setPicked(region.id)}
                  className={`group flex items-center gap-4 bg-white px-5 py-4 sm:px-6 sm:py-5 text-left transition-all duration-200 rounded-[var(--mq-radius-lg)] shadow-[0_8px_28px_rgba(0,30,60,0.12)] ${
                    selected
                      ? "ring-2 ring-[#0b1f33] scale-[1.01]"
                      : "ring-1 ring-black/5 hover:ring-black/15 hover:-translate-y-0.5"
                  }`}
                >
                  <span className="flex-1 min-w-0">
                    <span className="block text-[17px] font-semibold text-[#0b1f33] tracking-tight">
                      {region.country}
                    </span>
                    <span className="block text-[13px] text-mq-text-secondary mt-0.5">
                      {region.localLabel}
                    </span>
                    <span className="block text-[11px] font-medium uppercase tracking-[0.12em] text-mq-text-muted mt-2">
                      {gt("gate.currency")}: {region.currency}
                    </span>
                  </span>
                  <RegionFlag regionId={region.id} />
                </button>
              );
            })}
          </div>

          <button
            type="button"
            disabled={!picked}
            onClick={handleContinue}
            className="mt-8 inline-flex items-center justify-center gap-2 w-full max-w-md mx-auto h-[52px] rounded-[var(--mq-radius-btn)] text-[15px] font-semibold tracking-wide transition-all duration-200 disabled:cursor-not-allowed disabled:bg-white/35 disabled:text-white/70 bg-[#0b1f33] text-white hover:bg-[#122a42] shadow-[0_10px_28px_rgba(0,20,40,0.28)]"
          >
            {gt("gate.continue")}
            <ChevronRight size={18} strokeWidth={2.25} />
          </button>
        </div>
      </div>

      <footer className="shrink-0 bg-[#f3f5f7] px-5 sm:px-8 py-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 max-w-5xl mx-auto">
          <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[12px] text-mq-text-secondary">
            <Link href="/faqs" className="hover:text-mq-text transition-colors">
              {gt("gate.shippingPolicy")}
            </Link>
            <Link href="/privacy-policy" className="hover:text-mq-text transition-colors">
              {gt("gate.terms")}
            </Link>
            <Link href="/privacy-policy" className="hover:text-mq-text transition-colors">
              {gt("gate.privacy")}
            </Link>
            <Link href="/privacy-policy" className="hover:text-mq-text transition-colors">
              {gt("gate.cookies")}
            </Link>
          </nav>
          <p className="text-[11px] text-mq-text-muted">
            {gt("gate.copyright")}
          </p>
        </div>
      </footer>
    </div>
  );
}
