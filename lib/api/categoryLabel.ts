import type { ApiCategory } from "@/lib/api/types";
import { getTranslation } from "@/lib/i18n/get-translation";
import type { Locale } from "@/lib/i18n/types";

/** Localized category label: API locale fields → i18n by slug → EN name. */
export function categoryLabel(
  cat: Pick<ApiCategory, "slug" | "name" | "nameVi" | "nameTw" | "nameZhTw">,
  locale: Locale,
): string {
  if (locale === "vi" && cat.nameVi) return cat.nameVi;
  if (locale === "zh-TW" && (cat.nameTw || cat.nameZhTw)) return cat.nameTw || cat.nameZhTw || "";

  const i18nKey = `categories.${cat.slug}`;
  const translated = getTranslation(locale, i18nKey);
  if (translated !== i18nKey) return translated;

  if (locale === "vi") return cat.nameVi || cat.name || cat.slug;
  return cat.name || cat.slug;
}
