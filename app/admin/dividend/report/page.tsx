"use client";

import { useMemo, useState } from "react";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { currentQuarter, quarterOptions } from "@/lib/dividend/dates";
import { buildReportRows, reportState } from "@/lib/dividend/report-view";
import { formatDateTimeGmt8 } from "@/lib/i18n/gmt8-calendar";
import { toIntlLocale } from "@/lib/i18n/locale-format";
import { useDividendReport } from "@/lib/queries/dividend";
import { getErrorMessage } from "@/lib/queries/utils";

const STATE_BADGE = {
  projection: "mq-badge mq-badge-cyan",
  closed: "mq-badge mq-badge-orange",
  locked: "mq-badge mq-badge-pink",
} as const;

function ReportInner() {
  const { t, locale } = useLanguage();
  const intl = toIntlLocale(locale);
  const [now] = useState(() => new Date());
  const options = useMemo(() => quarterOptions(now, 8, 1), [now]);
  const [quarter, setQuarter] = useState(() => currentQuarter(now));
  const { data, isLoading, isError, error } = useDividendReport(quarter);
  const view = useMemo(() => (data ? buildReportRows(data, intl) : null), [data, intl]);
  const state = data ? reportState(data) : null;

  return (
    <>
      <AdminPageHeader title={t("admin.dividend.report.title")} description={t("admin.dividend.report.description")} />
      <div className="space-y-6">
        <div className="mq-alert mq-alert-warn text-sm" role="note">
          {t("admin.dividend.report.previewNotice")}
        </div>
        {isError && <div className="mq-alert mq-alert-error">{getErrorMessage(error, t("admin.common.failed"))}</div>}

        <div className="flex flex-wrap items-end gap-4">
          <label className="text-sm">
            <span className="block text-xs text-mq-text-muted mb-1">{t("admin.dividend.quarter")}</span>
            <select className="mq-input" value={quarter} onChange={(e) => setQuarter(e.target.value)}>
              {options.map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
          </label>
          {data && state ? (
            <div className="flex flex-wrap items-center gap-3 text-xs text-mq-text-muted">
              <span className={STATE_BADGE[state]}>{t(`admin.dividend.report.state.${state}`)}</span>
              <span>
                {t("admin.dividend.report.range", { from: data.range.firstDay, to: data.range.lastDay })}
              </span>
              <span>
                {data.locked
                  ? t("admin.dividend.slots.lockedAt", { date: formatDateTimeGmt8(data.lockAt, intl) })
                  : t("admin.dividend.slots.locksAt", { date: formatDateTimeGmt8(data.lockAt, intl) })}
              </span>
            </div>
          ) : null}
        </div>

        {isLoading || !data || !view ? (
          isLoading ? <TableSkeleton rows={5} cols={5} /> : null
        ) : (
          <>
            {state === "projection" ? (
              <p className="text-sm text-mq-text-secondary">{t("admin.dividend.report.projectionNote")}</p>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-mq-border bg-mq-surface p-3">
                <p className="text-xs text-mq-text-muted">{t("admin.dividend.report.salesBase")}</p>
                <p className="text-lg font-semibold tabular-nums">{view.totals.salesBase}</p>
                <p className="text-[11px] text-mq-text-muted">{t("admin.dividend.report.orders", { count: String(view.totals.orderCount) })}</p>
              </div>
              <div className="rounded-lg border border-mq-border bg-mq-surface p-3">
                <p className="text-xs text-mq-text-muted">{t("admin.dividend.report.pool")}</p>
                <p className="text-lg font-semibold tabular-nums">{view.totals.pool}</p>
              </div>
              <div className="rounded-lg border border-mq-border bg-mq-surface p-3">
                <p className="text-xs text-mq-text-muted">{t("admin.dividend.report.totalSlots")}</p>
                <p className="text-lg font-semibold tabular-nums">{view.totals.totalSlots}</p>
              </div>
              <div className="rounded-lg border border-mq-border bg-mq-surface p-3">
                <p className="text-xs text-mq-text-muted">{t("admin.dividend.report.distributed")}</p>
                <p className="text-lg font-semibold tabular-nums">{view.totals.distributed}</p>
              </div>
            </div>

            <section className="space-y-2">
              <h2 className="text-sm font-semibold">{t("admin.dividend.report.byInterval")}</h2>
              {view.intervals.length === 0 ? (
                <p className="text-sm text-mq-text-muted">{t("admin.dividend.report.noIntervals")}</p>
              ) : (
                <div className="mq-table-wrap">
                  <table className="w-full text-sm">
                    <thead className="bg-mq-surface-subtle text-left">
                      <tr>
                        <th className="p-3">{t("admin.dividend.report.period")}</th>
                        <th className="p-3">{t("admin.dividend.rates.colRate")}</th>
                        <th className="p-3">{t("admin.dividend.report.ordersCol")}</th>
                        <th className="p-3">{t("admin.dividend.report.salesBase")}</th>
                        <th className="p-3">{t("admin.dividend.report.pool")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {view.intervals.map((iv) => (
                        <tr key={iv.key} className="border-t border-mq-border">
                          <td className="p-3 whitespace-nowrap">{iv.period}</td>
                          <td className="p-3 tabular-nums">
                            {iv.ratePercent}
                            {iv.isDefaultRate ? (
                              <span className="mq-badge mq-badge-muted ml-1">{t("admin.dividend.report.defaultRate")}</span>
                            ) : null}
                          </td>
                          <td className="p-3 tabular-nums">{iv.orderCount}</td>
                          <td className="p-3 tabular-nums">{iv.salesBase}</td>
                          <td className="p-3 tabular-nums">{iv.pool}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-semibold">{t("admin.dividend.report.byAccount")}</h2>
              {view.accounts.length === 0 ? (
                <p className="text-sm text-mq-text-muted">{t("admin.dividend.report.noAccounts")}</p>
              ) : (
                <div className="mq-table-wrap">
                  <table className="w-full text-sm">
                    <thead className="bg-mq-surface-subtle text-left">
                      <tr>
                        <th className="p-3">{t("admin.dividend.slots.account")}</th>
                        <th className="p-3">{t("admin.dividend.slots.colSlots")}</th>
                        <th className="p-3">{t("admin.dividend.report.share")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {view.accounts.map((a) => (
                        <tr key={a.userId} className="border-t border-mq-border">
                          <td className="p-3">{a.label}</td>
                          <td className="p-3 tabular-nums">{a.slots}</td>
                          <td className="p-3 tabular-nums">{a.share}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-mq-border bg-mq-surface-subtle" data-row="remainder">
                        <td className="p-3 font-medium" colSpan={2}>
                          {t("admin.dividend.report.remainderLabel")}
                        </td>
                        <td className="p-3 tabular-nums font-medium">{view.remainder.amount}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
              {view.accounts.length === 0 ? (
                <p className="text-sm">
                  <span className="font-medium">{t("admin.dividend.report.remainderLabel")}:</span>{" "}
                  <span className="tabular-nums">{view.remainder.amount}</span>
                </p>
              ) : null}
              <p className="text-xs text-mq-text-muted">{t("admin.dividend.report.remainderHint")}</p>
            </section>

            <section className="space-y-1 text-sm text-mq-text-secondary">
              {view.pendingRefundOrders > 0 ? (
                <p>{t("admin.dividend.report.pendingRefunds", { count: String(view.pendingRefundOrders) })}</p>
              ) : null}
              {view.refundsAfterLock ? (
                <p className="rounded-lg border border-mq-border bg-mq-surface-subtle p-3" data-row="refunds-after-lock">
                  {t("admin.dividend.report.refundsAfterLock", {
                    amount: view.refundsAfterLock.amount,
                    count: String(view.refundsAfterLock.orderCount),
                  })}
                </p>
              ) : null}
            </section>
          </>
        )}
      </div>
    </>
  );
}

export default function AdminDividendReportPage() {
  return (
    <AuthGuard roles={["SUPER_ADMIN", "ADMIN", "ACCOUNTANT"]} permissions={["VIEW_MLM_COMSN"]}>
      <ReportInner />
    </AuthGuard>
  );
}
