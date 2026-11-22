import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { EMPTY_ADMIN_FILTER } from "@/lib/refund-cases/model";
import {
  EMPTY_EXPORT_FORM,
  LEDGER_TYPES,
  TAIL_BYTES,
  WALLET_REASONS,
  buildExportQuery,
  classifyExportTail,
  exportErrorKey,
  exportFileName,
  inspectExportBlob,
  runExportDownload,
  type ExportForm,
} from "./model";
import { summaryLines } from "./summary";

const form = (over: Partial<ExportForm> = {}): ExportForm => ({ ...EMPTY_EXPORT_FORM, from: "2026-11-01", to: "2026-11-30", ...over });
const errs = (f: ExportForm) => {
  const r = buildExportQuery(f);
  return r.ok ? [] : r.errors;
};

describe("buildExportQuery", () => {
  it("from and to are required for every kind", () => {
    for (const kind of ["refund-cases", "commission-ledger", "wallet-transactions"] as const) {
      expect(errs(form({ kind, from: "", to: "" })), kind).toEqual(["badFrom", "badTo"]);
      expect(errs(form({ kind, from: "2026-11-01", to: "" })), kind).toEqual(["badTo"]);
      expect(errs(form({ kind, from: "", to: "2026-11-01" })), kind).toEqual(["badFrom"]);
    }
  });
  it("range limit: 366 inclusive days pass, 367 fail, impossible and reversed dates fail", () => {
    expect(errs(form({ from: "2024-01-01", to: "2024-12-31" }))).toEqual([]);
    expect(errs(form({ from: "2024-01-01", to: "2025-01-01" }))).toEqual(["rangeTooLong"]);
    expect(errs(form({ from: "2026-02-30", to: "2026-03-05" }))).toEqual(["badFrom"]);
    expect(errs(form({ from: "2026-11-05", to: "2026-11-01" }))).toEqual(["rangeOrder"]);
  });
  it("minimal query is just the dates", () => {
    expect(buildExportQuery(form())).toEqual({ ok: true, query: { from: "2026-11-01", to: "2026-11-30" } });
  });
  it("region is optional, one of TW VN MY SG, sent in upper case; 'us' and junk are refused", () => {
    expect(buildExportQuery(form({ region: "vn" }))).toEqual({ ok: true, query: { from: "2026-11-01", to: "2026-11-30", region: "VN" } });
    for (const r of ["TW", "VN", "MY", "SG"]) expect(buildExportQuery(form({ region: r })).ok, r).toBe(true);
    expect(errs(form({ region: "US" }))).toEqual(["badRegion"]);
    expect(errs(form({ region: "XX" }))).toEqual(["badRegion"]);
    expect(buildExportQuery(form({ region: "" }))).toMatchObject({ ok: true, query: expect.not.objectContaining({ region: expect.anything() }) });
  });
  it("commission ledger filters: type and a uuid beneficiary", () => {
    const id = "ABCDEF12-0000-4000-8000-000000000001";
    expect(buildExportQuery(form({ kind: "commission-ledger", ledgerType: "TEAM", beneficiaryId: id }))).toEqual({
      ok: true,
      query: { from: "2026-11-01", to: "2026-11-30", type: "TEAM", beneficiaryId: id.toLowerCase() },
    });
    expect(errs(form({ kind: "commission-ledger", beneficiaryId: "nope" }))).toEqual(["badBeneficiary"]);
  });
  it("wallet filters: a known reason and a uuid user; other kinds' fields are ignored", () => {
    const id = "abcdef12-0000-4000-8000-000000000002";
    expect(buildExportQuery(form({ kind: "wallet-transactions", walletReason: "P2P", userId: id }))).toEqual({
      ok: true,
      query: { from: "2026-11-01", to: "2026-11-30", reason: "P2P", userId: id },
    });
    expect(errs(form({ kind: "wallet-transactions", walletReason: "NOT_A_REASON" }))).toEqual(["badReason"]);
    expect(errs(form({ kind: "wallet-transactions", userId: "7" }))).toEqual(["badUser"]);
    // a ledger type typed earlier does not leak into a wallet export
    const q = buildExportQuery(form({ kind: "wallet-transactions", ledgerType: "TEAM", beneficiaryId: id }));
    expect(q).toEqual({ ok: true, query: { from: "2026-11-01", to: "2026-11-30" } });
  });
  it("refund cases reuse the list filters but the dates come from the export form", () => {
    const r = buildExportQuery(
      form({ refund: { ...EMPTY_ADMIN_FILTER, from: "1999-01-01", to: "1999-01-02", statuses: ["OPEN", "CLOSED"], overdueOnly: true, source: "CANCEL" }, region: "SG" }),
    );
    expect(r).toEqual({
      ok: true,
      query: { from: "2026-11-01", to: "2026-11-30", region: "SG", status: "OPEN,CLOSED", overdue: "true", source: "CANCEL" },
    });
    expect(errs(form({ refund: { ...EMPTY_ADMIN_FILTER, shopId: "x" } }))).toEqual(["badShop"]);
  });
});

