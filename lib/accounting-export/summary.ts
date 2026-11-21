import type { ExportKind, ExportSummary } from "@/lib/api/accounting-export";

/** The API sends decimal strings (cents already placed, points as integers or decimals): shown exactly as sent, never re-rounded. */
function amount(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return v == null ? "—" : String(v);
}

/** Flat label/value lines of a summary. Labels are plain identifiers from the API (currency, movement, reason). */
export function summaryLines(kind: ExportKind, s: ExportSummary): { rowCount: number; rows: Array<{ label: string; value: string }> } {
  const rows: Array<{ label: string; value: string }> = [];
  if (kind === "refund-cases") {
    for (const a of s.amounts ?? []) rows.push({ label: `${a.currency}${a.cases != null ? ` (${a.cases})` : ""}`, value: amount(a.total) });
    return { rowCount: s.rowCount ?? s.caseCount ?? 0, rows };
  }
  if (kind === "commission-ledger") {
    for (const [movement, m] of Object.entries(s.byMovement ?? {})) {
      rows.push({ label: `${movement} (${m.rows})`, value: `${amount(m.walletTwd)} TWD / ${amount(m.walletPoints)} PTS` });
    }
    for (const [k, v] of Object.entries(s.walletNet ?? {})) rows.push({ label: `net ${k}`, value: amount(v) });
    return { rowCount: s.rowCount ?? 0, rows };
  }
  for (const g of s.groups ?? []) rows.push({ label: `${g.direction} ${g.reason} (${g.rows})`, value: amount(g.amount) });
  if (s.in != null) rows.push({ label: "in", value: amount(s.in) });
  if (s.out != null) rows.push({ label: "out", value: amount(s.out) });
  if (s.net != null) rows.push({ label: "net", value: `${amount(s.net)}${s.unit ? ` ${s.unit}` : ""}` });
  return { rowCount: s.rowCount ?? 0, rows };
}
