import type { Locale } from "./types";
import { translations } from "./translations";

export type TranslationDict = (typeof translations)[Locale];

export function getTranslation(locale: Locale, key: string): string {
  const parts = key.split(".");
  let current: unknown = translations[locale];

  for (const part of parts) {
    if (!current || typeof current !== "object" || !(part in current)) {
      return key;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return typeof current === "string" ? current : key;
}
