/** ISO 3166-1 alpha-2 codes for shipping address country select. */
export const COUNTRY_CODES = [
  "AF", "AL", "DZ", "AD", "AO", "AG", "AR", "AM", "AU", "AT",
  "AZ", "BS", "BH", "BD", "BB", "BY", "BE", "BZ", "BJ", "BT",
  "BO", "BA", "BW", "BR", "BN", "BG", "BF", "BI", "CV", "KH",
  "CM", "CA", "CF", "TD", "CL", "CN", "CO", "KM", "CG", "CD",
  "CR", "CI", "HR", "CU", "CY", "CZ", "DK", "DJ", "DM", "DO",
  "EC", "EG", "SV", "GQ", "ER", "EE", "SZ", "ET", "FJ", "FI",
  "FR", "GA", "GM", "GE", "DE", "GH", "GR", "GD", "GT", "GN",
  "GW", "GY", "HT", "HN", "HU", "IS", "IN", "ID", "IR", "IQ",
  "IE", "IL", "IT", "JM", "JP", "JO", "KZ", "KE", "KI", "KP",
  "KR", "KW", "KG", "LA", "LV", "LB", "LS", "LR", "LY", "LI",
  "LT", "LU", "MG", "MW", "MY", "MV", "ML", "MT", "MH", "MR",
  "MU", "MX", "FM", "MD", "MC", "MN", "ME", "MA", "MZ", "MM",
  "NA", "NR", "NP", "NL", "NZ", "NI", "NE", "NG", "MK", "NO",
  "OM", "PK", "PW", "PS", "PA", "PG", "PY", "PE", "PH", "PL",
  "PT", "QA", "RO", "RU", "RW", "KN", "LC", "VC", "WS", "SM",
  "ST", "SA", "SN", "RS", "SC", "SL", "SG", "SK", "SI", "SB",
  "SO", "ZA", "SS", "ES", "LK", "SD", "SR", "SE", "CH", "SY",
  "TW", "TJ", "TZ", "TH", "TL", "TG", "TO", "TT", "TN", "TR",
  "TM", "TV", "UG", "UA", "AE", "GB", "US", "UY", "UZ", "VU",
  "VA", "VE", "VN", "YE", "ZM", "ZW",
] as const;

export type CountryCode = (typeof COUNTRY_CODES)[number];

export type CountryOption = {
  code: CountryCode;
  label: string;
};

/** Prefer these near the top of the dropdown for MQ storefront. */
const PRIORITY_CODES: CountryCode[] = ["VN", "TW", "US", "SG", "JP", "KR", "CN", "TH", "MY", "AU"];

function localeForDisplayNames(locale: string): string {
  if (locale === "zh-TW" || locale === "zh_TW") return "zh-TW";
  if (locale.startsWith("vi")) return "vi";
  if (locale.startsWith("zh")) return "zh-CN";
  return "en";
}

export function getCountryOptions(locale = "en"): CountryOption[] {
  const tag = localeForDisplayNames(locale);
  let display: Intl.DisplayNames | null = null;
  try {
    display = new Intl.DisplayNames([tag], { type: "region" });
  } catch {
    display = new Intl.DisplayNames(["en"], { type: "region" });
  }

  const options = COUNTRY_CODES.map((code) => ({
    code,
    label: display?.of(code) || code,
  }));

  const priority = new Map(PRIORITY_CODES.map((code, i) => [code, i]));
  options.sort((a, b) => {
    const pa = priority.get(a.code);
    const pb = priority.get(b.code);
    if (pa != null && pb != null) return pa - pb;
    if (pa != null) return -1;
    if (pb != null) return 1;
    return a.label.localeCompare(b.label, tag);
  });

  return options;
}
