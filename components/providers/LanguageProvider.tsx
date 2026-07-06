"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getTranslation } from "@/lib/i18n/get-translation";
import { isLocale, LOCALE_STORAGE_KEY, type Locale } from "@/lib/i18n/types";

export function formatT(
  locale: Locale,
  key: string,
  vars?: Record<string, string>,
): string {
  let text = getTranslation(locale, key);
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(`{${k}}`, v);
    }
  }
  return text;
}

type LanguageContextValue = {
  locale: Locale | null;
  ready: boolean;
  needsSelection: boolean;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Record<string, string>) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function localeToHtmlLang(locale: Locale): string {
  if (locale === "zh-TW") return "zh-Hant";
  return locale;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(saved)) {
      setLocaleState(saved);
      document.documentElement.lang = localeToHtmlLang(saved);
    }
    setReady(true);
  }, []);

  const setLocale = useCallback((next: Locale) => {
    localStorage.setItem(LOCALE_STORAGE_KEY, next);
    setLocaleState(next);
    document.documentElement.lang = localeToHtmlLang(next);
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string>) => {
      if (!locale) return key;
      return formatT(locale, key, vars);
    },
    [locale],
  );

  const value = useMemo(
    () => ({
      locale,
      ready,
      needsSelection: ready && locale === null,
      setLocale,
      t,
    }),
    [locale, ready, setLocale, t],
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
