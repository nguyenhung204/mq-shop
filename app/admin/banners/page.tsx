"use client";

import { FormEvent, useEffect, useState } from "react";
import { adminApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import type { ApiBanner } from "@/lib/api/types";
import { asArray } from "@/lib/api/utils";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminNav } from "@/components/admin/AdminNav";
import { Container, PageHero } from "@/components/ui/shared";

function BannersInner() {
  const [items, setItems] = useState<ApiBanner[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    imageUrl: "",
    targetUrl: "/shop",
    locale: "vi",
    title: "",
    displayOrder: "0",
    isActive: true,
  });

  const load = async () => {
    try {
      setItems(asArray(await adminApi.banners()) as ApiBanner[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await adminApi.createBanner({
        ...form,
        displayOrder: Number(form.displayOrder),
      });
      setForm({ ...form, imageUrl: "", title: "" });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Create failed");
    }
  };

  return (
    <>
      <PageHero title="Banners" breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Banners" }]} />
      <Container className="py-10 space-y-6">
        <AdminNav />
        {error && <div className="mq-alert mq-alert-error">{error}</div>}
        <form className="mq-card p-5 grid sm:grid-cols-2 gap-3" onSubmit={create}>
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
          <button className="mq-btn mq-btn-primary sm:col-span-2">Create banner</button>
        </form>
        {items.map((b) => (
          <div key={b.id} className="mq-card p-4 flex justify-between text-sm gap-3">
            <div>
              <p className="font-medium">{b.title}</p>
              <p className="text-xs text-mq-text-muted">{b.locale} · {b.isActive ? "active" : "hidden"}</p>
            </div>
            <button
              type="button"
              className="mq-btn mq-btn-outline text-xs"
              onClick={() => void adminApi.updateBanner(b.id, { isActive: !b.isActive }).then(load)}
            >
              Toggle
            </button>
          </div>
        ))}
      </Container>
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
