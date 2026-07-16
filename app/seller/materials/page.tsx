"use client";

import { useEffect, useState } from "react";
import { cmsApi } from "@/lib/api";
import { asArray } from "@/lib/api/utils";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { SellerNav } from "@/components/seller/SellerNav";
import { Container, PageHero } from "@/components/ui/shared";

function MaterialsInner() {
  const [items, setItems] = useState<{ folderPath?: string; fileName?: string; fileUrl?: string }[]>([]);
  const [folder, setFolder] = useState("");
  const [error, setError] = useState("");
  const [downloadInfo, setDownloadInfo] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        setItems(asArray(await cmsApi.materials()) as typeof items);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed (need VIEW_MKT_MAT)");
      }
    })();
  }, []);

  return (
    <>
      <PageHero title="Marketing materials" breadcrumb={[{ label: "Seller", href: "/seller" }, { label: "Materials" }]} />
      <Container className="py-10 space-y-4">
        <SellerNav />
        {error && <div className="mq-alert mq-alert-error">{error}</div>}
        {downloadInfo && <div className="mq-alert mq-alert-success">{downloadInfo}</div>}
        <div className="flex gap-2">
          <input className="mq-input" placeholder="Folder path" value={folder} onChange={(e) => setFolder(e.target.value)} />
          <button
            type="button"
            className="mq-btn mq-btn-outline"
            onClick={async () => {
              try {
                const res = await cmsApi.downloadMaterials(folder);
                setDownloadInfo(JSON.stringify(res));
              } catch (e) {
                setError(e instanceof Error ? e.message : "Download failed");
              }
            }}
          >
            Download folder
          </button>
        </div>
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
