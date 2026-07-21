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

function BannersInner() {
  const { data: items = [], isLoading, isError, error } = useAdminBanners();
  const createBanner = useCreateBanner();
  const toggleBanner = useToggleBanner();
  const [form, setForm] = useState({
    imageUrl: "",
    targetUrl: "/shop",
    locale: "vi",
    title: "",
    displayOrder: "0",
    isActive: true,
  });

  const create = async (e: FormEvent) => {
    e.preventDefault();
    await createBanner.mutateAsync({
      ...form,
      displayOrder: Number(form.displayOrder),
    });
    setForm({ ...form, imageUrl: "", title: "" });
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
          <input className="mq-input" placeholder="Image URL" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} required />
          <input className="mq-input" placeholder="Target URL" value={form.targetUrl} onChange={(e) => setForm({ ...form, targetUrl: e.target.value })} required />
          <select className="mq-input" value={form.locale} onChange={(e) => setForm({ ...form, locale: e.target.value })}>
            <option value="vi">vi</option>
            <option value="en">en</option>
            <option value="zh_TW">zh_TW</option>
          </select>
          <input className="mq-input" placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <input className="mq-input" type="number" value={form.displayOrder} onChange={(e) => setForm({ ...form, displayOrder: e.target.value })} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active
          </label>
          <button className="mq-btn mq-btn-primary sm:col-span-2" disabled={createBanner.isPending}>
            {createBanner.isPending ? "Creating…" : "Create banner"}
          </button>
        </form>
        {isLoading && <AdminCardListSkeleton />}
        {items.map((b) => (
          <div key={b.id} className="mq-card p-4 flex justify-between text-sm gap-3">
            <div>
              <p className="font-medium">{b.title}</p>
              <p className="text-xs text-mq-text-muted">{b.locale} · {b.isActive ? "active" : "hidden"}</p>
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
    <AuthGuard roles={["ADMIN", "SUPER_ADMIN"]} permissions={["MANAGE_BANNERS"]}>
      <BannersInner />
    </AuthGuard>
  );
}
