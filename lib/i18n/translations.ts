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
