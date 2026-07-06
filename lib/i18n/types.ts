export const LOCALES = ["vi", "zh-TW", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_STORAGE_KEY = "mq-lang";

export const LOCALE_META: Record<
  Locale,
  { label: string; native: string; code: string }
> = {
  vi: { label: "Vietnamese", native: "Tiếng Việt", code: "VI" },
  "zh-TW": { label: "Traditional Chinese", native: "繁體中文", code: "TW" },
  en: { label: "English", native: "English", code: "EN" },
};

export function isLocale(value: string | null): value is Locale {
  return value !== null && LOCALES.includes(value as Locale);
}
