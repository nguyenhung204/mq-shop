import type { Locale } from "@/lib/i18n/types";

export type GateRegionId = "tw" | "my" | "vn" | "sg" | "us";

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
  us: "US",
};

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

/** ISO country codes for product listing / availability (from gate regions). */
export const PRODUCT_COUNTRY_CODES = Object.values(REGION_TO_COUNTRY);

export const GATE_REGION_IDS: GateRegionId[] = ["tw", "my", "vn", "sg", "us"];

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
  {
    id: "us",
    locale: "en",
    country: "United States",
    localLabel: "United States",
    currency: "USD",
  },
];

/** Human-readable label for a product country code badge. */
export function countryCodeLabel(code: string): string {
  const regionId = countryCodeToRegionId(code);
  if (!regionId) return code;
  const region = GATE_REGIONS.find((r) => r.id === regionId);
  return region?.localLabel ?? code;
}

/** Checkbox options for seller/admin product countryCodes fields. */
export function productCountryOptions(): Array<{ code: string; label: string }> {
  return GATE_REGIONS.map((r) => ({
    code: REGION_TO_COUNTRY[r.id],
    label: r.localLabel,
  }));
}
