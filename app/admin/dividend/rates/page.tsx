"use client";

import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { DividendRateForm } from "@/components/admin/dividend/DividendRateForm";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { TableSkeleton } from "@/components/ui/Skeleton";
import type { DividendRateStatus } from "@/lib/api/dividend";
import { canWriteDividend } from "@/lib/auth/admin-write";
import { formatDateTimeGmt8 } from "@/lib/i18n/gmt8-calendar";
import { toIntlLocale } from "@/lib/i18n/locale-format";
import { bpsToPercentString } from "@/lib/money";
import { useCreateDividendRate, useDividendRates } from "@/lib/queries/dividend";
import { getErrorMessage } from "@/lib/queries/utils";

const STATUS_BADGE: Record<DividendRateStatus, string> = {
  effective: "mq-badge mq-badge-teal",
  upcoming: "mq-badge mq-badge-cyan",
  superseded: "mq-badge mq-badge-muted",
};

function RatesInner() {
  const { t, locale } = useLanguage();
  const { user } = useAuth();
  const canWrite = canWriteDividend(user);
  const { data, isLoading, isError, error } = useDividendRates();
  const create = useCreateDividendRate();
  const intl = toIntlLocale(locale);
  const items = data?.items ?? [];

  return (
    <>
      <AdminPageHeader title={t("admin.dividend.rates.title")} description={t("admin.dividend.rates.description")} />
      <div className="space-y-6">
        {isError && (
          <div className="mq-alert mq-alert-error">{getErrorMessage(error, t("admin.common.failed"))}</div>
        )}
        {!canWrite ? (
          <div className="rounded-lg border border-mq-border bg-mq-surface-subtle p-3 text-sm text-mq-text-secondary">
            {t("admin.dividend.readOnlyNote")}
          </div>
        ) : null}

        {data ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-mq-border bg-mq-surface p-4">
              <p className="text-xs text-mq-text-muted">{t("admin.dividend.rates.current")}</p>
              <p className="text-2xl font-semibold tabular-nums">{bpsToPercentString(data.current.rateBps)}%</p>
              <p className="text-[11px] text-mq-text-muted mt-1">{t("admin.dividend.rates.today", { date: data.today })}</p>
            </div>
            <div className="rounded-lg border border-mq-border bg-mq-surface p-4">
              <p className="text-xs text-mq-text-muted">{t("admin.dividend.rates.default")}</p>
              <p className="text-2xl font-semibold tabular-nums">{bpsToPercentString(data.default.rateBps)}%</p>
            </div>
          </div>
        ) : null}

        {canWrite ? (
          <DividendRateForm
            busy={create.isPending}
            today={data?.today}
            onSubmit={async (body) => {
              try {
                await create.mutateAsync(body);
              } catch {
                /* toast shown by the hook */
              }
            }}
          />
        ) : null}

        <h2 className="text-sm font-semibold">{t("admin.dividend.rates.history")}</h2>
        {isLoading ? (
          <TableSkeleton rows={4} cols={5} />
        ) : items.length === 0 ? (
          <p className="text-sm text-mq-text-muted">{t("admin.dividend.rates.empty")}</p>
        ) : (
          <div className="mq-table-wrap">
            <table className="w-full text-sm">
              <thead className="bg-mq-surface-subtle text-left">
                <tr>
                  <th className="p-3">{t("admin.dividend.rates.colRate")}</th>
                  <th className="p-3">{t("admin.dividend.rates.colEffective")}</th>
                  <th className="p-3">{t("admin.dividend.rates.colStatus")}</th>
                  <th className="p-3">{t("admin.dividend.rates.colReason")}</th>
                  <th className="p-3">{t("admin.dividend.rates.colCreated")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id} className="border-t border-mq-border align-top">
                    <td className="p-3 font-semibold tabular-nums">{bpsToPercentString(r.rateBps)}%</td>
                    <td className="p-3 whitespace-nowrap">{r.effectiveDate}</td>
                    <td className="p-3 whitespace-nowrap">
                      <span className={STATUS_BADGE[r.status] ?? "mq-badge mq-badge-muted"}>
                        {t(`admin.dividend.rates.status.${r.status}`)}
                      </span>
                      {r.current ? (
                        <span className="mq-badge mq-badge-teal ml-1">{t("admin.dividend.rates.currentBadge")}</span>
                      ) : null}
                    </td>
                    <td className="p-3 max-w-md">{r.reason}</td>
                    <td className="p-3 text-xs text-mq-text-muted whitespace-nowrap">
                      {formatDateTimeGmt8(r.createdAt, intl)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

export default function AdminDividendRatesPage() {
  return (
    <AuthGuard roles={["SUPER_ADMIN", "ADMIN", "ACCOUNTANT"]} permissions={["VIEW_MLM_COMSN"]}>
      <RatesInner />
    </AuthGuard>
  );
}
