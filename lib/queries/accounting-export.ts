"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { accountingExportApi, type ExportKind, type ExportQuery } from "@/lib/api/accounting-export";
import { runExportDownload } from "@/lib/accounting-export/model";
import { saveBlobAs } from "@/lib/accounting-export/save";
import { tt } from "@/lib/i18n/tt";

/** Preview of the row count and totals. Runs on demand only. */
export function useExportSummary() {
  return useMutation({
    mutationFn: (vars: { kind: ExportKind; query: ExportQuery }) => accountingExportApi.summary(vars.kind, vars.query),
  });
}

/** Download of one CSV. Resolves with the result; failures are returned (not thrown) so the page shows the text. */
export function useExportDownload() {
  return useMutation({
    mutationFn: async (vars: { kind: ExportKind; query: ExportQuery }) =>
      runExportDownload({ download: accountingExportApi.download, save: saveBlobAs }, vars.kind, vars.query),
    onSuccess: (res) => {
      if (res.ok) toast.success(tt("accountingExport.downloaded", { file: res.fileName }));
    },
  });
}
