"use client";

import { FormEvent, useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import {
  useAdminBanners,
  useCreateBanner,
  useDeleteBanner,
  useToggleBanner,
  useUpdateBannerMultipart,
} from "@/lib/queries/admin";
import type { Banner, BannerLang } from "@/lib/api/promotions";
import { BANNER_LANGS, BANNER_LANG_LABELS } from "@/lib/api/promotions";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { AdminActions, AdminIconButton } from "@/components/admin/AdminIconButton";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { AdminCardListSkeleton } from "@/components/ui/Skeleton";

type FormState = {
  title: string;
  linkUrl: string;
  sortOrder: string;
  isActive: boolean;
  file: File | null;
};

const emptyForm = (): FormState => ({
  title: "",
  linkUrl: "",
  sortOrder: "",
  isActive: true,
  file: null,
});

function buildFormData(
  form: FormState,
  lang: BannerLang,
  opts?: { includeImage?: boolean },
): FormData {
  const fd = new FormData();
  fd.append("title", form.title.trim());
  fd.append("lang", lang);
  if (form.linkUrl.trim()) fd.append("linkUrl", form.linkUrl.trim());
  fd.append("sortOrder", String(Number(form.sortOrder) || 0));
  fd.append("isActive", String(form.isActive));
  if (opts?.includeImage !== false && form.file) {
    fd.append("image", form.file);
  }
  return fd;
}

function BannersInner() {
  const { t } = useLanguage();
  const [lang, setLang] = useState<BannerLang>("VI");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const { data, isLoading, isError, error } = useAdminBanners(lang, page);
  const items = data?.items ?? [];
  const meta = data?.meta;

  const createBanner = useCreateBanner();
  const updateBanner = useUpdateBannerMultipart();
  const toggleBanner = useToggleBanner();
  const deleteBanner = useDeleteBanner();

  const sorted = useMemo(
    () => [...items].sort((a, b) => a.sortOrder - b.sortOrder),
    [items],
  );

  const startEdit = (b: Banner) => {
    setEditing(b);
    setLang(b.lang);
    setForm({
      title: b.title,
      linkUrl: b.linkUrl ?? "",
      sortOrder: String(b.sortOrder),
      isActive: b.isActive,
      file: null,
    });
  };

  const cancelEdit = () => {
    setEditing(null);
    setForm(emptyForm());
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (editing) {
      const fd = buildFormData(form, lang, { includeImage: Boolean(form.file) });
      await updateBanner.mutateAsync({ id: editing.id, formData: fd });
      cancelEdit();
      return;
    }
    if (!form.file) return;
    await createBanner.mutateAsync(buildFormData(form, lang));
    setForm(emptyForm());
  };

  const busy =
    createBanner.isPending || updateBanner.isPending || deleteBanner.isPending;

  return (
    <>
      <AdminPageHeader
        title={t("admin.banners.title")}
        description={t("admin.banners.description")}
        actions={
          <div className="flex gap-1 rounded-md border border-mq-border p-0.5">
            {BANNER_LANGS.map((l) => (
              <button
                key={l}
                type="button"
                className={`mq-btn text-xs px-3 py-1.5 ${lang === l ? "mq-btn-primary" : "mq-btn-ghost"}`}
                title={BANNER_LANG_LABELS[l]}
                onClick={() => {
                  setLang(l);
                  setPage(1);
                  if (!editing) setForm(emptyForm());
                }}
              >
                {l}
              </button>
            ))}
          </div>
        }
      />

      <div className="space-y-6">
        {isError && (
          <div className="mq-alert mq-alert-error">
            {error instanceof Error ? error.message : t("admin.common.failed")}
          </div>
        )}

        <form className="mq-card p-5 grid sm:grid-cols-2 gap-3" onSubmit={(e) => void onSubmit(e)}>
          <div className="sm:col-span-2 flex items-center justify-between gap-2">
            <h3 className="font-semibold text-sm">
              {editing
                ? t("admin.banners.editTitle", { title: editing.title })
                : t("admin.banners.createTitle", { lang })}
            </h3>
            {editing && (
              <button type="button" className="mq-btn mq-btn-ghost text-xs" onClick={cancelEdit}>
                {t("admin.common.cancelEdit")}
              </button>
            )}
          </div>

          <p className="sm:col-span-2 text-xs text-mq-text-muted">
            {t("admin.banners.langHint", { label: BANNER_LANG_LABELS[lang] })}
          </p>

          <input
            className="mq-input"
            placeholder={t("admin.banners.titlePh")}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
          <input
            className="mq-input"
            placeholder={t("admin.banners.linkPh")}
            value={form.linkUrl}
            onChange={(e) => setForm({ ...form, linkUrl: e.target.value })}
          />
          <input
            className="mq-input"
            type="number"
            min={0}
            placeholder={t("admin.banners.orderPh")}
            value={form.sortOrder}
            onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            {t("admin.common.active")}
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-mq-text-muted text-xs">
              {editing ? t("admin.banners.imageOptional") : t("admin.banners.imageRequired")}
            </span>
            <input
              className="mq-input"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              required={!editing}
              onChange={(e) => setForm({ ...form, file: e.target.files?.[0] ?? null })}
            />
          </label>
          <button
            className="mq-btn mq-btn-primary sm:col-span-2"
            disabled={busy || (!editing && !form.file)}
          >
            {busy
              ? t("admin.common.saving")
              : editing
                ? t("admin.common.save")
                : t("admin.banners.createBtn")}
          </button>
        </form>

        {isLoading && <AdminCardListSkeleton />}

        <div className="space-y-3">
          {sorted.map((b) => (
            <div key={b.id} className="mq-card p-4 flex flex-wrap gap-4 items-center justify-between">
              <div className="flex gap-3 min-w-0 items-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={b.imageUrl}
                  alt=""
                  className="h-14 w-24 rounded object-cover bg-mq-surface-2"
                />
                <div className="min-w-0">
                  <p className="font-medium truncate">{b.title}</p>
                  <p className="text-xs text-mq-text-muted">
                    {b.lang} · {t("admin.banners.sortLabel", { n: String(b.sortOrder) })} ·{" "}
                    {b.isActive ? t("admin.common.active") : t("admin.common.hidden")}
                    {b.linkUrl ? ` · ${b.linkUrl}` : ""}
                  </p>
                </div>
              </div>
              <AdminActions>
                <AdminIconButton
                  label={t("admin.common.edit")}
                  icon={Pencil}
                  onClick={() => startEdit(b)}
                />
                <button
                  type="button"
                  className="mq-btn mq-btn-outline text-xs"
                  disabled={toggleBanner.isPending}
                  onClick={() =>
                    void toggleBanner.mutateAsync({ id: b.id, isActive: !b.isActive })
                  }
                >
                  {b.isActive ? t("admin.common.hide") : t("admin.common.show")}
                </button>
                <AdminIconButton
                  label={t("admin.common.delete")}
                  icon={Trash2}
                  tone="danger"
                  disabled={deleteBanner.isPending}
                  onClick={() => {
                    if (confirm(t("admin.banners.confirmDelete", { title: b.title }))) {
                      void deleteBanner.mutateAsync(b.id);
                    }
                  }}
                />
              </AdminActions>
            </div>
          ))}
          {!isLoading && sorted.length === 0 && (
            <p className="text-sm text-mq-text-muted text-center py-6">
              {t("admin.banners.empty", { lang })}
            </p>
          )}
        </div>

        {meta && <PaginationBar page={page} meta={meta} onPageChange={setPage} />}
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
