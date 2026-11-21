import { ApiError } from "@/lib/api/client";
import type { ExportKind, ExportQuery } from "@/lib/api/accounting-export";
import { BUSINESS_REGION_CODES } from "@/lib/i18n/regions";
import {
  EMPTY_ADMIN_FILTER,
  buildAdminQuery,
  isUuid,
  validateDayRange,
  type AdminFilterState,
  type FilterError,
} from "@/lib/refund-cases/model";

export type ExportForm = {
  kind: ExportKind;
  from: string;
  to: string;
  /** "" = every region. */
  region: string;
  /** commission-ledger */
  ledgerType: "" | "REFERRAL" | "TEAM" | "GLOBAL";
  beneficiaryId: string;
  /** wallet-transactions */
  walletReason: string;
  userId: string;
  /** refund-cases: the same filters as the tracking list (its own date window is the form's from/to). */
  refund: AdminFilterState;
};

export const EMPTY_EXPORT_FORM: ExportForm = {
  kind: "refund-cases",
  from: "",
  to: "",
  region: "",
  ledgerType: "",
  beneficiaryId: "",
  walletReason: "",
  userId: "",
  refund: EMPTY_ADMIN_FILTER,
};

export const LEDGER_TYPES = ["REFERRAL", "TEAM", "GLOBAL"] as const;
/** Wallet reasons offered as a filter (the discontinued reward type is not offered). */
export const WALLET_REASONS = [
  "P2P",
  "WITHDRAW_FREEZE",
  "WITHDRAW_RELEASE",
  "WITHDRAW_COMPLETE",
  "REFERRAL",
  "TEAM",
  "GLOBAL",
  "ADJUST",
  "SELLER_PAYOUT",
] as const;

export type ExportFormError = FilterError | "badRegion" | "badReason" | "badBeneficiary" | "badUser";

/**
 * from and to are REQUIRED for every export (real calendar days, from <= to, at most 366 days),
 * the optional region must be one of the four business regions, ids must be UUIDs.
 */
export function buildExportQuery(
  f: ExportForm,
): { ok: true; query: ExportQuery } | { ok: false; errors: ExportFormError[] } {
  const errors: ExportFormError[] = validateDayRange(f.from, f.to, { required: true });
  const region = f.region.trim().toUpperCase();
  if (region !== "" && !(BUSINESS_REGION_CODES as readonly string[]).includes(region)) errors.push("badRegion");

  const extra: ExportQuery = {};
  if (f.kind === "commission-ledger") {
    if (f.ledgerType) extra.type = f.ledgerType;
    if (f.beneficiaryId.trim() !== "") {
      if (!isUuid(f.beneficiaryId)) errors.push("badBeneficiary");
      else extra.beneficiaryId = f.beneficiaryId.trim().toLowerCase();
    }
  } else if (f.kind === "wallet-transactions") {
    if (f.walletReason) {
      if (!(WALLET_REASONS as readonly string[]).includes(f.walletReason)) errors.push("badReason");
      else extra.reason = f.walletReason;
    }
    if (f.userId.trim() !== "") {
      if (!isUuid(f.userId)) errors.push("badUser");
      else extra.userId = f.userId.trim().toLowerCase();
    }
  } else {
    // same filter builder as the list, with this form's mandatory dates
    const built = buildAdminQuery({ ...f.refund, from: f.from, to: f.to });
    if (!built.ok) {
      for (const e of built.errors) if (!errors.includes(e)) errors.push(e);
    } else {
      for (const [k, v] of Object.entries(built.query)) if (v !== undefined) extra[k] = String(v);
    }
  }
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    query: { from: f.from.trim(), to: f.to.trim(), ...(region ? { region } : {}), ...extra },
  };
}

/** Name of the saved file; the Content-Disposition name is not readable across origins, so it is built here. */
export function exportFileName(kind: ExportKind, q: { from?: string; to?: string; region?: string }): string {
  const region = q.region ? `-${q.region}` : "";
  return `${kind}-${q.from}_${q.to}${region}.csv`;
}