describe("offered filters match the server enums", () => {
  // copied from the API source (WalletTxReason in common/constants/wallet.constants.ts, branch feat/cr-c3-backend),
  // without the discontinued reward type that is kept only for old rows
  const SERVER_WALLET_REASONS = ["P2P", "WITHDRAW_FREEZE", "WITHDRAW_RELEASE", "WITHDRAW_COMPLETE", "REFERRAL", "TEAM", "GLOBAL", "ADJUST", "SELLER_PAYOUT"];
  it("wallet reasons are exactly the server reasons that are still produced", () => {
    expect([...WALLET_REASONS]).toEqual(SERVER_WALLET_REASONS);
  });
  it("commission types are the three live reward types", () => {
    expect([...LEDGER_TYPES]).toEqual(["REFERRAL", "TEAM", "GLOBAL"]);
  });
});

describe("exportFileName", () => {
  it("names the file from kind, dates and region (the server name is not readable cross-origin)", () => {
    expect(exportFileName("refund-cases", { from: "2026-11-01", to: "2026-11-30" })).toBe("refund-cases-2026-11-01_2026-11-30.csv");
    expect(exportFileName("wallet-transactions", { from: "2026-11-01", to: "2026-11-30", region: "VN" })).toBe(
      "wallet-transactions-2026-11-01_2026-11-30-VN.csv",
    );
  });
});

describe("classifyExportTail: a final #ERROR line = failed download", () => {
  const ok = "﻿a,b\r\n1,2\r\nTOTAL,2\r\n";
  it("a complete file passes (CRLF, LF, trailing blank lines, BOM only file body)", () => {
    expect(classifyExportTail(ok)).toEqual({ ok: true });
    expect(classifyExportTail("a,b\n1,2\nTOTAL,2")).toEqual({ ok: true });
    expect(classifyExportTail("a,b\n1,2\nTOTAL,2\n\n\n")).toEqual({ ok: true });
  });
  it("#ERROR as the last non-empty line fails, whatever the line ending", () => {
    for (const eol of ["\r\n", "\n", "\r"]) {
      const r = classifyExportTail(`a,b${eol}1,2${eol}#ERROR,export failed after 2 rows: this file is incomplete${eol}`);
      expect(r).toEqual({ ok: false, reason: "error", message: "export failed after 2 rows: this file is incomplete" });
    }
    expect(classifyExportTail("#ERROR,x")).toEqual({ ok: false, reason: "error", message: "x" });
    expect(classifyExportTail("﻿#ERROR,x")).toEqual({ ok: false, reason: "error", message: "x" });
    expect(classifyExportTail("a\n#ERROR\n   \n")).toEqual({ ok: false, reason: "error", message: "" });
  });
  it("#ERROR earlier in the file (a data cell) does not fail a file that ends with TOTAL", () => {
    expect(classifyExportTail("a\n#ERROR,not at the end\nTOTAL,1\n")).toEqual({ ok: true });
  });
});

