"use client";

import { Download, FolderOpen } from "lucide-react";
import {
  useDownloadMarketingFolder,
  useMarketingFolders,
} from "@/lib/queries/promotions";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminCardListSkeleton } from "@/components/ui/Skeleton";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { useState } from "react";

function MaterialsInner() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error } = useMarketingFolders(page, 20);
  const items = data?.items ?? [];
  const meta = data?.meta;
  const download = useDownloadMarketingFolder();

  return (
    <div className="space-y-4">
      {isError && (
        <div className="mq-alert mq-alert-error">
          {error instanceof Error ? error.message : "Failed to load materials (need VIEW_MKT_MAT)"}
        </div>
      )}

      {isLoading && <AdminCardListSkeleton count={4} />}

      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((folder) => (
          <div key={folder.id} className="mq-card p-4 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-mq-text-muted" aria-hidden>
                <FolderOpen size={20} strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-mq-text truncate">{folder.name}</p>
                {folder.description && (
                  <p className="text-sm text-mq-text-muted mt-0.5 line-clamp-2">
                    {folder.description}
                  </p>
                )}
                <p className="text-xs text-mq-text-muted mt-1">
                  {folder.assetCount} file{folder.assetCount === 1 ? "" : "s"}
                </p>
              </div>
            </div>
            <button
              type="button"
              className="mq-btn mq-btn-outline text-xs w-fit"
              disabled={download.isPending || folder.assetCount === 0}
              onClick={() => void download.mutateAsync(folder.id)}
            >
              <Download size={14} aria-hidden />
              {download.isPending ? "Downloading…" : "Download ZIP"}
            </button>
          </div>
        ))}
      </div>

      {!isLoading && items.length === 0 && (
        <p className="text-sm text-mq-text-muted">No marketing folders available yet.</p>
      )}

      {meta && (
        <PaginationBar page={page} meta={meta} onPageChange={setPage} />
      )}
    </div>
  );
}

export default function SellerMaterialsPage() {
  return (
    <AuthGuard permissions={["VIEW_MKT_MAT"]}>
      <MaterialsInner />
    </AuthGuard>
  );
}
