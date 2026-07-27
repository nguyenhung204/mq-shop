import type { CountryCode } from "@/lib/data/countries";
import { getCountryOptions } from "@/lib/data/countries";

/** ITU dialing codes keyed by ISO 3166-1 alpha-2. */
export const DIAL_BY_COUNTRY: Record<CountryCode, string> = {
  AF: "93",
  AL: "355",
  DZ: "213",
  AD: "376",
  AO: "244",
  AG: "1",
  AR: "54",
  AM: "374",
  AU: "61",
  AT: "43",
  AZ: "994",
  BS: "1",
  BH: "973",
  BD: "880",
  BB: "1",
  BY: "375",
  BE: "32",
  BZ: "501",
  BJ: "229",
  BT: "975",
  BO: "591",
  BA: "387",
  BW: "267",
  BR: "55",
  BN: "673",
  BG: "359",
  BF: "226",
  BI: "257",
  CV: "238",
  KH: "855",
  CM: "237",
  CA: "1",
  CF: "236",
  TD: "235",
  CL: "56",
  CN: "86",
  CO: "57",
  KM: "269",
  CG: "242",
  CD: "243",
  CR: "506",
  CI: "225",
  HR: "385",
  CU: "53",
  CY: "357",
  CZ: "420",
  DK: "45",
  DJ: "253",
  DM: "1",
  DO: "1",
  EC: "593",
  EG: "20",
  SV: "503",
  GQ: "240",
  ER: "291",
  EE: "372",
  SZ: "268",
  ET: "251",
  FJ: "679",
  FI: "358",
  FR: "33",
  GA: "241",
  GM: "220",
  GE: "995",
  DE: "49",
  GH: "233",
  GR: "30",
  GD: "1",
  GT: "502",
  GN: "224",
  GW: "245",
  GY: "592",
  HT: "509",
  HN: "504",
  HU: "36",
  IS: "354",
  IN: "91",
  ID: "62",
  IR: "98",
  IQ: "964",
  IE: "353",
  IL: "972",
  IT: "39",
  JM: "1",
  JP: "81",
  JO: "962",
  KZ: "7",
  KE: "254",
  KI: "686",
  KP: "850",
  KR: "82",
  KW: "965",
  KG: "996",
  LA: "856",
  LV: "371",
  LB: "961",
  LS: "266",
  LR: "231",
  LY: "218",
  LI: "423",
  LT: "370",
  LU: "352",
  MG: "261",
  MW: "265",
  MY: "60",
  MV: "960",
  ML: "223",
  MT: "356",
  MH: "692",
  MR: "222",
  MU: "230",
  MX: "52",
  FM: "691",
  MD: "373",
  MC: "377",
  MN: "976",
  ME: "382",
  MA: "212",
  MZ: "258",
  MM: "95",
  NA: "264",
  NR: "674",
  NP: "977",
  NL: "31",
  NZ: "64",
  NI: "505",
  NE: "227",
  NG: "234",
  MK: "389",
  NO: "47",
  OM: "968",
  PK: "92",
  PW: "680",
  PS: "970",
  PA: "507",
  PG: "675",
  PY: "595",
  PE: "51",
  PH: "63",
  PL: "48",
  PT: "351",
  QA: "974",
  RO: "40",
  RU: "7",
  RW: "250",
  KN: "1",
  LC: "1",
  VC: "1",
  WS: "685",
  SM: "378",
  ST: "239",
  SA: "966",
  SN: "221",
  RS: "381",
  SC: "248",
  SL: "232",
  SG: "65",
  SK: "421",
  SI: "386",
  SB: "677",
  SO: "252",
  ZA: "27",
  SS: "211",
  ES: "34",
  LK: "94",
  SD: "249",
  SR: "597",
  SE: "46",
  CH: "41",
  SY: "963",
  TW: "886",
  TJ: "992",
  TZ: "255",
  TH: "66",
  TL: "670",
  TG: "228",
  TO: "676",
  TT: "1",
  TN: "216",
  TR: "90",
  TM: "993",
  TV: "688",
  UG: "256",
  UA: "380",
  AE: "971",
  GB: "44",
  US: "1",
  UY: "598",
  UZ: "998",
  VU: "678",
  VA: "379",
  VE: "58",
  VN: "84",
  YE: "967",
  ZM: "260",
  ZW: "263",
};

/** Typical national significant number length (digits, no trunk 0). */
const NATIONAL_LEN: Partial<Record<CountryCode, { min: number; max: number }>> = {
  VN: { min: 9, max: 10 },
  TW: { min: 8, max: 10 },
  US: { min: 10, max: 10 },
  CA: { min: 10, max: 10 },
  SG: { min: 8, max: 8 },
  JP: { min: 9, max: 11 },
  KR: { min: 9, max: 11 },
  CN: { min: 11, max: 11 },
  TH: { min: 8, max: 10 },
  MY: { min: 8, max: 11 },
  AU: { min: 9, max: 9 },
  GB: { min: 9, max: 11 },
};

const DEFAULT_LEN = { min: 6, max: 15 };

export function getDialCode(countryCode: string): string {
  const code = countryCode.toUpperCase() as CountryCode;
  return DIAL_BY_COUNTRY[code] ?? "84";
}

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** Strip trunk prefix `0` so national digits can be joined with dial code. */
export function toNationalDigits(value: string): string {
  const digits = digitsOnly(value);
  return digits.replace(/^0+/, "");
}

export function toE164(countryCode: string, nationalOrFull: string): string {
  const dial = getDialCode(countryCode);
  let digits = digitsOnly(nationalOrFull);
  if (digits.startsWith(dial)) {
    // already includes country dial code
  } else {
    digits = dial + toNationalDigits(nationalOrFull);
  }
  return `+${digits}`.slice(0, 32);
}

export function splitStoredPhone(
  phone: string | null | undefined,
  countryCode: string,
): string {
  if (!phone) return "";
  const dial = getDialCode(countryCode);
  let digits = digitsOnly(phone);
  if (digits.startsWith(dial)) digits = digits.slice(dial.length);
  return digits.replace(/^0+/, "");
}

export function nationalLength(countryCode: string) {
  const code = countryCode.toUpperCase() as CountryCode;
  return NATIONAL_LEN[code] ?? DEFAULT_LEN;
}

export function isValidNationalPhone(countryCode: string, national: string): boolean {
  const digits = toNationalDigits(national);
  const { min, max } = nationalLength(countryCode);
  return digits.length >= min && digits.length <= max;
}

export function phonePlaceholder(countryCode: string): string {
  switch (countryCode.toUpperCase()) {
    case "VN":
      return "901234567";
    case "TW":
      return "912345678";
    case "US":
    case "CA":
      return "2025550123";
    case "SG":
      return "81234567";
    case "JP":
      return "9012345678";
    case "KR":
      return "1012345678";
    case "TH":
      return "812345678";
    case "MY":
      return "123456789";
    case "AU":
      return "412345678";
    default:
      return "123456789";
  }
}

export type DialCountryOption = {
  code: CountryCode;
  dial: string;
  label: string;
};

/** Options for phone dial-code select (independent from shipping country). */
export function getDialCountryOptions(locale = "en"): DialCountryOption[] {
  return getCountryOptions(locale).map((opt) => ({
    code: opt.code,
    dial: getDialCode(opt.code),
    label: opt.label,
  }));
}

/** Loose E.164 check (dial code independent of shipping address country). */
export function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(phone.trim());
}
