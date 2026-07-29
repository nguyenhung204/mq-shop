"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminApi, catalogApi } from "@/lib/api";
import type { ApiCategory } from "@/lib/api/types";
import { getErrorMessage } from "@/lib/queries/utils";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { FormAlerts, useFormAlerts } from "@/lib/ui/form-feedback";
import { TableSkeleton } from "@/components/ui/Skeleton";

function CategoriesInner() {
  const { t, locale } = useLanguage();
  const queryClient = useQueryClient();
  const formAlerts = useFormAlerts({ locale, t, defaultErrorFallback: t("admin.common.failed") });
  const [form, setForm] = useState({ name: "", nameVi: "", slug: "", parentId: "" });
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
        slug: form.slug || undefined,
        parentId: form.parentId || null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
      toast.success(t("toast.categoryCreated"));
      setForm({ name: "", nameVi: "", slug: "", parentId: "" });
      formAlerts.clearAlerts();
    },
  });

  const updateCat = useMutation({
    mutationFn: () =>
      adminApi.updateCategory(editing!.id, {
        name: form.name || undefined,
        nameVi: form.nameVi || null,
        parentId: form.parentId || null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
      toast.success(t("toast.categoryUpdated"));
      setEditing(null);
      setForm({ name: "", nameVi: "", slug: "", parentId: "" });
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

        <form className="mq-card p-5 grid sm:grid-cols-2 gap-3 max-w-3xl" onSubmit={(e) => void submit(e)}>
          <div className="sm:col-span-2">
            <FormAlerts error={formAlerts.error} />
          </div>
          <h2 className="sm:col-span-2 text-lg">
            {editing ? `${t("admin.common.edit")} ${editing.id}` : t("admin.categoriesPage.create")}
          </h2>
          <input
            className="mq-input"
            placeholder={t("admin.categoriesPage.nameEn")}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required={!editing}
          />
          <input
            className="mq-input"
            placeholder={t("admin.categoriesPage.nameVi")}
            value={form.nameVi}
            onChange={(e) => setForm({ ...form, nameVi: e.target.value })}
          />
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
          <div className="sm:col-span-2 flex gap-2">
            <button className="mq-btn mq-btn-primary" disabled={createCat.isPending || updateCat.isPending}>
              {editing ? t("admin.common.save") : t("admin.common.create")}
            </button>
            {editing && (
              <button
                type="button"
                className="mq-btn mq-btn-outline"
                onClick={() => {
                  setEditing(null);
                  setForm({ name: "", nameVi: "", slug: "", parentId: "" });
                }}
              >
                {t("admin.common.cancel")}
              </button>
            )}
          </div>
        </form>

        {isLoading ? (
          <TableSkeleton rows={5} cols={4} />
        ) : categories.length === 0 ? (
          <p className="text-sm text-mq-text-muted">{t("admin.categoriesPage.empty")}</p>
        ) : (
          <div className="mq-table-wrap">
            <table className="w-full text-sm">
              <thead className="bg-mq-surface-subtle text-left">
                <tr>
                  <th className="p-3">ID</th>
                  <th className="p-3">{t("admin.common.name")}</th>
                  <th className="p-3">{t("admin.categoriesPage.slug")}</th>
                  <th className="p-3">{t("admin.categoriesPage.parent")}</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id} className="border-t border-mq-border">
                    <td className="p-3 font-mono text-xs">{c.id}</td>
                    <td className="p-3">
                      {c.name}
                      {c.nameVi ? ` / ${c.nameVi}` : ""}
                    </td>
                    <td className="p-3">{c.slug}</td>
                    <td className="p-3">{c.parentId || "—"}</td>
                    <td className="p-3">
                      <button
                        type="button"
                        className="text-xs underline"
                        onClick={() => {
                          setEditing(c);
                          setForm({
                            name: c.name,
                            nameVi: c.nameVi || "",
                            slug: c.slug,
                            parentId: c.parentId || "",
                          });
                        }}
                      >
                        {t("admin.common.edit")}
                      </button>
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