describe("a complete export is one whose last non-empty line starts with TOTAL", () => {
  it("a mid-line #ERROR is not an error marker: the file is refused only because it has no TOTAL line", () => {
    for (const last of ["x #ERROR y", "note,#ERROR,more", "a#ERROR"]) {
      expect(classifyExportTail(`a,b\r\n1,2\r\n${last}\r\n`)).toEqual({ ok: false, reason: "noTotal", message: "" });
    }
    // and a data line that merely contains #ERROR before the TOTAL lines does not fail the file
    expect(classifyExportTail("a,b\nx #ERROR y\nTOTAL,1\n")).toEqual({ ok: true });
  });
  it("a JSON envelope, an HTML gateway page and a truncated CSV are refused", () => {
    const bodies = [
      '{"statusCode":502,"message":"Bad Gateway","data":null}',
      '<html><body><h1>502 Bad Gateway</h1></body></html>',
      "\uFEFFcase_id,order_code\r\n1,ORD-1\r\n2,ORD-",
      '{"statusCode":200,"message":"OK","data":{"rows":[]}}\n',
    ];
    for (const b of bodies) expect(classifyExportTail(b), b).toEqual({ ok: false, reason: "noTotal", message: "" });
  });
  it("a header-only export of an empty window still ends with TOTAL and passes", () => {
    expect(classifyExportTail("\uFEFFa,b\r\nTOTAL,0\r\n")).toEqual({ ok: true });
  });
  it("lower case 'total' or a TOTAL word in the middle does not count", () => {
    expect(classifyExportTail("a\ntotal,1\n").ok).toBe(false);
    expect(classifyExportTail("a\nsum,TOTAL\n").ok).toBe(false);
  });
});

describe("inspectExportBlob reads only the end of a big file", () => {
  const big = (end: string) => new Blob(["﻿col\r\n", "row,1\r\n".repeat(50_000), end]);
  it("detects #ERROR at the end of a ~350 KB file", async () => {
    expect(big("row,1\r\n#ERROR,boom\r\n").size).toBeGreaterThan(TAIL_BYTES * 10);
    expect(await inspectExportBlob(big("#ERROR,boom\r\n"))).toEqual({ ok: false, reason: "error", message: "boom" });
  });
  it("passes a complete big file and refuses an empty one", async () => {
    expect(await inspectExportBlob(big("TOTAL,50000\r\n"))).toEqual({ ok: true });
    expect(await inspectExportBlob(new Blob([]))).toEqual({ ok: false, reason: "noTotal", message: "" });
  });
  it("a multibyte tail is decoded (zh-TW names)", async () => {
    expect(await inspectExportBlob(new Blob(["a\n", "行,1\n".repeat(3000), "TOTAL,3000\n"]))).toEqual({ ok: true });
  });
});

const apiErr = (status: number, code?: string, details?: unknown) =>
  new ApiError(status, code ?? "x", { statusCode: status, message: code ?? "x", data: { ...(code ? { code } : {}), ...(details ? { details } : {}) } } as never);

describe("exportErrorKey", () => {
  it("429, 503, EXPORT_TIMEOUT, 422 and the rest", () => {
    expect(exportErrorKey(apiErr(429, "TOO_MANY_REQUESTS")).key).toBe("accountingExport.errors.tooMany");
    expect(exportErrorKey(apiErr(429)).key).toBe("accountingExport.errors.tooMany");
    expect(exportErrorKey(apiErr(503, "EXPORT_TIMEOUT")).key).toBe("accountingExport.errors.timeout");
    expect(exportErrorKey(apiErr(500, "EXPORT_TIMEOUT")).key).toBe("accountingExport.errors.timeout");
    expect(exportErrorKey(apiErr(503)).key).toBe("accountingExport.errors.unavailable");
    expect(exportErrorKey(apiErr(503, "SERVICE_UNAVAILABLE")).key).toBe("accountingExport.errors.unavailable");
    expect(exportErrorKey(apiErr(422, "EXPORT_TOO_MANY_ROWS", { rows: 150000, max: 100000 }))).toEqual({
      key: "accountingExport.errors.tooManyRows",
      params: { rows: "150000", max: "100000" },
    });
    expect(exportErrorKey(apiErr(403, "FORBIDDEN")).key).toBe("accountingExport.errors.forbidden");
    expect(exportErrorKey(apiErr(400, "REFUND_CASE_INVALID")).key).toBe("accountingExport.errors.badRequest");
    expect(exportErrorKey(apiErr(400, "REGION_INVALID")).key).toBe("toast.regionInvalid");
    expect(exportErrorKey(apiErr(500, "INTERNAL_SERVER_ERROR")).key).toBe("accountingExport.errors.failed");
  });
  it("a network error (the aborted stream) is 'aborted'", () => {
    expect(exportErrorKey(new TypeError("network error")).key).toBe("accountingExport.errors.aborted");
  });
});

