import type { Locale } from "@/lib/i18n/types";

/**
 * Business regions: the four the API accepts (TW, VN, MY, SG; any other value is 400 REGION_INVALID).
 * "us" is NOT a business region: USD stays a display currency (lib/fx/convert.ts) but nobody can register,
 * switch to or check out in a US region.
 */
export type GateRegionId = "tw" | "my" | "vn" | "sg";

export type GateRegion = {
  id: GateRegionId;
  locale: Locale;
  country: string;
  localLabel: string;
  currency: string;
};

/** Map gate region id → ISO 3166-1 alpha-2 country code (product listing / cart). */
export const REGION_TO_COUNTRY: Record<GateRegionId, string> = {
  tw: "TW",
  my: "MY",
  vn: "VN",
  sg: "SG",
};

/** Region codes exactly as the API takes and returns them. */
export const BUSINESS_REGION_CODES = ["TW", "VN", "MY", "SG"] as const;
export type BusinessRegionCode = (typeof BUSINESS_REGION_CODES)[number];

/** Gate region id from a code the API returned (any case); null for anything that is not a business region. */
export function regionIdFromApiCode(code: string | null | undefined): GateRegionId | null {
  if (!code) return null;
  const upper = code.trim().toUpperCase();
  const found = (Object.entries(REGION_TO_COUNTRY) as Array<[GateRegionId, string]>).find(([, c]) => c === upper);
  return found?.[0] ?? null;
}

/** The code sent to the API for a selected region (upper case). */
export function apiRegionCode(id: GateRegionId): BusinessRegionCode {
  return REGION_TO_COUNTRY[id] as BusinessRegionCode;
}

const COUNTRY_TO_REGION_ENTRIES = Object.entries(REGION_TO_COUNTRY) as Array<
  [GateRegionId, string]
>;

/** ISO country code → gate region id */
export function countryCodeToRegionId(code: string): GateRegionId | null {
  const upper = code.toUpperCase();
  const found = COUNTRY_TO_REGION_ENTRIES.find(([, c]) => c === upper);
  return found?.[0] ?? null;
}

export function regionIdToCountryCode(regionId: GateRegionId): string {
  return REGION_TO_COUNTRY[regionId];
}

/**
 * Countries a product can be listed in (catalog). This is not the business-region list: US stays a
 * catalog country for products that already list it.
 */
export const CATALOG_COUNTRIES: Array<{ code: string; label: string }> = [
  { code: "TW", label: "台灣" },
  { code: "MY", label: "Malaysia" },
  { code: "VN", label: "Việt Nam" },
  { code: "SG", label: "Singapore" },
  { code: "US", label: "United States" },
];

/** ISO country codes for product listing / availability. */
export const PRODUCT_COUNTRY_CODES = CATALOG_COUNTRIES.map((c) => c.code);

export const GATE_REGION_IDS: GateRegionId[] = ["tw", "my", "vn", "sg"];

export function isValidRegion(value: string | null): value is GateRegionId {
  return value !== null && GATE_REGION_IDS.includes(value as GateRegionId);
}

/** Region cards shown on the first-visit language / destination gate. */
export const GATE_REGIONS: GateRegion[] = [
  {
    id: "tw",
    locale: "zh-TW",
    country: "Taiwan",
    localLabel: "台灣",
    currency: "TWD",
  },
  {
    id: "my",
    locale: "en",
    country: "Malaysia",
    localLabel: "Malaysia",
    currency: "MYR",
  },
  {
    id: "vn",
    locale: "vi",
    country: "Vietnam",
    localLabel: "Việt Nam",
    currency: "VND",
  },
  {
    id: "sg",
    locale: "en",
    country: "Singapore",
    localLabel: "Singapore",
    currency: "SGD",
  },
];

/** Human-readable label for a product country code badge. */
export function countryCodeLabel(code: string): string {
  const upper = code.toUpperCase();
  return CATALOG_COUNTRIES.find((c) => c.code === upper)?.label ?? code;
}

/** Checkbox options for seller/admin product countryCodes fields. */
export function productCountryOptions(): Array<{ code: string; label: string }> {
  return CATALOG_COUNTRIES;
}
