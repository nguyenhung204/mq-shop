import type { Locale } from "@/lib/i18n/types";

export type GateRegionId = "tw" | "my" | "vn" | "sg";

export type GateRegion = {
  id: GateRegionId;
  locale: Locale;
  country: string;
  localLabel: string;
  currency: string;
};

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
