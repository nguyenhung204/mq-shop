"use client";

import { useState, useRef, useEffect } from "react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { FlagIcon } from "@/components/i18n/FlagIcon";
import { LOCALE_META, LOCALES, type Locale } from "@/lib/i18n/types";

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target;
      if (ref.current && target instanceof Node && !ref.current.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  if (!locale) return null;

  const current = LOCALE_META[locale];

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mq-icon-btn flex items-center gap-1 sm:gap-1.5 text-mq-text hover:text-mq-gold transition-colors text-xs font-semibold tracking-wider"
        aria-label={`Language: ${current.native}`}
        aria-expanded={open}
      >
        <FlagIcon locale={locale} />
        <span className="hidden sm:inline">{current.code}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 min-w-[88px] bg-mq-surface border border-mq-border shadow-lg py-1 z-50">
          {LOCALES.map((l) => {
            const meta = LOCALE_META[l];
            return (
              <button
                key={l}
                type="button"
                title={meta.native}
                onClick={() => {
                  setLocale(l as Locale);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors ${
                  l === locale
                    ? "text-mq-gold bg-mq-surface-subtle"
                    : "text-mq-text hover:bg-mq-surface-subtle"
                }`}
              >
                <FlagIcon locale={l} />
                <span>{meta.code}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
