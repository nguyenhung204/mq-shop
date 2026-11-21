"use client";

import { useState } from "react";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { AdminCaseTable, RefundSummaryView } from "@/components/refund-cases/AdminCaseViews";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { AdminCardListSkeleton } from "@/components/ui/Skeleton";
import { REFUND_CASE_STATUSES, type RefundCaseStatus } from "@/lib/api/refund-cases";
import { useAdminRefundCases, useAdminRefundSummary } from "@/lib/queries/refund-cases";
import { getErrorMessage } from "@/lib/queries/utils";
import { buildAdminQuery, EMPTY_ADMIN_FILTER, type AdminFilterState } from "@/lib/refund-cases/model";

function RefundCasesInner() {
  const { t } = useLanguage();
  const [draft, setDraft] = useState<AdminFilterState>(EMPTY_ADMIN_FILTER);
  const [applied, setApplied] = useState<AdminFilterState>(EMPTY_ADMIN_FILTER);
  const [errors, setErrors] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const built = buildAdminQuery(applied);
  const query = built.ok ? built.query : {};
  const list = useAdminRefundCases(query, page, built.ok);
  const summary = useAdminRefundSummary(query, built.ok);
  const items = list.data?.items ?? [];

  const apply = (next: AdminFilterState = draft) => {
    const res = buildAdminQuery(next);
    if (!res.ok) {
      setErrors(res.errors);
      return;
    }
    setErrors([]);
    setDraft(next);
    setApplied(next);
    setPage(1);
  };
  const toggleStatus = (s: RefundCaseStatus) =>
    setDraft((d) => ({ ...d, statuses: d.statuses.includes(s) ? d.statuses.filter((x) => x !== s) : [...d.statuses, s] }));

  return (
    <>
      <AdminPageHeader title={t("refundCases.admin.title")} description={t("refundCases.admin.description")} />
      <div className="space-y-6">
        <form
          className="mq-card p-4 space-y-3 text-sm"
          onSubmit={(e) => {
            e.preventDefault();
            apply();
          }}
          noValidate
        >
          <fieldset className="flex flex-wrap gap-3">
            <legend className="text-xs text-mq-text-muted mb-1">{t("refundCases.filter.status")}</legend>
            {REFUND_CASE_STATUSES.map((s) => (
              <label key={s} className="flex items-center gap-1">
                <input type="checkbox" checked={draft.statuses.includes(s)} onChange={() => toggleStatus(s)} />
                {t(`refundCases.status.${s}`)}
              </label>
            ))}
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-1">
              <span className="text-xs text-mq-text-muted">{t("refundCases.filter.source")}</span>
              <select className="mq-input" value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value as AdminFilterState["source"] })}>
                <option value="">{t("admin.common.all")}</option>
                <option value="CANCEL">{t("refundCases.source.CANCEL")}</option>
                <option value="RMA">{t("refundCases.source.RMA")}</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs text-mq-text-muted">{t("refundCases.filter.kind")}</span>
              <select className="mq-input" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as AdminFilterState["kind"] })}>
                <option value="">{t("admin.common.all")}</option>
                <option value="partial">{t("refundCases.kind.partial")}</option>
                <option value="full">{t("refundCases.kind.full")}</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs text-mq-text-muted">{t("refundCases.filter.shopId")}</span>
              <input className="mq-input" value={draft.shopId} autoComplete="off" onChange={(e) => setDraft({ ...draft, shopId: e.target.value })} />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-mq-text-muted">{t("refundCases.filter.orderCode")}</span>
              <input className="mq-input" value={draft.orderCode} autoComplete="off" onChange={(e) => setDraft({ ...draft, orderCode: e.target.value })} />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-mq-text-muted">{t("refundCases.filter.from")}</span>
              <input type="date" className="mq-input" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-mq-text-muted">{t("refundCases.filter.to")}</span>
              <input type="date" className="mq-input" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
            </label>
            <label className="flex items-center gap-2 self-end pb-2">
              <input type="checkbox" checked={draft.overdueOnly} onChange={(e) => setDraft({ ...draft, overdueOnly: e.target.checked })} />
              {t("refundCases.filter.overdueOnly")}
            </label>
          </div>
          {errors.length > 0 ? (
            <ul className="mq-admin-modal-error" role="alert">
              {errors.map((e) => (
                <li key={e}>{t(`refundCases.filter.errors.${e}`)}</li>
              ))}
            </ul>
          ) : null}
          <div className="flex gap-2">
            <button type="submit" className="mq-btn mq-btn-primary text-xs">
              {t("refundCases.filter.apply")}
            </button>
            <button
              type="button"
              className="mq-btn mq-btn-outline text-xs"
              onClick={() => {
                setErrors([]);
                setDraft(EMPTY_ADMIN_FILTER);
                setApplied(EMPTY_ADMIN_FILTER);
                setPage(1);
              }}
            >
              {t("refundCases.filter.reset")}
            </button>
          </div>
        </form>

        {summary.isError ? <div className="mq-alert mq-alert-error">{getErrorMessage(summary.error, t("admin.common.failed"))}</div> : null}
        {summary.data ? <RefundSummaryView summary={summary.data} /> : null}

        {list.isError ? <div className="mq-alert mq-alert-error">{getErrorMessage(list.error, t("admin.common.failed"))}</div> : null}
        {list.isLoading ? <AdminCardListSkeleton count={4} /> : null}
        {!list.isLoading && !list.isError && items.length === 0 ? (
          <p className="text-sm text-mq-text-muted">{t("refundCases.admin.empty")}</p>
        ) : null}
        {items.length > 0 ? (
          <AdminCaseTable items={items} onFilterShop={(shopId) => apply({ ...draft, shopId })} />
        ) : null}
        <PaginationBar page={page} meta={list.data?.meta} onPageChange={setPage} />
      </div>
    </>
  );
}

export default function AdminRefundCasesPage() {
  return (
    <AuthGuard roles={["CS", "ACCOUNTANT", "ADMIN", "SUPER_ADMIN"]} permissions={["VIEW_REFUND_CASES"]}>
      <RefundCasesInner />
    </AuthGuard>
  );
}
