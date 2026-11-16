"use client";

import { useLanguage } from "@/components/providers/LanguageProvider";
import { needsHandling } from "@/lib/orders/needs-handling";
import type { OrderView } from "@/lib/api/orders";

/** "Cần xử lý": an unhandled bill that the platform has escalated. Renders nothing otherwise. */
export function NeedsHandlingBadge({
  order,
  className = "",
}: {
  order: Pick<OrderView, "status" | "paymentEscalatedAt">;
  className?: string;
}) {
  const { t } = useLanguage();
  if (!needsHandling(order)) return null;
  return <span className={`mq-badge mq-badge-pink ${className}`.trim()}>{t("orders.payment.needsHandling")}</span>;
}
