"use client";

import Link from "next/link";
import { useState } from "react";
import { CaseEventsTimeline } from "@/components/refund-cases/CaseEventsTimeline";
import { useLanguage } from "@/components/providers/LanguageProvider";
import type { RefundCaseAction, RefundCaseDetail, RefundCaseView } from "@/lib/api/refund-cases";
import { formatDateTimeGmt8 } from "@/lib/i18n/gmt8-calendar";
import { toIntlLocale } from "@/lib/i18n/locale-format";
import { canDo, formatCaseAmount, partyEvents } from "@/lib/refund-cases/model";

export type PartyAction = Exclude<RefundCaseAction, "OVERRIDE">;

type Props = {
  c: RefundCaseView;
  side: "buyer" | "seller";
  busy?: boolean;
  /** Detail (events) loader state; the card asks for it on expand. */
  detail: { data?: RefundCaseDetail; isLoading: boolean; isError: boolean };
  onExpand: (open: boolean) => void;
  onAction: (action: PartyAction) => void;
};

const ACTIONS: PartyAction[] = ["MARK_PAID", "CONFIRM", "DISPUTE"];

/**
 * One refund case for the buyer or the seller. Buttons come only from `actions` (what the API says this
 * viewer may do now), never from roles; the case can therefore show no button at all.
 */
export function CaseCard({ c, side, busy = false, detail, onExpand, onAction }: Props) {
  const { t, locale } = useLanguage();
  const intl = toIntlLocale(locale);
  const [open, setOpen] = useState(false);
  const toggle = () => {
    setOpen(!open);
    onExpand(!open);
  };
  const other = side === "buyer" ? c.shop.name : c.buyer?.name || c.buyer?.email;
  return (
    <div className="mq-card p-4 space-y-2 text-sm">
      <div className="flex flex-wrap justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/orders/${c.orderId}`} className="font-medium hover:underline">
              {c.orderCode ?? t("orders.detail.title")}
            </Link>
            <span className="mq-badge mq-badge-pink">{t(`refundCases.status.${c.status}`)}</span>
            <span className="mq-badge mq-badge-muted">{t(c.isPartial ? "refundCases.kind.partial" : "refundCases.kind.full")}</span>
            <span className="mq-badge mq-badge-muted">{t(`refundCases.source.${c.source}`)}</span>
            {c.overdue ? <span className="mq-badge mq-badge-orange">{t("refundCases.overdue")}</span> : null}
            {c.selfDealing ? <span className="mq-badge mq-badge-orange">{t("refundCases.selfDealing.badge")}</span> : null}
          </div>
          <p className="font-semibold tabular-nums">
            {formatCaseAmount(c.amount, c.currency)}
            {c.display ? (
              <span className="text-xs font-normal text-mq-text-muted ml-2">
                ({formatCaseAmount(c.display.amount, c.display.currency)})
              </span>
            ) : null}
          </p>
          <p className="text-xs text-mq-text-muted">
            {side === "buyer" ? t("refundCases.shopLabel") : t("refundCases.buyerLabel")}: {other || "—"} · {t("refundCases.opened", { date: formatDateTimeGmt8(c.createdAt, intl) })} ·{" "}
            {t("refundCases.age", { days: String(c.ageDays) })}
          </p>
          {c.sellerReference ? (
            <p className="text-xs text-mq-text-muted">
              {t("refundCases.reference")}: {c.sellerReference}
            </p>
          ) : null}
          {c.selfDealing ? <p className="text-xs text-mq-accent-orange">{t("refundCases.selfDealing.note")}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2 items-start">
          {ACTIONS.filter((a) => canDo(c, a)).map((a) => (
            <button
              key={a}
              type="button"
              className={`mq-btn text-xs ${a === "DISPUTE" ? "mq-btn-outline" : "mq-btn-primary"}`}
              disabled={busy}
              onClick={() => onAction(a)}
            >
              {t(`refundCases.action.${a}`)}
            </button>
          ))}
          <button type="button" className="mq-btn mq-btn-outline text-xs" aria-expanded={open} onClick={toggle}>
            {open ? t("refundCases.hideHistory") : t("refundCases.showHistory")}
          </button>
        </div>
      </div>
      {open ? (
        <div>
          {detail.isLoading ? (
            <p className="text-xs text-mq-text-muted">{t("admin.common.loading")}</p>
          ) : detail.isError || !detail.data ? (
            <p className="text-xs text-mq-text-muted">{t("admin.common.failed")}</p>
          ) : (
            <CaseEventsTimeline events={partyEvents(detail.data.events ?? [])} viewer="party" />
          )}
        </div>
      ) : null}
    </div>
  );
}
