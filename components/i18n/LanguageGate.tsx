"use client";

import { useState } from "react";
import { FlagIcon } from "@/components/i18n/FlagIcon";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { getTranslation } from "@/lib/i18n/get-translation";
import { LOCALE_META, LOCALES, type Locale } from "@/lib/i18n/types";
import { Globe } from "lucide-react";

export function LanguageGate() {
  const { needsSelection, setLocale } = useLanguage();
  const [picked, setPicked] = useState<Locale | null>(null);

  if (!needsSelection) return null;

  const gt = (key: string) => getTranslation(picked ?? "en", key);

  const handleContinue = () => {
    if (picked) setLocale(picked);
  };

  return (
    <div className="mq-lang-gate fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lang-gate-title"
        className="relative w-full max-w-lg bg-mq-surface border border-mq-border shadow-2xl p-8 md:p-12"
      >
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-12 h-12 border border-mq-border text-mq-text mb-6">
            <Globe size={22} strokeWidth={1.5} />
          </div>
          <span className="mq-section-label block mb-3">{gt("gate.label")}</span>
          <h1 id="lang-gate-title" className="text-3xl md:text-4xl font-display text-mq-text tracking-wide">
            {gt("gate.title")}
          </h1>
          <p className="mt-4 text-sm text-mq-text-secondary leading-relaxed max-w-sm mx-auto">
            {gt("gate.subtitle")}
          </p>
        </div>

        <div className="space-y-3">
          {LOCALES.map((locale) => {
            const meta = LOCALE_META[locale];
            const selected = picked === locale;
            return (
              <button
                key={locale}
                type="button"
                onClick={() => setPicked(locale)}
                className={`w-full flex items-center gap-4 px-5 py-4 border text-left transition-colors ${
                  selected
                    ? "border-mq-text bg-mq-surface-subtle"
                    : "border-mq-border hover:border-mq-text-muted"
                }`}
              >
                <FlagIcon locale={locale} size="md" />
                <span className="flex-1 min-w-0">
                  <span className="block text-base font-medium text-mq-text">
                    {meta.native} <span className="text-mq-text-muted">({meta.code})</span>
                  </span>
                  <span className="block text-xs text-mq-text-muted mt-0.5">{meta.label}</span>
                </span>
                <span
                  className={`w-4 h-4 rounded-full border shrink-0 ${
                    selected ? "border-mq-text bg-mq-gold" : "border-mq-border"
                  }`}
                  aria-hidden
                />
              </button>
            );
          })}
        </div>

        <button
          type="button"
          disabled={!picked}
          onClick={handleContinue}
          className="mq-btn mq-btn-primary w-full mt-8 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {gt("gate.continue")}
        </button>

        <p className="text-center mt-6 text-[11px] text-mq-text-muted uppercase tracking-[0.2em]">
          mq
        </p>
      </div>
    </div>
  );
}
