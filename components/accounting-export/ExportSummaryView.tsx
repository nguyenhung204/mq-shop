"use client";

import { useLanguage } from "@/components/providers/LanguageProvider";
import type { ExportKind, ExportSummary } from "@/lib/api/accounting-export";
import { summaryLines } from "@/lib/accounting-export/summary";

/** Row count and totals of the export for the current filters (read from the /summary route). */
export function ExportSummaryView({ kind, summary }: { kind: ExportKind; summary: ExportSummary }) {
  const { t } = useLanguage();
  const lines = summaryLines(kind, summary);
  return (
    <div className="mq-card p-4 space-y-2 text-sm" aria-label={t("accountingExport.summary.title")}>
      <h3 className="font-semibold">{t("accountingExport.summary.title")}</h3>
      <p>
        {t("accountingExport.summary.rows")}: <strong className="tabular-nums">{lines.rowCount}</strong>
      </p>
      {lines.rows.length > 0 ? (
        <table className="w-full text-xs">
          <tbody>
            {lines.rows.map((r) => (
              <tr key={r.label} className="border-t border-mq-border">
                <td className="py-1 pr-3 text-mq-text-muted">{r.label}</td>
                <td className="py-1 tabular-nums text-right">{r.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      <p className="text-xs text-mq-text-muted">{t("accountingExport.summary.note")}</p>
    </div>
  );
}
