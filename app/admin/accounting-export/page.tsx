"use client";

import { useState } from "react";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { ExportSummaryView } from "@/components/accounting-export/ExportSummaryView";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { EXPORT_KINDS, type ExportKind } from "@/lib/api/accounting-export";
import { REFUND_CASE_STATUSES, type RefundCaseStatus } from "@/lib/api/refund-cases";
import { BUSINESS_REGION_CODES } from "@/lib/i18n/regions";
import {
  EMPTY_EXPORT_FORM,
  LEDGER_TYPES,
  WALLET_REASONS,
  buildExportQuery,
  type ExportForm,
  type ExportFormError,
} from "@/lib/accounting-export/model";
import { useExportDownload, useExportSummary } from "@/lib/queries/accounting-export";
import { getErrorMessage } from "@/lib/queries/utils";
import { exportErrorKey } from "@/lib/accounting-export/model";

function ExportInner() {
  const { t } = useLanguage();
  const [form, setForm] = useState<ExportForm>(EMPTY_EXPORT_FORM);
  const [errors, setErrors] = useState<ExportFormError[]>([]);
  const summary = useExportSummary();
  const download = useExportDownload();
  const busy = summary.isPending || download.isPending;
  const set = (patch: Partial<ExportForm>) => setForm((f) => ({ ...f, ...patch }));
  const setRefund = (patch: Partial<ExportForm["refund"]>) => setForm((f) => ({ ...f, refund: { ...f.refund, ...patch } }));
  const toggleStatus = (s: RefundCaseStatus) =>
    setRefund({ statuses: form.refund.statuses.includes(s) ? form.refund.statuses.filter((x) => x !== s) : [...form.refund.statuses, s] });

  const run = (what: "summary" | "download") => {
    const built = buildExportQuery(form);
    if (!built.ok) {
      setErrors(built.errors);
      return;
    }
    setErrors([]);
    summary.reset();
    download.reset();
    const vars = { kind: form.kind, query: built.query };
    if (what === "summary") summary.mutate(vars);
    else download.mutate(vars);
  };

  const downloadError = download.data && !download.data.ok ? download.data.error : null;
  const summaryError = summary.isError ? exportErrorKey(summary.error) : null;
  const render = (e: { key: string; params?: Record<string, string> }) => t(e.key, e.params);

  return (
    <>
      <AdminPageHeader title={t("accountingExport.title")} description={t("accountingExport.description")} />
      <div className="space-y-6 max-w-3xl">
        <form
          className="mq-card p-4 space-y-4 text-sm"
          onSubmit={(e) => {
            e.preventDefault();
            run("download");
          }}
          noValidate
        >
          <label className="block space-y-1">
            <span className="text-xs text-mq-text-muted">{t("accountingExport.kind")}</span>
            <select className="mq-input" value={form.kind} disabled={busy} onChange={(e) => {
                set({ kind: e.target.value as ExportKind });
                summary.reset();
                download.reset();
                setErrors([]);
              }}
            >
              {EXPORT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {t(`accountingExport.kinds.${k}`)}
                </option>
              ))}
            </select>
          </label>
          {form.kind === "dividend-settlements" ? (
            <label className="block space-y-1 max-w-xs">
              <span className="text-xs text-mq-text-muted">{t("accountingExport.quarter")}</span>
              <input className="mq-input" value={form.quarter} placeholder="2026Q3" autoComplete="off" disabled={busy} onChange={(e) => set({ quarter: e.target.value })} />
              <span className="text-xs text-mq-text-muted">{t("accountingExport.quarterHint")}</span>
            </label>
          ) : (
            <>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1">
              <span className="text-xs text-mq-text-muted">{t("accountingExport.from")}</span>
              <input type="date" className="mq-input" value={form.from} disabled={busy} onChange={(e) => set({ from: e.target.value })} />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-mq-text-muted">{t("accountingExport.to")}</span>
              <input type="date" className="mq-input" value={form.to} disabled={busy} onChange={(e) => set({ to: e.target.value })} />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-mq-text-muted">{t("accountingExport.region")}</span>
              <select className="mq-input" value={form.region} disabled={busy} onChange={(e) => set({ region: e.target.value })}>
                <option value="">{t("accountingExport.allRegions")}</option>
                {BUSINESS_REGION_CODES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-xs text-mq-text-muted">{t("accountingExport.rangeHint")}</p>

            </>
          )}
          {form.kind === "commission-ledger" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs text-mq-text-muted">{t("accountingExport.ledgerType")}</span>
                <select className="mq-input" value={form.ledgerType} disabled={busy} onChange={(e) => set({ ledgerType: e.target.value as ExportForm["ledgerType"] })}>
                  <option value="">{t("admin.common.all")}</option>
                  {LEDGER_TYPES.map((x) => (
                    <option key={x} value={x}>
                      {t(`wallet.reasons.${x}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs text-mq-text-muted">{t("accountingExport.beneficiaryId")}</span>
                <input className="mq-input" value={form.beneficiaryId} autoComplete="off" disabled={busy} onChange={(e) => set({ beneficiaryId: e.target.value })} />
              </label>
            </div>
          ) : null}
          {form.kind === "wallet-transactions" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs text-mq-text-muted">{t("accountingExport.walletReason")}</span>
                <select className="mq-input" value={form.walletReason} disabled={busy} onChange={(e) => set({ walletReason: e.target.value })}>
                  <option value="">{t("admin.common.all")}</option>
                  {WALLET_REASONS.map((x) => (
                    <option key={x} value={x}>
                      {t(`wallet.reasons.${x}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs text-mq-text-muted">{t("accountingExport.userId")}</span>
                <input className="mq-input" value={form.userId} autoComplete="off" disabled={busy} onChange={(e) => set({ userId: e.target.value })} />
              </label>
            </div>
          ) : null}
          {form.kind === "refund-cases" ? (
            <div className="space-y-3">
              <fieldset className="flex flex-wrap gap-3">
                <legend className="text-xs text-mq-text-muted mb-1">{t("refundCases.filter.status")}</legend>
                {REFUND_CASE_STATUSES.map((s) => (
                  <label key={s} className="flex items-center gap-1">
                    <input type="checkbox" checked={form.refund.statuses.includes(s)} disabled={busy} onChange={() => toggleStatus(s)} />
                    {t(`refundCases.status.${s}`)}
                  </label>
                ))}
              </fieldset>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="space-y-1">
                  <span className="text-xs text-mq-text-muted">{t("refundCases.filter.source")}</span>
                  <select className="mq-input" value={form.refund.source} disabled={busy} onChange={(e) => setRefund({ source: e.target.value as ExportForm["refund"]["source"] })}>
                    <option value="">{t("admin.common.all")}</option>
                    <option value="CANCEL">{t("refundCases.source.CANCEL")}</option>
                    <option value="RMA">{t("refundCases.source.RMA")}</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-mq-text-muted">{t("refundCases.filter.shopId")}</span>
                  <input className="mq-input" value={form.refund.shopId} autoComplete="off" disabled={busy} onChange={(e) => setRefund({ shopId: e.target.value })} />
                </label>
                <label className="flex items-center gap-2 self-end pb-2">
                  <input type="checkbox" checked={form.refund.overdueOnly} disabled={busy} onChange={(e) => setRefund({ overdueOnly: e.target.checked })} />
                  {t("refundCases.filter.overdueOnly")}
                </label>
              </div>
            </div>
          ) : null}

          {errors.length > 0 ? (
            <ul className="mq-admin-modal-error" role="alert">
              {errors.map((e) => (
                <li key={e}>{t(`accountingExport.formErrors.${e}`)}</li>
              ))}
            </ul>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button type="submit" className="mq-btn mq-btn-primary text-xs" disabled={busy}>
              {download.isPending ? t("accountingExport.downloading") : t("accountingExport.download")}
            </button>
            <button type="button" className="mq-btn mq-btn-outline text-xs" disabled={busy} onClick={() => run("summary")}>
              {summary.isPending ? t("admin.common.working") : t("accountingExport.preview")}
            </button>
          </div>
          <p className="text-xs text-mq-text-muted">{t("accountingExport.concurrencyHint")}</p>
        </form>

        {downloadError ? <div className="mq-alert mq-alert-error">{render(downloadError)}</div> : null}
        {download.isError ? <div className="mq-alert mq-alert-error">{getErrorMessage(download.error, t("admin.common.failed"))}</div> : null}
        {download.data?.ok ? <div className="mq-alert mq-alert-success">{t("accountingExport.downloaded", { file: download.data.fileName })}</div> : null}
        {summaryError ? <div className="mq-alert mq-alert-error">{render(summaryError)}</div> : null}
        {summary.data ? <ExportSummaryView kind={form.kind} summary={summary.data} /> : null}
      </div>
    </>
  );
}

export default function AccountingExportPage() {
  return (
    <AuthGuard roles={["ACCOUNTANT", "ADMIN", "SUPER_ADMIN"]} permissions={["EXPORT_ACCOUNTING"]}>
      <ExportInner />
    </AuthGuard>
  );
}
