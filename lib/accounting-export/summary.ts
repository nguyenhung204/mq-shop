import type { ExportKind, ExportSummary } from "@/lib/api/accounting-export";
import { parseDecimalToCents } from "@/lib/money";

type T = (key: string, vars?: Record<string, string>) => string;

/** The API sends decimal strings (cents already placed, points as integers or decimals): shown exactly as sent, never re-rounded. */
function amount(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return v == null ? "—" : String(v);
}

/** True when a decimal string from the API is strictly positive. */
function positive(v: unknown): boolean {
  if (typeof v !== "string") return false;
  const c = parseDecimalToCents(v);
  return c !== null && c > 0;
}

const MOVEMENTS = ["CREDIT", "REVERSAL", "PENDING", "VOID"];

function movementLabel(t: T, m: string): string {
  return MOVEMENTS.includes(m) ? t(`accountingExport.summary.movement.${m}`) : m;
}

/**
 * Flat label/value lines of a summary, with every word translated (currency codes stay ISO codes, the
 * points unit uses the app's own unit label). PENDING rows move nothing in the wallet, so their line
 * also says how much is held, so that a pending row never reads as zero.
 */
export function summaryLines(kind: ExportKind, s: ExportSummary, t: T): { rowCount: number; rows: Array<{ label: string; value: string }> } {
  const rows: Array<{ label: string; value: string }> = [];
  const pts = t("common.pointUnit");
  if (kind === "refund-cases") {
    for (const a of s.amounts ?? []) rows.push({ label: `${a.currency}${a.cases != null ? ` (${a.cases})` : ""}`, value: amount(a.total) });
    return { rowCount: s.rowCount ?? s.caseCount ?? 0, rows };
  }
  if (kind === "commission-ledger") {
    for (const [movement, m] of Object.entries(s.byMovement ?? {})) {
      const held = positive(m.heldTwd) ? ` · ${t("accountingExport.summary.held", { amount: `${amount(m.heldTwd)} TWD` })}` : "";
      rows.push({
        label: `${movementLabel(t, movement)} (${m.rows})`,
        value: `${amount(m.walletTwd)} TWD / ${amount(m.walletPoints)} ${pts}${held}`,
      });
    }
    for (const [k, v] of Object.entries(s.walletNet ?? {})) {
      const label = k === "twd" || k === "points" ? t(`accountingExport.summary.net.${k}`) : k;
      rows.push({ label, value: amount(v) });
    }
    return { rowCount: s.rowCount ?? 0, rows };
  }
  if (kind === "dividend-settlements") {
    for (const g of s.groups ?? []) {
      const key = `dividendSettlements.itemStatus.${g.status}`;
      const label = t(key) === key ? String(g.status) : t(key);
      rows.push({ label: `${label} (${g.rows})`, value: `${amount(g.amountTwd)} TWD / ${amount(g.points)} ${pts}` });
    }
    if (s.poolTwd != null) rows.push({ label: t("accountingExport.summary.pool"), value: `${amount(s.poolTwd)} TWD` });
    if (s.remainderTwd != null) rows.push({ label: t("accountingExport.summary.remainder"), value: `${amount(s.remainderTwd)} TWD` });
    if (s.itemsTotalTwd != null) rows.push({ label: t("accountingExport.summary.itemsTotal"), value: `${amount(s.itemsTotalTwd)} TWD` });
    if (s.settlements != null) rows.push({ label: t("accountingExport.summary.settlements"), value: String(s.settlements) });
    return { rowCount: s.rowCount ?? 0, rows };
  }
  for (const g of s.groups ?? []) {
    const dir = g.direction === "IN" || g.direction === "OUT" ? t(`accountingExport.summary.direction.${g.direction}`) : (g.direction ?? "");
    const reasonKey = `wallet.reasons.${g.reason}`;
    const reason = t(reasonKey) === reasonKey ? (g.reason ?? "") : t(reasonKey);
    rows.push({ label: `${dir} ${reason} (${g.rows})`, value: amount(g.amount) });
  }
  if (s.in != null) rows.push({ label: t("accountingExport.summary.in"), value: amount(s.in) });
  if (s.out != null) rows.push({ label: t("accountingExport.summary.out"), value: amount(s.out) });
  if (s.net != null) rows.push({ label: t("accountingExport.summary.netLabel"), value: `${amount(s.net)}${s.unit ? ` ${s.unit === "PTS" ? pts : s.unit}` : ""}` });
  return { rowCount: s.rowCount ?? 0, rows };
}
