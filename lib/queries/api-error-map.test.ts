import { describe, expect, it } from "vitest";
import en from "@/lib/i18n/locales/en.json";
import vi from "@/lib/i18n/locales/vi.json";
import zh from "@/lib/i18n/locales/zh-TW.json";
import { API_ERROR_I18N } from "./utils";

const NEW_CODES = [
  "PRODUCT_NOT_ACTIVE",
  "INVENTORY_TRANSFER_RECEIVE_MISMATCH",
  "WALLET_AMOUNT_INVALID",
  "CSRF_ORIGIN_REJECTED",
  "CATEGORY_PARENT_CYCLE",
  "PAYOUT_GATEWAY_REF_REQUIRED",
  "MLM_USER_PAYOUT_INVALID_STATUS",
  "REVIEW_NOT_ALLOWED",
  "INVALID_SHOP_DOCUMENT",
];

const lookup = (loc: unknown, key: string): unknown =>
  key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], loc);

describe("API_ERROR_I18N phase 3 codes", () => {
  for (const code of NEW_CODES) {
    it(`${code} maps to a key that exists in en/vi/zh-TW`, () => {
      const key = API_ERROR_I18N[code];
      expect(key, code).toBeTruthy();
      for (const loc of [en, vi, zh]) expect(typeof lookup(loc, key!), `${code} -> ${key}`).toBe("string");
    });
  }
});
