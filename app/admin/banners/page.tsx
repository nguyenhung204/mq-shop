"use client";

import { FormEvent, useState } from "react";
import {
  useAdminBanners,
  useCreateBanner,
  useToggleBanner,
} from "@/lib/queries/admin";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { AdminCardListSkeleton } from "@/components/ui/Skeleton";

/** Temporary stub until Phase 4 multipart UI rewrite. */
function BannersInner() {
  const { data, isLoading, isError, error } = useAdminBanners();
  const items = data?.items ?? [];
  const createBanner = useCreateBanner();
  const toggleBanner = useToggleBanner();
  const [title, setTitle] = useState("");
  const [lang, setLang] = useState<"VI" | "EN">("VI");
  const [linkUrl, setLinkUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) return;
    const fd = new FormData();
    fd.append("image", file);
    fd.append("title", title);
    fd.append("lang", lang);
    if (linkUrl) fd.append("linkUrl", linkUrl);
    fd.append("sortOrder", "0");
    fd.append("isActive", "true");
    await createBanner.mutateAsync(fd);
    setTitle("");
    setLinkUrl("");
    setFile(null);
  };

  return (
    <>
      <AdminPageHeader
        title="Banners"
        description="Manage homepage CMS banners."
      />
      <div className="space-y-6">
        {isError && (
          <div className="mq-alert mq-alert-error">
            {error instanceof Error ? error.message : "Failed"}
          </div>
        )}
        <form className="mq-card p-5 grid sm:grid-cols-2 gap-3" onSubmit={(e) => void create(e)}>
          <input
            className="mq-input"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <select
            className="mq-input"
            value={lang}
            onChange={(e) => setLang(e.target.value as "VI" | "EN")}
          >
            <option value="VI">VI</option>
            <option value="EN">EN</option>
          </select>
          <input
            className="mq-input"
            placeholder="Link URL (optional)"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
          />
          <input
            className="mq-input"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            required
          />
          <button
            className="mq-btn mq-btn-primary sm:col-span-2"
            disabled={createBanner.isPending || !file}
          >
            {createBanner.isPending ? "Creating…" : "Create banner"}
          </button>
        </form>
        {isLoading && <AdminCardListSkeleton />}
        {items.map((b) => (
          <div key={b.id} className="mq-card p-4 flex justify-between text-sm gap-3">
            <div>
              <p className="font-medium">{b.title}</p>
              <p className="text-xs text-mq-text-muted">
                {b.lang} · {b.isActive ? "active" : "hidden"}
              </p>
            </div>
            <button
              type="button"
              className="mq-btn mq-btn-outline text-xs"
              disabled={toggleBanner.isPending}
              onClick={() => void toggleBanner.mutateAsync({ id: b.id, isActive: !b.isActive })}
            >
              Toggle
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

export default function AdminBannersPage() {
  return (
    <AuthGuard roles={["ADMIN", "SUPER_ADMIN"]} permissions={["MANAGE_CONTENT"]}>
      <BannersInner />
    </AuthGuard>
  );
}
