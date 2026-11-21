import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const getBlob = vi.fn();
const get = vi.fn();
vi.mock("@/lib/api/client", async (orig) => {
  const real = await orig<typeof import("@/lib/api/client")>();
  return { ...real, api: { getBlob: (...a: unknown[]) => getBlob(...a), get: (...a: unknown[]) => get(...a) } };
});

import { ExportSummaryView } from "@/components/accounting-export/ExportSummaryView";
import { LanguageProvider } from "@/components/providers/LanguageProvider";
import { accountingExportApi } from "@/lib/api/accounting-export";
import { buildExportQuery, EMPTY_EXPORT_FORM, runExportDownload } from "./model";

beforeEach(() => {
  getBlob.mockReset();
  get.mockReset();
});

describe("accounting export client", () => {
  it("downloads each CSV route with the query as given", async () => {
    getBlob.mockResolvedValue(new Blob(["x"]));
    await accountingExportApi.download("refund-cases", { from: "2026-11-01", to: "2026-11-30", region: "TW" });
    expect(getBlob).toHaveBeenLastCalledWith("/admin/accounting-export/refund-cases", { query: { from: "2026-11-01", to: "2026-11-30", region: "TW" } });
    await accountingExportApi.download("commission-ledger", { from: "a", to: "b" });
    expect(getBlob.mock.calls[1]![0]).toBe("/admin/accounting-export/commission-ledger");
    await accountingExportApi.download("wallet-transactions", { from: "a", to: "b" });
    expect(getBlob.mock.calls[2]![0]).toBe("/admin/accounting-export/wallet-transactions");
  });
  it("summaries use the /summary twin", async () => {
    get.mockResolvedValue({});
    for (const k of ["refund-cases", "commission-ledger", "wallet-transactions"] as const) await accountingExportApi.summary(k, { from: "a", to: "b" });
    expect(get.mock.calls.map((c) => c[0])).toEqual([
      "/admin/accounting-export/refund-cases/summary",
      "/admin/accounting-export/commission-ledger/summary",
      "/admin/accounting-export/wallet-transactions/summary",
    ]);
  });
  it("form -> query -> request -> saved file, for a region-filtered refund export", async () => {
    getBlob.mockResolvedValue(new Blob(["﻿h\r\nTOTAL,0\r\n"]));
    const q = buildExportQuery({ ...EMPTY_EXPORT_FORM, from: "2026-11-01", to: "2026-11-30", region: "my" });
    if (!q.ok) throw new Error("expected ok");
    const save = vi.fn();
    const r = await runExportDownload({ download: accountingExportApi.download, save }, "refund-cases", q.query);
    expect(getBlob).toHaveBeenCalledWith("/admin/accounting-export/refund-cases", { query: { from: "2026-11-01", to: "2026-11-30", region: "MY" } });
    expect(r).toEqual({ ok: true, fileName: "refund-cases-2026-11-01_2026-11-30-MY.csv" });
    expect(save).toHaveBeenCalledTimes(1);
  });
});

describe("ExportSummaryView (rendered)", () => {
  it("shows the row count and the totals lines", () => {
    const html = renderToStaticMarkup(
      createElement(
        LanguageProvider,
        null,
        createElement(ExportSummaryView, { kind: "refund-cases", summary: { caseCount: 7, amounts: [{ currency: "TWD", cases: 7, total: "250.00" }] } }),
      ),
    );
    expect(html).toContain("accountingExport.summary.rows");
    expect(html).toContain(">7<");
    expect(html).toContain("TWD (7)");
    expect(html).toContain("250.00");
  });
});
