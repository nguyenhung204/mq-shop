"use client";

import { StatusBadge } from "@/components/dividend/SettlementViews";
import { useLanguage } from "@/components/providers/LanguageProvider";
import type { SettlementItem } from "@/lib/api/dividend-settlements";
import { formatDateTimeGmt8 } from "@/lib/i18n/gmt8-calendar";
import { toIntlLocale } from "@/lib/i18n/locale-format";
import { formatMoney, periodKeyLabel } from "@/lib/dividend/settlement";

/** One of my dividend lines: amount in TWD and in points, status, wallet transaction. */
export function CreditDetailView({ item }: { item: SettlementItem }) {
  const { t, locale } = useLanguage();
  const intl = toIntlLocale(locale);
  return (
    <div className="mq-card p-4 grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
      <p>
        <span className="text-mq-text-muted">{t("dividendSettlements.col.quarter")}: </span>
        {periodKeyLabel(item.quarter)}
      </p>
      <p>
        <span className="text-mq-text-muted">{t("dividendSettlements.col.status")}: </span>
        <StatusBadge status={item.status} prefix="itemStatus" />
      </p>
      <p>
        <span className="text-mq-text-muted">{t("dividendSettlements.col.amount")}: </span>
        <strong className="tabular-nums">{formatMoney(item.amountTwd, intl)} TWD</strong>
      </p>
      <p>
        <span className="text-mq-text-muted">{t("dividendSettlements.col.points")}: </span>
        <strong className="tabular-nums">{item.points}</strong> {t("common.pointUnit")}
      </p>
      <p>
        <span className="text-mq-text-muted">{t("dividendSettlements.col.slots")}: </span>
        {item.slots}
      </p>
      <p>
        <span className="text-mq-text-muted">{t("dividendCredits.creditedAt")}: </span>
        {item.creditedAt ? formatDateTimeGmt8(item.creditedAt, intl) : "—"}
      </p>
      <p className="sm:col-span-2 break-all">
        <span className="text-mq-text-muted">{t("dividendSettlements.col.walletTx")}: </span>
        {item.walletTxId ?? "—"}
      </p>
      {item.settlementStatus ? (
        <p className="sm:col-span-2">
          <span className="text-mq-text-muted">{t("dividendCredits.settlement")}: </span>
          <StatusBadge status={item.settlementStatus} prefix="settlementStatus" />
        </p>
      ) : null}
    </div>
  );
}