// ---- downloaded file ------------------------------------------------------------------------

/** How many bytes from the end of the file are enough to find the last line. */
export const TAIL_BYTES = 4096;

export type ExportCheck = { ok: true } | { ok: false; message: string };

/**
 * A download that failed after it started ends with a `#ERROR,...` line (no TOTAL lines). The last
 * non-empty line decides: CRLF, LF, a trailing newline, a BOM and blank lines are tolerated.
 */
export function classifyExportTail(tail: string): ExportCheck {
  const lines = tail.replace(/^﻿/, "").split(/\r\n|\n|\r/);
  let last = "";
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i]!.trim() !== "") {
      last = lines[i]!.trim();
      break;
    }
  }
  if (last.startsWith("#ERROR")) return { ok: false, message: last.replace(/^#ERROR,?\s*/, "") };
  return { ok: true };
}

/** Reads the end of the blob and classifies it. An empty file is not a valid export (every export has a header). */
export async function inspectExportBlob(blob: Pick<Blob, "size" | "slice">): Promise<ExportCheck> {
  if (blob.size === 0) return { ok: false, message: "" };
  const start = Math.max(0, blob.size - TAIL_BYTES);
  const tail = await new Response(blob.slice(start)).text();
  return classifyExportTail(tail);
}

/** Translation key (and params) for a failed export request or download; never a raw code. */
export function exportErrorKey(e: unknown): { key: string; params?: Record<string, string> } {
  if (e instanceof ApiError) {
    const details = (e.body?.data as { details?: { rows?: number; max?: number } } | undefined)?.details;
    if (e.code === "EXPORT_TIMEOUT") return { key: "accountingExport.errors.timeout" };
    if (e.status === 422 && e.code === "EXPORT_TOO_MANY_ROWS") {
      return {
        key: "accountingExport.errors.tooManyRows",
        params: { rows: typeof details?.rows === "number" ? String(details.rows) : "?", max: typeof details?.max === "number" ? String(details.max) : "?" },
      };
    }
    if (e.status === 429) return { key: "accountingExport.errors.tooMany" };
    if (e.status === 503) return { key: "accountingExport.errors.unavailable" };
    if (e.status === 403) return { key: "accountingExport.errors.forbidden" };
    if (e.code === "REGION_INVALID") return { key: "toast.regionInvalid" };
    if (e.status === 400) return { key: "accountingExport.errors.badRequest" };
    return { key: "accountingExport.errors.failed" };
  }
  // the server aborts the stream after writing #ERROR: the body read rejects with a network error
  return { key: "accountingExport.errors.aborted" };
}

export type ExportRunResult = { ok: true; fileName: string } | { ok: false; error: { key: string; params?: Record<string, string> } };

/**
 * One export download, end to end: request the file, refuse it when its last line is `#ERROR`
 * (or the stream aborted), and hand the ORIGINAL blob (BOM included, so Excel reads UTF-8) to `save`
 * only when it is complete.
 */
export async function runExportDownload(
  deps: {
    download: (kind: ExportKind, query: ExportQuery) => Promise<Blob>;
    save: (blob: Blob, fileName: string) => void;
  },
  kind: ExportKind,
  query: ExportQuery,
): Promise<ExportRunResult> {
  let blob: Blob;
  try {
    blob = await deps.download(kind, query);
  } catch (e) {
    return { ok: false, error: exportErrorKey(e) };
  }
  let check: ExportCheck;
  try {
    check = await inspectExportBlob(blob);
  } catch {
    return { ok: false, error: { key: "accountingExport.errors.aborted" } };
  }
  if (!check.ok) return { ok: false, error: { key: "accountingExport.errors.incomplete", params: { reason: check.message || "-" } } };
  const fileName = exportFileName(kind, query);
  deps.save(blob, fileName);
  return { ok: true, fileName };
}
