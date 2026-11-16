"use client";

import { useLanguage } from "@/components/providers/LanguageProvider";
import type { OrderMoneyFields } from "@/lib/fx/formatOrderMoney";
import { payableView } from "@/lib/fx/payable";

/** R4: "Amount to pay" for the buyer, from the order's payable fields (never the TWD total re-converted). */
export function PayableLine({ order, locale }: { order: OrderMoneyFields; locale: string }) {
  const { t } = useLanguage();
  const v = payableView(order, locale);
  return (
    <div className="rounded-[var(--mq-radius-sm)] border border-mq-border bg-mq-surface p-3 text-sm" data-payable>
      <p>
        {t("orders.payable.amountDue")}: <strong className="tabular-nums">{v.amount}</strong>
        {v.currency !== "TWD" && !v.amount.includes(v.currency) ? (
          <span className="ml-1 text-mq-text-muted">{v.currency}</span>
        ) : null}
      </p>
      {v.lockedRate ? (
        <p className="text-xs text-mq-text-muted mt-1">{t("orders.payable.rateLocked", { rate: v.lockedRate })}</p>
      ) : null}
      {v.ledgerTwd ? (
        <p className="text-xs text-mq-text-muted">{t("orders.payable.ledgerNote", { twd: v.ledgerTwd })}</p>
      ) : null}
    </div>
  );
}
