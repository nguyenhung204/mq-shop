import { ApiError } from "@/lib/api/client";
import { getTranslation } from "@/lib/i18n/get-translation";
import type { Locale } from "@/lib/i18n/types";
import { tt } from "@/lib/i18n/tt";

/** Machine error codes from BE — never show these verbatim in UI. */
export const API_ERROR_I18N: Record<string, string> = {
  INVALID_CREDENTIALS: "toast.invalidCredentials",
  INCORRECT_PASSWORD: "toast.incorrectPassword",
  INVALID_PASSWORD: "toast.incorrectPassword",
  ACCOUNT_LOCKED: "toast.accountLocked",
  UNAUTHORIZED: "toast.sessionExpired",
  EMAIL_ALREADY_IN_USE: "toast.emailAlreadyInUse",
  INVALID_OTP: "toast.invalidOtp",
  TOO_MANY_REQUESTS: "toast.tooManyRequests",
  REGISTRATION_NOT_FOUND: "toast.registrationNotFound",
  REFERRER_NOT_FOUND: "toast.referrerNotFound",
  REFERRER_INVALID: "toast.referrerInvalid",
  FORBIDDEN: "toast.accessDenied",
  INVALID_AVATAR: "toast.invalidImageType",
  AVATAR_TOO_LARGE: "toast.imageTooLarge",
  SHOP_NOT_FOUND: "toast.shopNotFound",
  SHOP_NOT_ELIGIBLE: "toast.shopNotEligible",
  SHOP_NOT_APPROVED: "toast.shopNotApproved",
  TAX_ID_TAKEN: "toast.taxIdTaken",
  SHOP_NAME_TAKEN: "toast.shopNameTaken",
  PRODUCT_NOT_FOUND: "toast.productNotFound",
  PRODUCT_NOT_HIDDEN: "toast.productNotHidden",
  ORDER_NOT_FOUND: "toast.orderNotFound",
  WALLET_NOT_FOUND: "toast.walletNotFound",
  WALLET_PIN_REQUIRED: "toast.walletPinRequired",
  WALLET_PIN_INVALID: "toast.walletPinInvalid",
  WALLET_INSUFFICIENT_BALANCE: "toast.walletInsufficientBalance",
  IDEMPOTENCY_KEY_REQUIRED: "toast.idempotencyKeyRequired",
  IDEMPOTENCY_KEY_REUSE_MISMATCH: "toast.idempotencyKeyReuseMismatch",
  IDEMPOTENCY_REQUEST_IN_PROGRESS: "toast.idempotencyRequestInProgress",
};

const API_CODE_PATTERN = /^[A-Z][A-Z0-9_]{2,}$/;
const CODE_SUFFIX_PATTERN = /\s*\([A-Z][A-Z0-9_]+\)\s*$/;

function looksLikeApiCode(text: string): boolean {
  return API_CODE_PATTERN.test(text.trim());
}

function stripCodeSuffix(text: string): string {
  return text.replace(CODE_SUFFIX_PATTERN, "").trim();
}

function translateKey(key: string, locale?: Locale | null): string {
  if (locale) return getTranslation(locale, key);
  return tt(key);
}

function messageForCode(code: string | null | undefined, locale?: Locale | null): string | null {
  if (!code) return null;
  const key = API_ERROR_I18N[code];
  return key ? translateKey(key, locale) : null;
}

function sanitizeText(
  message: string,
  code: string | null,
  fallback: string,
  locale?: Locale | null,
): string {
  const mapped = messageForCode(code, locale);
  if (mapped) return mapped;

  const cleaned = stripCodeSuffix(message).trim();
  if (!cleaned || looksLikeApiCode(cleaned)) {
    return messageForCode(cleaned, locale) ?? fallback;
  }
  return cleaned;
}

export function getErrorMessage(
  e: unknown,
  fallback = tt("toast.somethingWentWrong"),
  locale?: Locale | null,
): string {
  if (e instanceof ApiError) {
    return sanitizeText(e.message, e.code, fallback, locale);
  }
  if (e instanceof Error) {
    return sanitizeText(e.message, null, fallback, locale);
  }
  return fallback;
}
