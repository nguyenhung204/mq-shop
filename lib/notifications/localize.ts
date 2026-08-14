import { getTranslation } from "@/lib/i18n/get-translation";
import {
  NOTIFICATION_FALLBACK_TITLE,
  NOTIFICATION_TYPE_COPY,
} from "@/lib/i18n/notifications/copy";
import { mlmRankLabel } from "@/lib/i18n/mlm-rank";
import { statusLabel } from "@/lib/i18n/status";
import type { Locale } from "@/lib/i18n/types";
import type { ApiNotification } from "@/lib/api/types";

const STATUS_DOMAIN_BY_TYPE: Record<string, string> = {
  ORDER_STATUS_UPDATED: "order",
  ORDER_NEW: "order",
  ORDER_CANCELLED: "order",
  ORDER_CREATED_BY_ADMIN: "order",
  ORDER_CREATED_PAYMENT_NEEDED: "order",
  COMMISSION_REFERRAL_TRIGGERED: "order",
  COMMISSION_JOB_FAILED: "order",
  RMA_NEW: "rma",
  RMA_APPROVED: "rma",
  RMA_REJECTED: "rma",
  RMA_REFUND_COMPLETED: "rma",
  RMA_APPROVED_EXTERNAL_REFUND: "rma",
  RMA_RETURN_SHIPPED: "rma",
  RMA_RETURN_RECEIVED: "rma",
  RMA_RETURN_REJECTED: "rma",
  RMA_DISPUTED: "rma",
  RMA_REFUND_PENDING: "rma",
  RMA_REFUND_SENT: "rma",
  RMA_GOODS_RETURN_PENDING: "rma",
  RMA_GOODS_RETURN_SHIPPED: "rma",
  RMA_GOODS_RETURN_ISSUE: "rma",
  RMA_CLOSED: "rma",
  RMA_ESCALATED: "rma",
  SHOP_APPLICATION_NEW: "shop",
  SHOP_APPROVED: "shop",
  SHOP_REJECTED: "shop",
  SHOP_SUSPENDED: "shop",
  SHOP_REINSTATED: "shop",
  SHOP_BANK_INFO_SETUP: "shop",
  SELLER_PAYOUT_COMPLETED: "shop",
  SELLER_PAYOUT_REJECTED: "shop",
  PRODUCT_APPROVED: "product",
  PRODUCT_REJECTED: "product",
  PRODUCT_HIDDEN: "product",
  PROMOTION_APPROVED: "promo",
  PROMOTION_REJECTED: "promo",
};

function walletPayoutStatusLabel(locale: Locale | null, value: string): string {
  if (!locale) return value;
  const key = `wallet.payoutStatus.${value}`;
  const label = getTranslation(locale, key);
  return label === key ? statusLabel(locale, "financeItem", value) : label;
}

function interpolate(template: string, vars: Record<string, string>): string {
  let text = template;
  for (const [key, value] of Object.entries(vars)) {
    text = text.replaceAll(`{${key}}`, value);
  }
  if (text.includes("{reason}")) {
    text = text.replaceAll("{reason}", "");
  }
  return text.replace(/\s{2,}/g, " ").trim();
}

function buildVars(
  type: string,
  meta: Record<string, string> | null | undefined,
  locale: Locale | null,
  metaNames?: Record<string, string> | null,
): Record<string, string> {
  const vars: Record<string, string> = { ...(meta ?? {}) };
  const domain = STATUS_DOMAIN_BY_TYPE[type];

  if (domain) {
    for (const key of ["status", "previousStatus"] as const) {
      if (vars[key]) vars[key] = statusLabel(locale, domain, vars[key]);
    }
  }

  if (type.startsWith("WALLET_WITHDRAW") && vars.status) {
    vars.status = walletPayoutStatusLabel(locale, vars.status);
  }

  if (vars.mlmRank) {
    vars.mlmRank = mlmRankLabel(
      (key) => (locale ? getTranslation(locale, key) : key),
      Number(vars.mlmRank),
      vars.mlmRank,
    );
  }
  if (vars.previousRank) {
    vars.previousRank = mlmRankLabel(
      (key) => (locale ? getTranslation(locale, key) : key),
      Number(vars.previousRank),
      vars.previousRank,
    );
  }

  if (vars.reason?.trim()) {
    vars.reason =
      locale === "vi"
        ? ` Lý do: ${vars.reason.trim()}`
        : locale === "zh-TW"
          ? ` 原因：${vars.reason.trim()}`
          : ` Reason: ${vars.reason.trim()}`;
  } else {
    vars.reason = "";
  }

  // Prefer resolved names from metaNames over raw UUIDs.
  // Templates use {orderId}, {shopId}, etc. directly — overwrite them with the
  // human-readable value so the placeholder shows a name, not a UUID.
  if (vars.orderCode) vars.orderId = vars.orderCode;
  if (metaNames) {
    if (metaNames.orderCode) vars.orderId = metaNames.orderCode;
    if (metaNames.shopName) vars.shopId = metaNames.shopName;
    if (metaNames.userName) vars.userId = metaNames.userName;
  }

  // Never surface raw UUIDs in notification copy.
  for (const [key, raw] of Object.entries(vars)) {
    if (raw && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) {
      vars[key] = "—";
    }
  }

  return vars;
}

/** Localized title/body for inbox + toast. Falls back to BE copy only when type is unknown. */
export function localizeNotification(
  n: Pick<ApiNotification, "type" | "title" | "body" | "meta" | "metaNames">,
  locale: Locale | null,
): { title: string; body: string } {
  const type = (n.type || "GENERIC").toUpperCase();
  const lang = locale ?? "en";
  const copy = NOTIFICATION_TYPE_COPY[lang]?.[type];

  if (!copy) {
    return {
      title: n.title?.trim() || NOTIFICATION_FALLBACK_TITLE[lang],
      body: n.body?.trim() || "",
    };
  }

  const vars = buildVars(type, n.meta, locale, n.metaNames);
  return {
    title: interpolate(copy.title, vars),
    body: interpolate(copy.body, vars),
  };
}
