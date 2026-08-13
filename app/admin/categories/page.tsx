"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Languages, Pencil } from "lucide-react";
import { toast } from "sonner";
import { adminApi, catalogApi } from "@/lib/api";
import type { ApiCategory } from "@/lib/api/types";
import { autoTranslateCategory, type CategoryLang } from "@/lib/utils/category-translate";
import { getErrorMessage } from "@/lib/queries/utils";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { AdminIconButton } from "@/components/admin/AdminIconButton";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { FormAlerts, useFormAlerts } from "@/lib/ui/form-feedback";
import { TableSkeleton } from "@/components/ui/Skeleton";

type CategoryForm = {
  name: string;
  nameVi: string;
  nameTw: string;
  slug: string;
  parentId: string;
};

const EMPTY_FORM: CategoryForm = { name: "", nameVi: "", nameTw: "", slug: "", parentId: "" };

function CategoriesInner() {
  const { t, locale } = useLanguage();
  const queryClient = useQueryClient();
  const formAlerts = useFormAlerts({ locale, t, defaultErrorFallback: t("admin.common.failed") });
  const [form, setForm] = useState<CategoryForm>(EMPTY_FORM);
  const [editing, setEditing] = useState<ApiCategory | null>(null);

  const { data: categories = [], isLoading, isError, error } = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: () => catalogApi.categories(),
  });

  const createCat = useMutation({
    mutationFn: () =>
      adminApi.createCategory({
        name: form.name,
        nameVi: form.nameVi || undefined,
        nameTw: form.nameTw || undefined,
        slug: form.slug || undefined,
        parentId: form.parentId || null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
      toast.success(t("toast.categoryCreated"));
      setForm(EMPTY_FORM);
      formAlerts.clearAlerts();
    },
  });

  const updateCat = useMutation({
    mutationFn: () =>
      adminApi.updateCategory(editing!.id, {
        name: form.name || undefined,
        nameVi: form.nameVi || null,
        nameTw: form.nameTw || null,
        parentId: form.parentId || null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
      toast.success(t("toast.categoryUpdated"));
      setEditing(null);
      setForm(EMPTY_FORM);
      formAlerts.clearAlerts();
    },
  });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    formAlerts.clearAlerts();
    try {
      if (editing) await updateCat.mutateAsync();
      else await createCat.mutateAsync();
    } catch (err) {
      formAlerts.setErrorFromApi(err);
    }
  };

  /** Auto-translate from a given source field */
  const handleTranslate = (sourceLang: CategoryLang) => {
    const sourceText =
      sourceLang === "en" ? form.name : sourceLang === "vi" ? form.nameVi : form.nameTw;
    if (!sourceText.trim()) return;

    const result = autoTranslateCategory(sourceText, sourceLang);
    setForm((prev) => ({
      ...prev,
      name: result.en || prev.name,
      nameVi: result.vi || prev.nameVi,
      nameTw: result.tw || prev.nameTw,
    }));

    if (result.en && result.vi && result.tw) {
      toast.success(t("admin.categoriesPage.translateSuccess"));
    } else {
      toast.info(t("admin.categoriesPage.translatePartial"));
    }
  };

  return (
    <>
      <AdminPageHeader
        title={t("admin.categories.title")}
        description={t("admin.categories.description")}
      />
      <div className="space-y-6">
        {isError && (
          <div className="mq-alert mq-alert-error">
            {getErrorMessage(error, t("admin.common.failed"))}
          </div>
        )}

        <form className="mq-card p-5 space-y-4 max-w-3xl" onSubmit={(e) => void submit(e)}>
          <div>
            <FormAlerts error={formAlerts.error} />
          </div>
          <h2 className="text-lg">
            {editing ? `${t("admin.common.edit")} ${editing.name}` : t("admin.categoriesPage.create")}
          </h2>

          {/* Name fields with translate buttons */}
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-mq-text-muted">{t("admin.categoriesPage.nameEn")}</label>
              <div className="flex gap-1">
                <input
                  className="mq-input flex-1"
                  placeholder="English"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required={!editing}
                />
                <button
                  type="button"
                  className="mq-btn mq-btn-outline !px-2"
                  title={t("admin.categoriesPage.translateFrom")}
                  onClick={() => handleTranslate("en")}
                  disabled={!form.name.trim()}
                >
                  <Languages size={14} />
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-mq-text-muted">{t("admin.categoriesPage.nameVi")}</label>
              <div className="flex gap-1">
                <input
                  className="mq-input flex-1"
                  placeholder="Tiếng Việt"
                  value={form.nameVi}
                  onChange={(e) => setForm({ ...form, nameVi: e.target.value })}
                />
                <button
                  type="button"
                  className="mq-btn mq-btn-outline !px-2"
                  title={t("admin.categoriesPage.translateFrom")}
                  onClick={() => handleTranslate("vi")}
                  disabled={!form.nameVi.trim()}
                >
                  <Languages size={14} />
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-mq-text-muted">{t("admin.categoriesPage.nameTw")}</label>
              <div className="flex gap-1">
                <input
                  className="mq-input flex-1"
                  placeholder="繁體中文"
                  value={form.nameTw}
                  onChange={(e) => setForm({ ...form, nameTw: e.target.value })}
                />
                <button
                  type="button"
                  className="mq-btn mq-btn-outline !px-2"
                  title={t("admin.categoriesPage.translateFrom")}
                  onClick={() => handleTranslate("tw")}
                  disabled={!form.nameTw.trim()}
                >
                  <Languages size={14} />
                </button>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-mq-text-muted">
            {t("admin.categoriesPage.translateHint")}
          </p>

          {/* Slug + parent */}
          <div className="grid sm:grid-cols-2 gap-3">
            {!editing && (
              <input
                className="mq-input"
                placeholder={`${t("admin.categoriesPage.slug")} (${t("admin.common.optional")})`}
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
              />
            )}
            <select
              className="mq-input"
              value={form.parentId}
              onChange={(e) => setForm({ ...form, parentId: e.target.value })}
            >
              <option value="">{t("admin.categoriesPage.noParent")}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <button className="mq-btn mq-btn-primary" disabled={createCat.isPending || updateCat.isPending}>
              {editing ? t("admin.common.save") : t("admin.common.create")}
            </button>
            {editing && (
              <button
                type="button"
                className="mq-btn mq-btn-outline"
                onClick={() => {
                  setEditing(null);
                  setForm(EMPTY_FORM);
                }}
              >
                {t("admin.common.cancel")}
              </button>
            )}
          </div>
        </form>

        {isLoading ? (
          <TableSkeleton rows={5} cols={5} />
        ) : categories.length === 0 ? (
          <p className="text-sm text-mq-text-muted">{t("admin.categoriesPage.empty")}</p>
        ) : (
          <div className="mq-table-wrap">
            <table className="w-full text-sm">
              <thead className="bg-mq-surface-subtle text-left">
                <tr>
                  <th className="p-3">{t("admin.categoriesPage.nameEn")}</th>
                  <th className="p-3">{t("admin.categoriesPage.nameVi")}</th>
                  <th className="p-3">{t("admin.categoriesPage.nameTw")}</th>
                  <th className="p-3">{t("admin.categoriesPage.slug")}</th>
                  <th className="p-3">{t("admin.categoriesPage.parent")}</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id} className="border-t border-mq-border">
                    <td className="p-3">{c.name}</td>
                    <td className="p-3 text-mq-text-muted">{c.nameVi || "—"}</td>
                    <td className="p-3 text-mq-text-muted">{c.nameTw || "—"}</td>
                    <td className="p-3">{c.slug}</td>
                    <td className="p-3">
                      {c.parentId
                        ? categories.find((p) => p.id === c.parentId)?.name ||
                          categories.find((p) => p.id === c.parentId)?.slug ||
                          "—"
                        : "—"}
                    </td>
                    <td className="p-3">
                      <AdminIconButton
                        label={t("admin.common.edit")}
                        icon={Pencil}
                        onClick={() => {
                          setEditing(c);
                          setForm({
                            name: c.name,
                            nameVi: c.nameVi || "",
                            nameTw: c.nameTw || "",
                            slug: c.slug,
                            parentId: c.parentId || "",
                          });
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

export default function AdminCategoriesPage() {
  return (
    <AuthGuard roles={["ADMIN", "SUPER_ADMIN"]} permissions={["MANAGE_CONTENT"]}>
      <CategoriesInner />
    </AuthGuard>
  );
}
