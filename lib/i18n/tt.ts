import { getTranslation } from "./get-translation";
import { isLocale, LOCALE_STORAGE_KEY, type Locale } from "./types";

/** Resolve active UI locale outside React (e.g. React Query toasts). */
export function currentLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
  return isLocale(saved) ? saved : "en";
}

/** Translate with optional `{var}` interpolation using the current locale. */
export function tt(key: string, vars?: Record<string, string>): string {
  let text = getTranslation(currentLocale(), key);
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(`{${k}}`, v);
    }
  }
  return text;
}
