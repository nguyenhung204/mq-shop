"use client";

import { useDownloadMaterials, useMarketingMaterials } from "@/lib/queries/seller";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminCardListSkeleton } from "@/components/ui/Skeleton";

/** Temporary list until Phase 2 materials rewrite. */
function MaterialsInner() {
  const { data, isLoading, isError, error } = useMarketingMaterials();
  const items = data?.items ?? [];
  const downloadMaterials = useDownloadMaterials();

  return (
    <div className="space-y-4">
      {isError && (
        <div className="mq-alert mq-alert-error">
          {error instanceof Error ? error.message : "Failed (need VIEW_MKT_MAT)"}
        </div>
      )}
      {isLoading && <AdminCardListSkeleton count={4} />}
      {items.map((folder) => (
        <div key={folder.id} className="mq-card p-4 text-sm flex justify-between gap-3 items-center">
          <div>
            <p className="font-medium">{folder.name}</p>
            <p className="text-xs text-mq-text-muted">
              {folder.assetCount} file{folder.assetCount === 1 ? "" : "s"}
              {folder.description ? ` · ${folder.description}` : ""}
            </p>
          </div>
          <button
            type="button"
            className="mq-btn mq-btn-outline text-xs"
            disabled={downloadMaterials.isPending || folder.assetCount === 0}
            onClick={() => void downloadMaterials.mutateAsync(folder.id)}
          >
            {downloadMaterials.isPending ? "…" : "Download ZIP"}
          </button>
        </div>
      ))}
      {!isLoading && items.length === 0 && (
        <p className="text-sm text-mq-text-muted">No marketing folders yet.</p>
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
