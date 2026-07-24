"use client";

import { FormEvent, useRef, useState } from "react";
import { FolderOpen, Trash2, Upload } from "lucide-react";
import {
  useAdminMarketingFolder,
  useAdminMarketingFolders,
  useCreateMarketingFolder,
  useDeleteMarketingAsset,
  useUploadMarketingAsset,
} from "@/lib/queries/promotions";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { AdminIconButton } from "@/components/admin/AdminIconButton";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { AdminCardListSkeleton } from "@/components/ui/Skeleton";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function MarketingInner() {
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, isError, error } = useAdminMarketingFolders(page, 20);
  const folders = data?.items ?? [];
  const meta = data?.meta;

  const { data: folder, isLoading: folderLoading } = useAdminMarketingFolder(
    selectedId ?? "",
  );
  const createFolder = useCreateMarketingFolder();
  const uploadAsset = useUploadMarketingAsset();
  const deleteAsset = useDeleteMarketingAsset();

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const created = await createFolder.mutateAsync({
      name: name.trim(),
      description: description.trim() || undefined,
    });
    setName("");
    setDescription("");
    setSelectedId(created.id);
  };

  const onUpload = (file: File | undefined) => {
    if (!file || !selectedId) return;
    void uploadAsset.mutateAsync({ folderId: selectedId, file });
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <>
      <AdminPageHeader
        title="Marketing library"
        description="Create folders and upload assets for sellers to download as ZIP."
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-4">
          <form className="mq-card p-4 space-y-3" onSubmit={(e) => void onCreate(e)}>
            <h3 className="font-semibold text-sm">New folder</h3>
            <input
              className="mq-input"
              placeholder="Folder name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <textarea
              className="mq-input"
              rows={2}
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <button
              type="submit"
              className="mq-btn mq-btn-primary"
              disabled={createFolder.isPending}
            >
              {createFolder.isPending ? "Creating…" : "Create folder"}
            </button>
          </form>

          {isError && (
            <div className="mq-alert mq-alert-error">
              {error instanceof Error ? error.message : "Failed to load folders"}
            </div>
          )}

          {isLoading ? (
            <AdminCardListSkeleton count={3} />
          ) : (
            <div className="space-y-2">
              {folders.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`mq-card w-full p-3 text-left flex gap-3 items-start transition-colors ${
                    selectedId === f.id ? "ring-1 ring-mq-text" : ""
                  }`}
                  onClick={() => setSelectedId(f.id)}
                >
                  <FolderOpen
                    size={18}
                    className="mt-0.5 text-mq-text-muted shrink-0"
                    aria-hidden
                  />
                  <span className="min-w-0">
                    <span className="font-medium block truncate">{f.name}</span>
                    <span className="text-xs text-mq-text-muted">
                      {f.assetCount} file{f.assetCount === 1 ? "" : "s"}
                      {f.description ? ` · ${f.description}` : ""}
                    </span>
                  </span>
                </button>
              ))}
              {folders.length === 0 && (
                <p className="text-sm text-mq-text-muted py-4 text-center">
                  No folders yet.
                </p>
              )}
            </div>
          )}

          {meta && <PaginationBar page={page} meta={meta} onPageChange={setPage} />}
        </div>

        <div className="mq-card p-4 min-h-[280px]">
          {!selectedId && (
            <p className="text-sm text-mq-text-muted py-12 text-center">
              Select a folder to manage assets.
            </p>
          )}
          {selectedId && folderLoading && <AdminCardListSkeleton count={2} />}
          {selectedId && folder && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold">{folder.name}</h3>
                {folder.description && (
                  <p className="text-sm text-mq-text-muted mt-1">{folder.description}</p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => onUpload(e.target.files?.[0])}
                />
                <button
                  type="button"
                  className="mq-btn mq-btn-outline text-xs"
                  disabled={uploadAsset.isPending}
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload size={14} aria-hidden />
                  {uploadAsset.isPending ? "Uploading…" : "Upload file (≤20MB)"}
                </button>
              </div>

              <ul className="space-y-2">
                {(folder.assets ?? []).map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-mq-border px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <a
                        href={a.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium truncate block underline-offset-2 hover:underline"
                      >
                        {a.fileName}
                      </a>
                      <p className="text-xs text-mq-text-muted">
                        {a.contentType} · {formatBytes(a.sizeBytes)}
                      </p>
                    </div>
                    <AdminIconButton
                      label="Delete"
                      icon={Trash2}
                      tone="danger"
                      disabled={deleteAsset.isPending}
                      onClick={() => {
                        if (confirm(`Delete “${a.fileName}”?`)) {
                          void deleteAsset.mutateAsync(a.id);
                        }
                      }}
                    />
                  </li>
                ))}
                {(folder.assets ?? []).length === 0 && (
                  <li className="text-sm text-mq-text-muted py-4 text-center">
                    Folder is empty.
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function AdminMarketingPage() {
  return (
    <AuthGuard roles={["ADMIN", "SUPER_ADMIN"]} permissions={["MANAGE_CONTENT"]}>
      <MarketingInner />
    </AuthGuard>
  );
}