describe("runExportDownload", () => {
  const query = { from: "2026-11-01", to: "2026-11-30", region: "VN" };
  it("saves the ORIGINAL blob (BOM kept) under the client-built name when the file is complete", async () => {
    const blob = new Blob(["﻿a,b\r\n1,2\r\nTOTAL,1\r\n"]);
    const save = vi.fn();
    const download = vi.fn().mockResolvedValue(blob);
    const r = await runExportDownload({ download, save }, "wallet-transactions", query);
    expect(download).toHaveBeenCalledWith("wallet-transactions", query);
    expect(r).toEqual({ ok: true, fileName: "wallet-transactions-2026-11-01_2026-11-30-VN.csv" });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]![0]).toBe(blob);
    expect(await new Response(save.mock.calls[0]![0] as Blob).arrayBuffer().then((b) => new Uint8Array(b).slice(0, 3))).toEqual(new Uint8Array([0xef, 0xbb, 0xbf]));
  });
  it("a final #ERROR line fails the download and nothing is saved", async () => {
    const save = vi.fn();
    const r = await runExportDownload({ download: async () => new Blob(["a,b\r\n1,2\r\n#ERROR,export failed after 1 rows: this file is incomplete\r\n"]), save }, "refund-cases", query);
    expect(r).toEqual({ ok: false, error: { key: "accountingExport.errors.incomplete", params: { reason: "export failed after 1 rows: this file is incomplete" } } });
    expect(save).not.toHaveBeenCalled();
  });
  it("429, 503 and EXPORT_TIMEOUT arrive as translated failures, nothing saved", async () => {
    for (const [e, key] of [
      [apiErr(429, "TOO_MANY_REQUESTS"), "accountingExport.errors.tooMany"],
      [apiErr(503), "accountingExport.errors.unavailable"],
      [apiErr(503, "EXPORT_TIMEOUT"), "accountingExport.errors.timeout"],
      [apiErr(422, "EXPORT_TOO_MANY_ROWS", { rows: 5, max: 4 }), "accountingExport.errors.tooManyRows"],
    ] as const) {
      const save = vi.fn();
      const r = await runExportDownload({ download: () => Promise.reject(e), save }, "commission-ledger", query);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.key).toBe(key);
      expect(save).not.toHaveBeenCalled();
    }
  });
  it("a stream aborted by the server (body read rejects) is a failure, not a partial file", async () => {
    const save = vi.fn();
    const r = await runExportDownload({ download: () => Promise.reject(new TypeError("network error")), save }, "refund-cases", query);
    expect(r).toEqual({ ok: false, error: { key: "accountingExport.errors.aborted" } });
    expect(save).not.toHaveBeenCalled();
  });
  it("a JSON envelope body is refused with the 'not a CSV' text and nothing is saved", async () => {
    const save = vi.fn();
    const r = await runExportDownload({ download: async () => new Blob(['{"statusCode":502,"message":"Bad Gateway"}']), save }, "refund-cases", query);
    expect(r).toEqual({ ok: false, error: { key: "accountingExport.errors.notCsv" } });
    expect(save).not.toHaveBeenCalled();
  });
  it("an HTML 502 page and a truncated CSV are refused the same way", async () => {
    for (const body of ["<html>502</html>", "\uFEFFh\r\n1,2\r\n3,"]) {
      const save = vi.fn();
      const r = await runExportDownload({ download: async () => new Blob([body]), save }, "wallet-transactions", query);
      expect(r).toEqual({ ok: false, error: { key: "accountingExport.errors.notCsv" } });
      expect(save).not.toHaveBeenCalled();
    }
  });
  it("a last line with #ERROR in the middle is 'not a CSV', not the incomplete-with-reason message", async () => {
    const r = await runExportDownload({ download: async () => new Blob(["h\r\nx #ERROR y\r\n"]), save: vi.fn() }, "refund-cases", query);
    expect(r).toEqual({ ok: false, error: { key: "accountingExport.errors.notCsv" } });
  });
  it("an empty body is refused", async () => {
    const save = vi.fn();
    const r = await runExportDownload({ download: async () => new Blob([]), save }, "refund-cases", query);
    expect(r.ok).toBe(false);
    expect(save).not.toHaveBeenCalled();
  });
});

