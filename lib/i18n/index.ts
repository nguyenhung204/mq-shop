import type { Locale } from "./types";
import type { Messages } from "./messages";
import en from "./locales/en.json";
import vi from "./locales/vi.json";
import zhTW from "./locales/zh-TW.json";

export const translations: Record<Locale, Messages> = {
  en,
  vi,
  "zh-TW": zhTW,
};

export type { Messages } from "./messages";
export type { Locale } from "./types";
export { LOCALES, LOCALE_META, LOCALE_STORAGE_KEY, isLocale } from "./types";
export { getTranslation } from "./get-translation";
export type { TranslationDict } from "./get-translation";
