"use client";

import { useEffect, useState } from "react";
import type { OrderView } from "@/lib/api/orders";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { toIntlLocale } from "@/lib/i18n/locale-format";
import {
  formatShopperDeadline,
  isAwaitingUnpaidProof,
  resolveUnpaidProofDueAt,
  shopperGmtLabel,
  shopperIanaTimeZone,
  unpaidProofHoursLeft,
} from "@/lib/orders/unpaid-proof-deadline";

function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function UnpaidProofCountdown({
  order,
  compact = false,
}: {
  order: Pick<
    OrderView,
    | "status"
    | "paymentProofUrl"
    | "paymentFirstProofAt"
    | "paymentProofPurgedAt"
    | "createdAt"
    | "unpaidProofDueAt"
    | "displayCurrency"
    | "shippingAddress"
  >;
  compact?: boolean;
}) {
  const { t, locale } = useLanguage();
  const now = useNow();

  if (!isAwaitingUnpaidProof(order)) return null;

  const dueAt = resolveUnpaidProofDueAt(order);
  const hours = unpaidProofHoursLeft(dueAt, now);
  const iana = shopperIanaTimeZone(order);
  const tz = shopperGmtLabel(iana);
  const when = formatShopperDeadline(dueAt, iana, toIntlLocale(locale));

  if (hours <= 0) {
    return (
      <p className={compact ? "text-xs text-mq-accent-orange" : "text-sm text-mq-accent-orange"}>
        {t("orders.payment.unpaidDeadlineOverdue")}
      </p>
    );
  }

  return (
    <div className={compact ? "text-xs text-mq-accent-orange" : "text-sm text-mq-accent-orange space-y-0.5"}>
      <p>{t("orders.payment.unpaidHoursLeft", { hours: String(hours) })}</p>
      {compact ? null : (
        <p className="text-xs text-mq-text-muted">
          {t("orders.payment.unpaidDeadlineWall", { when, tz })}
        </p>
      )}
    </div>
  );
}
