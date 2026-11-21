"use client";

import Link from "next/link";
import { CaseEventsTimeline } from "@/components/refund-cases/CaseEventsTimeline";
import { useLanguage } from "@/components/providers/LanguageProvider";
import type { RefundCaseDetail, RefundCaseSummary, RefundCaseView } from "@/lib/api/refund-cases";
import { formatDateTimeGmt8 } from "@/lib/i18n/gmt8-calendar";
import { toIntlLocale } from "@/lib/i18n/locale-format";
import { formatCaseAmount } from "@/lib/refund-cases/model";

const COUNTERS = ["open", "awaitingBuyer", "disputed", "buyerConfirmed", "closed", "overdue", "total"] as const;
const AMOUNT_COLS = ["total", "open", "awaitingBuyer", "disputed", "overdue"] as const;

/** Counters and per-currency amounts of the current filter. */
export function RefundSummaryView({ summary }: { summary: RefundCaseSummary }) {
  const { t } = useLanguage();
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {COUNTERS.map((k) => (
          <div key={k} className={`mq-card p-3 ${k === "overdue" && summary.counts.overdue > 0 ? "border-mq-accent-orange" : ""}`}>
            <p className="text-xs text-mq-text-muted">{t(`refundCases.summary.${k}`)}</p>
            <p className="text-xl font-semibold tabular-nums">{summary.counts[k]}</p>
          </div>
        ))}
      </div>
      {summary.overdueDays == null ? (
        <p className="text-xs text-mq-text-muted">{t("refundCases.summary.overdueOff")}</p>
      ) : (
        <p className="text-xs text-mq-text-muted">{t("refundCases.summary.overdueRule", { days: String(summary.overdueDays) })}</p>
      )}
      {summary.amounts.length > 0 ? (
        <div className="mq-table-wrap">
          <table className="w-full text-sm">
            <thead className="bg-mq-surface-subtle text-left">
              <tr>
                <th className="p-2">{t("refundCases.summary.currency")}</th>
                {AMOUNT_COLS.map((k) => (
                  <th key={k} className="p-2">
                    {t(`refundCases.summary.${k}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summary.amounts.map((a) => (
                <tr key={a.currency} className="border-t border-mq-border">
                  <td className="p-2 font-medium">{a.currency}</td>
                  {AMOUNT_COLS.map((k) => (
                    <td key={k} className="p-2 tabular-nums">
                      {formatCaseAmount(a[k], "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

/** Admin list rows. Read-only: opening a case is a link; no action lives in the list. */
export function AdminCaseTable({
  items,
  onFilterShop,
}: {
  items: RefundCaseView[];
  onFilterShop?: (shopId: string) => void;
}) {
  const { t, locale } = useLanguage();
  const intl = toIntlLocale(locale);
  return (
    <div className="mq-table-wrap">
      <table className="w-full text-sm">
        <thead className="bg-mq-surface-subtle text-left">
          <tr>
            <th className="p-3">{t("refundCases.col.order")}</th>
            <th className="p-3">{t("refundCases.col.shop")}</th>
            <th className="p-3">{t("refundCases.col.buyer")}</th>
            <th className="p-3">{t("refundCases.col.status")}</th>
            <th className="p-3">{t("refundCases.col.amount")}</th>
            <th className="p-3">{t("refundCases.col.opened")}</th>
            <th className="p-3" />
          </tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <tr key={c.id} className="border-t border-mq-border align-top">
              <td className="p-3">
                <p className="font-medium">{c.orderCode ?? "—"}</p>
                <p className="text-xs text-mq-text-muted">{t(`refundCases.source.${c.source}`)}</p>
              </td>
              <td className="p-3">
                {onFilterShop ? (
                  <button type="button" className="underline text-left" onClick={() => onFilterShop(c.shop.id)}>
                    {c.shop.name ?? c.shop.id.slice(0, 8)}
                  </button>
                ) : (
                  (c.shop.name ?? c.shop.id.slice(0, 8))
                )}
              </td>
              <td className="p-3">
                <p>{c.buyer?.name ?? "—"}</p>
                <p className="text-xs text-mq-text-muted">{c.buyer?.email ?? ""}</p>
              </td>
              <td className="p-3 space-y-1">
                <span className="mq-badge mq-badge-pink">{t(`refundCases.status.${c.status}`)}</span>
                {c.overdue ? <span className="mq-badge mq-badge-orange ml-1">{t("refundCases.overdue")}</span> : null}
                {c.selfDealing ? <span className="mq-badge mq-badge-orange ml-1">{t("refundCases.selfDealing.badge")}</span> : null}
              </td>
              <td className="p-3 tabular-nums whitespace-nowrap">
                {formatCaseAmount(c.amount, c.currency)}
                <p className="text-xs text-mq-text-muted">{t(c.isPartial ? "refundCases.kind.partial" : "refundCases.kind.full")}</p>
              </td>
              <td className="p-3 text-xs text-mq-text-muted whitespace-nowrap">
                {formatDateTimeGmt8(c.createdAt, intl)}
                <p>{t("refundCases.age", { days: String(c.ageDays) })}</p>
              </td>
              <td className="p-3">
                <Link href={`/admin/refund-cases/${c.id}`} className="mq-btn mq-btn-outline text-xs">
                  {t("refundCases.open")}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Staff detail: fields, the RMA behind an RMA case, and the full event history with the real override reasons. */
export function AdminCaseDetailView({ c }: { c: RefundCaseDetail }) {
  const { t, locale } = useLanguage();
  const intl = toIntlLocale(locale);
  const when = (iso: string | null) => (iso ? formatDateTimeGmt8(iso, intl) : "—");
  return (
    <div className="space-y-4">
      <div className="mq-card p-4 grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
        <p>
          <span className="text-mq-text-muted">{t("refundCases.col.order")}: </span>
          <Link href={`/orders/${c.orderId}`} className="underline">
            {c.orderCode ?? c.orderId.slice(0, 8)}
          </Link>{" "}
          ({t(`refundCases.source.${c.source}`)})
        </p>
        <p>
          <span className="text-mq-text-muted">{t("refundCases.col.status")}: </span>
          <span className="mq-badge mq-badge-pink">{t(`refundCases.status.${c.status}`)}</span>
          {c.overdue ? <span className="mq-badge mq-badge-orange ml-1">{t("refundCases.overdue")}</span> : null}
          {c.selfDealing ? <span className="mq-badge mq-badge-orange ml-1">{t("refundCases.selfDealing.badge")}</span> : null}
        </p>
        <p>
          <span className="text-mq-text-muted">{t("refundCases.col.amount")}: </span>
          <strong className="tabular-nums">{formatCaseAmount(c.amount, c.currency)}</strong> ({t(c.isPartial ? "refundCases.kind.partial" : "refundCases.kind.full")})
          {c.display ? <span className="text-mq-text-muted"> · {formatCaseAmount(c.display.amount, c.display.currency)}</span> : null}
        </p>
        <p>
          <span className="text-mq-text-muted">{t("refundCases.col.shop")}: </span>
          {c.shop.name ?? c.shop.id}
        </p>
        <p>
          <span className="text-mq-text-muted">{t("refundCases.col.buyer")}: </span>
          {[c.buyer?.name, c.buyer?.email].filter(Boolean).join(" · ") || "—"}
        </p>
        <p>
          <span className="text-mq-text-muted">{t("refundCases.col.opened")}: </span>
          {when(c.createdAt)} · {t("refundCases.age", { days: String(c.ageDays) })}
        </p>
        <p>
          <span className="text-mq-text-muted">{t("refundCases.detail.sellerMarked")}: </span>
          {when(c.sellerMarkedAt)}
          {c.sellerReference ? ` (${c.sellerReference})` : ""}
        </p>
        <p>
          <span className="text-mq-text-muted">{t("refundCases.detail.buyerConfirmed")}: </span>
          {when(c.buyerConfirmedAt)}
        </p>
        <p>
          <span className="text-mq-text-muted">{t("refundCases.detail.disputed")}: </span>
          {when(c.disputedAt)}
        </p>
        <p>
          <span className="text-mq-text-muted">{t("refundCases.detail.closed")}: </span>
          {when(c.closedAt)}
        </p>
        {c.rma ? (
          <p className="sm:col-span-2">
            <span className="text-mq-text-muted">{t("refundCases.detail.rma")}: </span>
            <Link href={`/admin/rma/${c.rma.id}`} className="underline">
              {c.rma.status}
            </Link>
            {" · "}
            {c.rma.hasRefundProof ? t("refundCases.detail.proofYes") : t("refundCases.detail.proofNo")}
          </p>
        ) : null}
        {c.selfDealing ? <p className="sm:col-span-2 text-mq-accent-orange">{t("refundCases.selfDealing.staffNote")}</p> : null}
      </div>
      <div className="mq-card p-4">
        <h2 className="font-semibold text-sm mb-2">{t("refundCases.events.title")}</h2>
        <CaseEventsTimeline events={c.events ?? []} viewer="staff" />
      </div>
    </div>
  );
}
