import { api } from "./client";

export type ExportKind = "refund-cases" | "commission-ledger" | "wallet-transactions" | "dividend-settlements";

export const EXPORT_KINDS: ExportKind[] = ["refund-cases", "commission-ledger", "wallet-transactions", "dividend-settlements"];

export type ExportQuery = Record<string, string | undefined>;

export type ExportFilters = Record<string, unknown>;

/** Summary of an export (same filters, same snapshot rules). Only the fields the screen shows are typed. */
export type ExportSummary = {
  filters?: ExportFilters;
  rowCount?: number;
  /** refund cases */
  caseCount?: number;
  amounts?: Array<{ currency: string; cases?: number; total: string }>;
  /** commission ledger */
  byMovement?: Record<string, { rows: number; grossTwd?: string; walletTwd?: string; walletPoints?: string; heldTwd?: string }>;
  walletNet?: Record<string, unknown>;
  dateAxis?: string;
  /** wallet transactions */
  groups?: Array<{
    direction?: string;
    reason?: string;
    /** dividend settlements */
    status?: string;
    rows: number;
    amount?: string;
    amountTwd?: string;
    points?: string;
  }>;
  net?: string;
  in?: string;
  out?: string;
  unit?: string;
  /** dividend settlements */
  itemsTotalTwd?: string;
  settlements?: number;
  poolTwd?: string;
  remainderTwd?: string;
};

const base = "/admin/accounting-export";

/** ACCOUNTANT, ADMIN, SUPER_ADMIN (EXPORT_ACCOUNTING). The CSV is a binary download, not a JSON envelope. */
export const accountingExportApi = {
  download: (kind: ExportKind, query: ExportQuery) => api.getBlob(`${base}/${kind}`, { query }),
  summary: (kind: ExportKind, query: ExportQuery) => api.get<ExportSummary>(`${base}/${kind}/summary`, { query }),
};
