import type { SystemSetting } from "@/lib/api/settings";

type T = (key: string) => string;

/** Localized texts of a setting; a key unknown to the locale files falls back to the API's own text. */
export function settingTexts(t: T, s: Pick<SystemSetting, "key" | "description" | "nullMeaning">) {
  const labelKey = `admin.settings.keys.${s.key}.label`;
  const known = t(labelKey) !== labelKey;
  return {
    known,
    label: known ? t(labelKey) : s.key,
    description: known ? t(`admin.settings.keys.${s.key}.description`) : s.description,
    nullMeaning: known ? t(`admin.settings.keys.${s.key}.nullMeaning`) : (s.nullMeaning ?? ""),
  };
}