describe("summaryLines (no hard-coded words: every label goes through t)", () => {
  // echoes the key (and variables) so a hard-coded English word would show up as a failure
  const t = (k: string, v?: Record<string, string>) => (v ? `${k}${JSON.stringify(v)}` : k);
  it("refund cases: amounts per currency exactly as sent", () => {
    expect(summaryLines("refund-cases", { caseCount: 3, amounts: [{ currency: "TWD", cases: 3, total: "1500.50" }] }, t)).toEqual({
      rowCount: 3,
      rows: [{ label: "TWD (3)", value: "1500.50" }],
    });
  });
  it("commission: translated movements, points unit and net labels", () => {
    const r = summaryLines(
      "commission-ledger",
      {
        rowCount: 4,
        byMovement: { CREDIT: { rows: 3, walletTwd: "10.00", walletPoints: "310" }, REVERSAL: { rows: 1, walletTwd: "-4.00", walletPoints: "-124" } },
        walletNet: { twd: "6.00", points: "186" },
      },
      t,
    );
    expect(r.rowCount).toBe(4);
    expect(r.rows).toContainEqual({ label: "accountingExport.summary.movement.CREDIT (3)", value: "10.00 TWD / 310 common.pointUnit" });
    expect(r.rows).toContainEqual({ label: "accountingExport.summary.movement.REVERSAL (1)", value: "-4.00 TWD / -124 common.pointUnit" });
    expect(r.rows).toContainEqual({ label: "accountingExport.summary.net.twd", value: "6.00" });
    expect(r.rows).toContainEqual({ label: "accountingExport.summary.net.points", value: "186" });
    for (const row of r.rows) expect(row.value).not.toMatch(/\bPTS\b/);
  });
  it("a PENDING row shows what is held, so it never reads as zero", () => {
    const r = summaryLines(
      "commission-ledger",
      { rowCount: 8, byMovement: { PENDING: { rows: 8, grossTwd: "2830.00", walletTwd: "0.00", walletPoints: "0", heldTwd: "2830.00" }, CREDIT: { rows: 1, walletTwd: "5.00", walletPoints: "5", heldTwd: "0.00" } } },
      t,
    );
    const pending = r.rows.find((x) => x.label.includes("PENDING"))!;
    expect(pending.value).toContain('accountingExport.summary.held{"amount":"2830.00 TWD"}');
    // nothing held -> no held text
    expect(r.rows.find((x) => x.label.includes("CREDIT"))!.value).not.toContain("held");
  });
  it("wallet: translated direction, reason, in / out / net and the points unit", () => {
    const r = summaryLines(
      "wallet-transactions",
      { rowCount: 2, groups: [{ direction: "IN", reason: "REFERRAL", rows: 2, amount: "5.00" }], in: "5.00", out: "0.00", net: "5.00", unit: "PTS" },
      (k, v) => (k === "wallet.reasons.REFERRAL" ? "Referral" : t(k, v)),
    );
    expect(r.rows).toContainEqual({ label: "accountingExport.summary.direction.IN Referral (2)", value: "5.00" });
    expect(r.rows).toContainEqual({ label: "accountingExport.summary.in", value: "5.00" });
    expect(r.rows).toContainEqual({ label: "accountingExport.summary.out", value: "0.00" });
    expect(r.rows).toContainEqual({ label: "accountingExport.summary.netLabel", value: "5.00 common.pointUnit" });
  });
  it("an unknown reason or movement is shown as sent instead of a raw key", () => {
    const r = summaryLines("wallet-transactions", { groups: [{ direction: "IN", reason: "NEW_THING", rows: 1, amount: "1" }] }, t);
    expect(r.rows[0]!.label).toContain("NEW_THING");
  });
});


