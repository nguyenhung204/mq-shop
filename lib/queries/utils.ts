import { ApiError } from "@/lib/api/client";
import { getTranslation } from "@/lib/i18n/get-translation";
import type { Locale } from "@/lib/i18n/types";
import { statusLabel } from "@/lib/i18n/status";
import { tt, currentLocale } from "@/lib/i18n/tt";

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
  RBAC_MATRIX_LOCKOUT: "toast.rbacMatrixLockout",
  RBAC_MATRIX_INVALID: "toast.rbacMatrixInvalid",
  INVALID_AVATAR: "toast.invalidImageType",
  AVATAR_TOO_LARGE: "toast.imageTooLarge",
  SHOP_NOT_FOUND: "toast.shopNotFound",
  SHOP_NOT_ELIGIBLE: "toast.shopNotEligible",
  SHOP_NOT_APPROVED: "toast.shopNotApproved",
  SHOP_NOT_PENDING: "toast.shopNotPending",
  SHOP_NOT_SUSPENDED: "toast.shopNotSuspended",
  SHOP_ALREADY_EXISTS: "toast.shopAlreadyExists",
  TAX_ID_TAKEN: "toast.taxIdTaken",
  SHOP_NAME_TAKEN: "toast.shopNameTaken",
  PRODUCT_NOT_FOUND: "toast.productNotFound",
  PRODUCT_NOT_HIDDEN: "toast.productNotHidden",
  ORDER_NOT_FOUND: "toast.orderNotFound",
  ORDER_MULTI_SHOP: "toast.orderMultiShop",
  ORDER_OWN_SHOP_FORBIDDEN: "toast.orderOwnShopForbidden",
  ORDER_NOT_CANCELLABLE: "toast.orderNotCancellable",
  ORDER_INVALID_TRANSITION: "toast.orderInvalidTransition",
  RMA_WINDOW_EXPIRED: "toast.rmaWindowExpired",
  RMA_NOT_ALLOWED: "toast.rmaNotAllowed",
  RMA_ALREADY_EXISTS: "toast.rmaAlreadyExists",
  USER_NOT_FOUND: "toast.buyerNotFound",
  VARIANT_NOT_FOUND: "toast.variantNotFound",
  INSUFFICIENT_STOCK: "toast.insufficientStock",
  WALLET_NOT_FOUND: "toast.walletNotFound",
  WALLET_PIN_REQUIRED: "toast.walletPinRequired",
  WALLET_PIN_INVALID: "toast.walletPinInvalid",
  WALLET_INSUFFICIENT_BALANCE: "toast.walletInsufficientBalance",
  WAREHOUSE_CODE_TAKEN: "toast.warehouseCodeTaken",
  WAREHOUSE_NOT_FOUND: "toast.warehouseNotFound",
  VARIANT_SKU_TAKEN: "toast.variantSkuTaken",
  INVENTORY_SLIP_NOT_FOUND: "toast.inventorySlipNotFound",
  INVENTORY_SLIP_ALREADY_PROCESSED: "toast.inventorySlipAlreadyProcessed",
  INVENTORY_SLIP_DUPLICATE_SKU: "toast.inventorySlipDuplicateSku",
  IDEMPOTENCY_KEY_REQUIRED: "toast.idempotencyKeyRequired",
  IDEMPOTENCY_KEY_REUSE_MISMATCH: "toast.idempotencyKeyReuseMismatch",
  IDEMPOTENCY_REQUEST_IN_PROGRESS: "toast.idempotencyRequestInProgress",
  WALLET_RECIPIENT_USE_EMAIL: "toast.walletRecipientUseEmail",
  PAYOUT_SHOP_NO_BANK_INFO: "toast.payoutShopNoBankInfo",
  PROMOTION_RULE_RANK_NOT_FOUND: "toast.promotionRuleRankNotFound",
  PROMOTION_RULE_INVALID_RANK_ORDER: "toast.promotionRuleInvalidRankOrder",
  PROMOTION_RULE_DUPLICATE: "toast.promotionRuleDuplicate",
  SELLER_CLOSURE_BLOCKED: "toast.sellerClosureBlocked",
};

const STATUS_TOKENS_BY_DOMAIN: Record<string, string[]> = {
  shop: ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"],
  order: [
    "PENDING",
    "PAID",
    "SHIPPED",
    "DELIVERED",
    "CANCELLED",
    "REFUNDED",
    "REFUND_APPROVED",
  ],
  product: ["PENDING", "ACTIVE", "REJECTED", "HIDDEN"],
  promo: ["PENDING", "APPROVED", "REJECTED"],
  rma: ["PENDING", "APPROVED", "REJECTED", "REFUND_APPROVED", "REFUNDED", "CLOSED"],
};

function replaceStatusTokensInText(text: string, locale?: Locale | null): string {
  if (!locale || !text) return text;
  let out = text;
  for (const [domain, tokens] of Object.entries(STATUS_TOKENS_BY_DOMAIN)) {
    for (const token of tokens) {
      const label = statusLabel(locale, domain, token);
      if (label && label !== token) {
        out = out.replaceAll(token, label);
      }
    }
  }
  return out;
}

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
  // VALIDATION_ERROR: prefer raw message from BE (contains field-specific detail)
  if (code === 'VALIDATION_ERROR') return null;
  const key = API_ERROR_I18N[code];
  return key ? translateKey(key, locale) : null;
}

function resolveLocale(locale?: Locale | null): Locale {
  return locale ?? currentLocale();
}

function sanitizeText(
  message: string,
  code: string | null,
  fallback: string,
  locale?: Locale | null,
): string {
  const lang = resolveLocale(locale);
  const mapped = messageForCode(code, lang);
  if (mapped) return mapped;

  const cleaned = stripCodeSuffix(message).trim();
  if (!cleaned || looksLikeApiCode(cleaned)) {
    return messageForCode(cleaned, lang) ?? fallback;
  }
  return replaceStatusTokensInText(cleaned, lang);
}

export function getErrorMessage(
  e: unknown,
  fallback = tt("toast.somethingWentWrong"),
  locale?: Locale | null,
): string {
  const lang = resolveLocale(locale);
  if (e instanceof ApiError) {
    // Some backends (or a reverse proxy in front of them) return a generic
    // 413 "Payload Too Large" with no machine-readable code — map it to the
    // same translated copy as our client-side avatar size check.
    if (e.status === 413) return translateKey(API_ERROR_I18N.AVATAR_TOO_LARGE!, lang);
    return sanitizeText(e.message, e.code, fallback, lang);
  }
  if (e instanceof Error) {
    return sanitizeText(e.message, null, fallback, lang);
  }
  return fallback;
}
