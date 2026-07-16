"use client";

import { useState } from "react";
import { useDownloadMaterials, useMarketingMaterials } from "@/lib/queries/seller";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { SellerNav } from "@/components/seller/SellerNav";
import { Container, PageHero } from "@/components/ui/shared";
import { AdminCardListSkeleton } from "@/components/ui/Skeleton";

function MaterialsInner() {
  const { data: items = [], isLoading, isError, error } = useMarketingMaterials();
  const downloadMaterials = useDownloadMaterials();
  const [folder, setFolder] = useState("");
  const [downloadInfo, setDownloadInfo] = useState("");

  return (
    <>
      <PageHero title="Marketing materials" breadcrumb={[{ label: "Seller", href: "/seller" }, { label: "Materials" }]} />
      <Container className="py-10 space-y-4">
        <SellerNav />
        {isError && (
          <div className="mq-alert mq-alert-error">
            {error instanceof Error ? error.message : "Failed (need VIEW_MKT_MAT)"}
          </div>
        )}
        {downloadInfo && <div className="mq-alert mq-alert-success">{downloadInfo}</div>}
        <div className="flex gap-2">
          <input className="mq-input" placeholder="Folder path" value={folder} onChange={(e) => setFolder(e.target.value)} />
          <button
            type="button"
            className="mq-btn mq-btn-outline"
            disabled={downloadMaterials.isPending}
            onClick={() =>
              void downloadMaterials.mutateAsync(folder).then((res) => setDownloadInfo(JSON.stringify(res)))
            }
          >
            {downloadMaterials.isPending ? "Loading…" : "Download folder"}
          </button>
        </div>
        {isLoading && <AdminCardListSkeleton count={4} />}
        {items.map((m, i) => (
          <div key={i} className="mq-card p-4 text-sm flex justify-between gap-3">
            <span>{m.folderPath}/{m.fileName}</span>
            {m.fileUrl && (
              <a href={m.fileUrl} className="text-xs underline" target="_blank" rel="noreferrer">Open</a>
            )}
          </div>
        ))}
      </Container>
    </>
  );
}

export default function SellerMaterialsPage() {
  return (
    <AuthGuard>
      <MaterialsInner />
    </AuthGuard>
  );
}
