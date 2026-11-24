"use client";

import { useState } from "react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { buildMyEstimateView } from "@/lib/dividend/my-estimate-view";
import { currentQuarter, quarterOptions } from "@/lib/dividend/dates";
import { toIntlLocale } from "@/lib/i18n/locale-format";
import { useMyDividendEstimate } from "@/lib/queries/dividend-settlements";
import { getErrorMessage } from "@/lib/queries/utils";

/** "My slots and expected dividend": only MY figures; an estimate until the quarter is locked and settled. */
export function MyEstimateCard() {
  const { t, locale } = useLanguage();
  const [quarter, setQuarter] = useState(() => currentQuarter());
  const q = useMyDividendEstimate(quarter);
  const view = q.data ? buildMyEstimateView(q.data, toIntlLocale(locale)) : null;
  return (
    <section className="rounded-xl border border-mq-border bg-mq-surface p-4 space-y-3" data-row="my-estimate">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{t("dividendCredits.estimate.title")}</h2>
        <label className="text-sm flex items-center gap-2">
          <span className="text-mq-text-muted">{t("dividendCredits.estimate.quarter")}</span>
          <select className="mq-input" value={quarter} onChange={(e) => setQuarter(e.target.value)}>
            {quarterOptions(new Date(), 3, 0).map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </label>
      </div>
      {q.isError ? <div className="mq-alert mq-alert-error">{getErrorMessage(q.error, t("admin.common.failed"))}</div> : null}
      {view ? (
        <>
          {view.slots === 0 && !view.expiredEarly ? (
            <p className="text-sm text-mq-text-muted" data-row="no-slots">{t("dividendCredits.estimate.noSlots")}</p>
          ) : (
            <dl className="grid gap-3 sm:grid-cols-3 text-sm">
              <div>
                <dt className="text-mq-text-muted">{t("dividendCredits.estimate.slots")}</dt>
                <dd className="text-lg font-semibold tabular-nums" data-row="slots">{view.slots}</dd>
                {view.expiry ? <dd className="text-xs text-mq-text-muted">{t("dividendCredits.estimate.expires", { date: view.expiry })}</dd> : null}
              </div>
              <div>
                <dt className="text-mq-text-muted">{t(view.state === "estimate" ? "dividendCredits.estimate.now" : "dividendCredits.estimate.final")}</dt>
                <dd className="text-lg font-semibold tabular-nums" data-row="now">{view.now}</dd>
              </div>
              {view.withProvisional !== null ? (
                <div>
                  <dt className="text-mq-text-muted">{t("dividendCredits.estimate.withProvisional")}</dt>
                  <dd className="text-lg font-semibold tabular-nums" data-row="with-provisional">{view.withProvisional}</dd>
                </div>
              ) : null}
            </dl>
          )}
          {view.expiredEarly ? <p className="text-sm" data-row="expired-early">{t("dividendCredits.estimate.expiredEarly")}</p> : null}
          {view.credited ? (
            <p className="text-sm" data-row="credited">
              {t(view.credited.done ? "dividendCredits.estimate.credited" : "dividendCredits.estimate.creditPending", { amount: view.credited.amount, points: view.credited.points })}
            </p>
          ) : null}
          <p className="text-xs text-mq-text-muted">{t(view.state === "estimate" ? "dividendCredits.estimate.estimateNote" : "dividendCredits.estimate.finalNote")}</p>
        </>
      ) : q.isLoading ? (
        <p className="text-sm text-mq-text-muted">…</p>
      ) : null}
    </section>
  );
}
