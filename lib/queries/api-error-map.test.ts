import { describe, expect, it } from "vitest";
import en from "@/lib/i18n/locales/en.json";
import vi from "@/lib/i18n/locales/vi.json";
import zh from "@/lib/i18n/locales/zh-TW.json";
import { API_ERROR_I18N } from "./utils";

const NEW_CODES = [
  "PRODUCT_NOT_ACTIVE",
  "INVENTORY_TRANSFER_RECEIVE_MISMATCH",
  "WALLET_AMOUNT_INVALID",
  "WALLET_AMOUNT_TOO_LARGE",
  "AMOUNT_INVALID",
  "AMOUNT_NOT_POSITIVE",
  "AMOUNT_TOO_LARGE",
  "AMOUNT_TOO_MANY_DECIMALS",
  "CSRF_ORIGIN_REJECTED",
  "CATEGORY_PARENT_CYCLE",
  "PAYOUT_GATEWAY_REF_REQUIRED",
  "PAYOUT_PAID_CANNOT_FAIL",
  "PAYOUT_SENT_TO_BANK_CANNOT_FAIL",
  "MLM_USER_PAYOUT_INVALID_STATUS",
  "REVIEW_NOT_ALLOWED",
  "INVALID_SHOP_DOCUMENT",
  "SETTING_INVALID",
  "SETTING_NOT_FOUND",
  "DIVIDEND_INPUT_INVALID",
  "DIVIDEND_USER_NOT_FOUND",
  "DIVIDEND_RATE_CONFLICT",
  "DIVIDEND_QUARTER_LOCKED",
  "DIVIDEND_SLOT_CAP_EXCEEDED",
  "DIVIDEND_SLOT_INSUFFICIENT",
  "RMA_REFUND_AMOUNT_INVALID",
  "ORDER_PAID_AT_INVALID",
  "REGION_INVALID",
  "REFUND_CASE_NOT_FOUND",
  "REFUND_CASE_INVALID",
  "REFUND_CASE_INVALID_TRANSITION",
  "EXPORT_TOO_MANY_ROWS",
  "EXPORT_TIMEOUT",
  "RMA_ESCALATION_REQUIRED",
  "ACCOUNT_PENDING_ACTIVATION",
  "SUB_ACCOUNT_LIMIT",
  "SUB_ACCOUNT_DEPTH_LIMIT",
  "SUB_ACCOUNT_PARENT_INVALID",
  "SUB_ACCOUNT_HAS_CHILDREN",
  "SUB_ACCOUNT_REPARENT_FORBIDDEN",
  "SUB_ACCOUNT_INVITE_INVALID",
  "SUB_ACCOUNT_INVITE_NOT_FOUND",
  "SUB_ACCOUNT_INVITE_LIMIT",
  "SUB_ACCOUNT_NOT_PENDING",
  "SUB_ACCOUNT_DECLINED_RECENTLY",
  "DIVIDEND_AUTO_CREDIT_DISABLED",
  "DIVIDEND_AUTO_CREDIT_FROM_REQUIRED",
  "DIVIDEND_SETTLEMENT_NOT_FOUND",
  "DIVIDEND_CREDIT_NOT_FOUND",
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