describe("dividend settlements export (4th export)", () => {
  const t = (k: string, v?: Record<string, string>) => (v ? `${k}${JSON.stringify(v)}` : k);
  it("has no dates and no region: only an optional quarter, upper case, validated like the API (2026Q3)", () => {
    expect(buildExportQuery(form({ kind: "dividend-settlements", from: "", to: "" }))).toEqual({ ok: true, query: {} });
    expect(buildExportQuery(form({ kind: "dividend-settlements", from: "garbage", to: "", region: "VN", quarter: " 2026q3 " }))).toEqual({
      ok: true,
      query: { quarter: "2026Q3" },
    });
    for (const bad of ["2026Q5", "2026Q0", "2026", "Q3", "2026 Q3", "2026-Q3", "20263"]) {
      expect(errs(form({ kind: "dividend-settlements", quarter: bad })), bad).toEqual(["badQuarter"]);
    }
  });
  it("other kinds ignore a quarter typed earlier", () => {
    expect(buildExportQuery(form({ kind: "wallet-transactions", quarter: "2026Q3" }))).toEqual({ ok: true, query: { from: "2026-11-01", to: "2026-11-30" } });
  });
  it("file name and route", () => {
    expect(exportFileName("dividend-settlements", {})).toBe("dividend-settlements.csv");
    expect(exportFileName("dividend-settlements", { quarter: "2026Q3" })).toBe("dividend-settlements-2026Q3.csv");
  });
  it("downloads and refuses by the same TOTAL rule", async () => {
    const save = vi.fn();
    const ok = await runExportDownload({ download: async () => new Blob(["\uFEFFq,u\r\nTOTAL CREDITED rows=1,5\r\nTOTAL POOL settlements=1,9\r\n"]), save }, "dividend-settlements", { quarter: "2026Q3" });
    expect(ok).toEqual({ ok: true, fileName: "dividend-settlements-2026Q3.csv" });
    const bad = await runExportDownload({ download: async () => new Blob(['{"statusCode":502}']), save }, "dividend-settlements", {});
    expect(bad.ok).toBe(false);
    expect(save).toHaveBeenCalledTimes(1);
  });
  it("summary lines: groups per status with TWD and points, pool, remainder, items total, settlements", () => {
    const r = summaryLines(
      "dividend-settlements",
      {
        rowCount: 3,
        unit: "TWD",
        groups: [{ status: "CREDITED", rows: 2, amountTwd: "900.00", points: "28.57" }, { status: "SKIPPED_ZERO", rows: 1, amountTwd: "0.00", points: "0.00" }],
        itemsTotalTwd: "900.00",
        settlements: 1,
        poolTwd: "905.50",
        remainderTwd: "5.50",
      },
      (k, v) => (k === "dividendSettlements.itemStatus.CREDITED" ? "Credited" : t(k, v)),
    );
    expect(r.rowCount).toBe(3);
    expect(r.rows).toContainEqual({ label: "Credited (2)", value: "900.00 TWD / 28.57 common.pointUnit" });
    expect(r.rows).toContainEqual({ label: "accountingExport.summary.pool", value: "905.50 TWD" });
    expect(r.rows).toContainEqual({ label: "accountingExport.summary.remainder", value: "5.50 TWD" });
    expect(r.rows).toContainEqual({ label: "accountingExport.summary.itemsTotal", value: "900.00 TWD" });
    expect(r.rows).toContainEqual({ label: "accountingExport.summary.settlements", value: "1" });
  });
  it("the export page offers the new kind with a quarter field and hides dates and region for it", async () => {
    const { readFileSync } = await import("node:fs");
    const p = readFileSync(`${__dirname}/../../app/admin/accounting-export/page.tsx`, "utf8");
    expect(p).toContain('form.kind === "dividend-settlements"');
    expect(p).toContain('t("accountingExport.quarter")');
    const { EXPORT_KINDS } = await import("@/lib/api/accounting-export");
    expect(EXPORT_KINDS).toEqual(["refund-cases", "commission-ledger", "wallet-transactions", "dividend-settlements"]);
  });
});
