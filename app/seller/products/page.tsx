"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/client";
import { formatMoney } from "@/lib/api/utils";
import {
  useAddSellerVariant,
  useCategories,
  useCreateSellerProduct,
  useDeleteProductImages,
  useDeleteVariantImages,
  useHideSellerProduct,
  useSellerProducts,
  useUnhideSellerProduct,
  useUpdateSellerProduct,
  useUpdateSellerVariant,
  useUploadProductImages,
  useUploadVariantImages,
} from "@/lib/queries/seller";
import type { ApiProduct, ProductVariant } from "@/lib/api/types";
import { AuthGuard } from "@/components/guards/AuthGuard";
import {
  AdminActions,
  AdminIconButton,
} from "@/components/admin/AdminIconButton";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { translateStatus } from "@/lib/i18n/status";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { categoryLabel } from "@/lib/api/categoryLabel";
import { getErrorMessage } from "@/lib/queries/utils";

const MAX_IMAGES = 10;
const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

type VariantDraft = {
  key: string;
  id?: string;
  sku: string;
  sellingPrice: string;
  /** Compact `size=M, color=black` — parsed to Record on save. */
  optionsText: string;
  availableStock?: number;
  images?: string[];
};

function reasonText(reason: ApiProduct["rejectionReason"]): string {
  if (!reason) return "";
  if (typeof reason === "string") return reason;
  return reason.vi || reason.en || "";
}

function productImages(p: ApiProduct): string[] {
  if (!Array.isArray(p.images)) return [];
  return p.images
    .map((img) => (typeof img === "string" ? img : img?.url || ""))
    .filter(Boolean);
}

function formatOptionsText(opts: Record<string, string> | null | undefined): string {
  if (!opts || !Object.keys(opts).length) return "";
  return Object.entries(opts)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");
}

/** Parse `size=M, color=black` or `size:M; color:black`. Empty → undefined. */
function parseOptionsText(
  raw: string,
): { ok: true; options?: Record<string, string> } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, options: undefined };
  const out: Record<string, string> = {};
  for (const part of trimmed.split(/[,;]/)) {
    const piece = part.trim();
    if (!piece) continue;
    const m = piece.match(/^([^=:]+)\s*[=:]\s*(.+)$/);
    if (!m) {
      return {
        ok: false,
        error: `Invalid options “${piece}”. Use key=value (e.g. size=M, color=black).`,
      };
    }
    const key = m[1].trim();
    const value = m[2].trim();
    if (!key || !value) {
      return { ok: false, error: "Option key and value cannot be empty." };
    }
    out[key] = value;
  }
  return { ok: true, options: Object.keys(out).length ? out : undefined };
}

function optionsEqual(
  a: Record<string, string> | null | undefined,
  b: Record<string, string> | null | undefined,
): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}


function statusBadgeClass(status: ApiProduct["status"]): string {
  switch (status) {
    case "PENDING":
      return "mq-badge mq-badge-cyan";
    case "ACTIVE":
      return "mq-badge";
    case "REJECTED":
      return "mq-badge mq-badge-pink";
    case "HIDDEN":
      return "mq-badge mq-badge-muted";
    default:
      return "mq-badge mq-badge-cyan";
  }
}

function priceLabel(p: ApiProduct): string {
  const min = p.minPrice ?? p.price ?? Number(p.priceUsd);
  const max = p.maxPrice ?? p.price ?? Number(p.priceUsd);
  if (min != null && max != null && !Number.isNaN(min) && !Number.isNaN(max) && min !== max) {
    return `${formatMoney(min)} – ${formatMoney(max)}`;
  }
  return formatMoney(min ?? p.priceUsd);
}

function variantsOf(p: ApiProduct): ProductVariant[] {
  return Array.isArray(p.variants) ? p.variants : [];
}

function draftFromVariants(variants: ProductVariant[]): VariantDraft[] {
  if (!variants.length) {
    return [{ key: crypto.randomUUID(), sku: "", sellingPrice: "", optionsText: "" }];
  }
  return variants.map((v) => ({
    key: v.id,
    id: v.id,
    sku: v.sku,
    sellingPrice: String(v.sellingPrice),
    optionsText: formatOptionsText(v.options),
    availableStock: v.availableStock,
    images: Array.isArray(v.images) ? v.images.filter(Boolean) : [],
  }));
}

function ProductsInner() {
  const { t, locale } = useLanguage();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading: productsLoading, isError, error } = useSellerProducts(
    status || undefined,
    page,
  );
  const products = data?.items ?? [];
  const meta = data?.meta;
  const { data: categories = [] } = useCategories();
  const createProduct = useCreateSellerProduct();
  const updateProduct = useUpdateSellerProduct();
  const addVariant = useAddSellerVariant();
  const updateVariant = useUpdateSellerVariant();
  const hideProduct = useHideSellerProduct();
  const unhideProduct = useUnhideSellerProduct();
  const uploadImages = useUploadProductImages();
  const deleteImages = useDeleteProductImages();
  const uploadVariantImages = useUploadVariantImages();
  const deleteVariantImages = useDeleteVariantImages();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ApiProduct | null>(null);
  const [formError, setFormError] = useState("");
  const [existingUrls, setExistingUrls] = useState<string[]>([]);
  const [removedUrls, setRemovedUrls] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [form, setForm] = useState({
    categoryId: "",
    title: "",
    description: "",
    attributesText: "",
  });
  const [variants, setVariants] = useState<VariantDraft[]>([
    { key: crypto.randomUUID(), sku: "", sellingPrice: "19.99", optionsText: "" },
  ]);

  const resetForm = () => {
    setShowForm(false);
    setEditing(null);
    setFormError("");
    setExistingUrls([]);
    setRemovedUrls([]);
    setNewFiles([]);
    setForm({ categoryId: "", title: "", description: "", attributesText: "" });
    setVariants([
      { key: crypto.randomUUID(), sku: "", sellingPrice: "19.99", optionsText: "" },
    ]);
  };

  const openCreate = () => {
    setEditing(null);
    setFormError("");
    setExistingUrls([]);
    setRemovedUrls([]);
    setNewFiles([]);
    setForm({ categoryId: "", title: "", description: "", attributesText: "" });
    setVariants([
      { key: crypto.randomUUID(), sku: "", sellingPrice: "19.99", optionsText: "" },
    ]);
    setShowForm(true);
  };

  const startEdit = (p: ApiProduct) => {
    setEditing(p);
    setFormError("");
    setNewFiles([]);
    setRemovedUrls([]);
    setExistingUrls(productImages(p).slice(0, MAX_IMAGES));
    setForm({
      categoryId: p.categoryId || "",
      title: p.title || p.name || "",
      description: p.description || "",
      attributesText: formatOptionsText(
        (p.attributes as Record<string, string> | null | undefined) ?? null,
      ),
    });
    setVariants(draftFromVariants(variantsOf(p)));
    setShowForm(true);
  };

  const onPickFiles = (files: FileList | null) => {
    if (!files?.length) return;
    setFormError("");
    const picked = Array.from(files);
    const room = MAX_IMAGES - existingUrls.length - newFiles.length;
    if (room <= 0) {
      setFormError(`Maximum ${MAX_IMAGES} images.`);
      return;
    }
    const next: File[] = [];
    for (const file of picked.slice(0, room)) {
      if (file.size > MAX_BYTES) {
        setFormError(`“${file.name}” exceeds 5MB.`);
        return;
      }
      if (
        !ACCEPT.split(",").includes(file.type) &&
        !/\.(jpe?g|png|webp|gif)$/i.test(file.name)
      ) {
        setFormError(`“${file.name}” is not JPEG/PNG/WebP/GIF.`);
        return;
      }
      next.push(file);
    }
    setNewFiles((prev) => [...prev, ...next].slice(0, room));
  };

  const removeExisting = (url: string) => {
    setExistingUrls((prev) => prev.filter((u) => u !== url));
    setRemovedUrls((prev) => (prev.includes(url) ? prev : [...prev, url]));
  };

  const removeNewFile = (index: number) => {
    setNewFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const updateVariantDraft = (key: string, patch: Partial<VariantDraft>) => {
    setVariants((prev) => prev.map((v) => (v.key === key ? { ...v, ...patch } : v)));
  };

  const addVariantRow = () => {
    setVariants((prev) => [
      ...prev,
      { key: crypto.randomUUID(), sku: "", sellingPrice: "", optionsText: "" },
    ]);
  };

  const removeVariantRow = (key: string) => {
    setVariants((prev) => (prev.length <= 1 ? prev : prev.filter((v) => v.key !== key)));
  };

  const validateVariants = ():
    | { sku: string; sellingPrice: number; options?: Record<string, string> }[]
    | null => {
    const cleaned: {
      sku: string;
      sellingPrice: number;
      options?: Record<string, string>;
    }[] = [];
    for (const v of variants) {
      const sku = v.sku.trim();
      const sellingPrice = Number(v.sellingPrice);
      if (!sku) {
        setFormError("Each variant needs a SKU.");
        return null;
      }
      if (!Number.isFinite(sellingPrice) || sellingPrice < 0) {
        setFormError(`Invalid sell price for SKU “${sku}”.`);
        return null;
      }
      const parsed = parseOptionsText(v.optionsText);
      if (!parsed.ok) {
        setFormError(parsed.error);
        return null;
      }
      cleaned.push({ sku, sellingPrice, options: parsed.options });
    }
    if (!cleaned.length) {
      setFormError("Add at least one variant (SKU + sell price).");
      return null;
    }
    return cleaned;
  };

  const validateImageFile = (file: File): string | null => {
    if (file.size > MAX_BYTES) return `“${file.name}” exceeds 5MB.`;
    if (
      !ACCEPT.split(",").includes(file.type) &&
      !/\.(jpe?g|png|webp|gif)$/i.test(file.name)
    ) {
      return `“${file.name}” is not JPEG/PNG/WebP/GIF.`;
    }
    return null;
  };

  const onPickVariantFiles = async (variantId: string, files: FileList | null) => {
    if (!editing || !files?.length) return;
    setFormError("");
    const draft = variants.find((v) => v.id === variantId);
    const currentCount = draft?.images?.length ?? 0;
    const room = MAX_IMAGES - currentCount;
    if (room <= 0) {
      setFormError(`Maximum ${MAX_IMAGES} images per SKU.`);
      return;
    }
    const picked: File[] = [];
    for (const file of Array.from(files).slice(0, room)) {
      const err = validateImageFile(file);
      if (err) {
        setFormError(err);
        return;
      }
      picked.push(file);
    }
    if (!picked.length) return;
    try {
      const updated = await uploadVariantImages.mutateAsync({
        productId: editing.id,
        variantId,
        files: picked,
      });
      const urls = Array.isArray(updated?.images) ? updated.images.filter(Boolean) : [];
      setVariants((prev) =>
        prev.map((v) => (v.id === variantId ? { ...v, images: urls } : v)),
      );
    } catch (err) {
      if (err instanceof ApiError) setFormError(getErrorMessage(err));
    }
  };

  const removeVariantImage = async (variantId: string, url: string) => {
    if (!editing) return;
    try {
      const updated = await deleteVariantImages.mutateAsync({
        productId: editing.id,
        variantId,
        urls: [url],
      });
      const urls = Array.isArray(updated?.images)
        ? updated.images.filter(Boolean)
        : (variants.find((v) => v.id === variantId)?.images ?? []).filter((u) => u !== url);
      setVariants((prev) =>
        prev.map((v) => (v.id === variantId ? { ...v, images: urls } : v)),
      );
    } catch (err) {
      if (err instanceof ApiError) setFormError(getErrorMessage(err));
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError("");

    const totalImages = existingUrls.length + newFiles.length;
    if (totalImages > MAX_IMAGES) {
      setFormError(`Maximum ${MAX_IMAGES} images.`);
      return;
    }

    const cleaned = validateVariants();
    if (!cleaned) return;

    const attrsParsed = parseOptionsText(form.attributesText);
    if (!attrsParsed.ok) {
      setFormError(attrsParsed.error.replace("options", "attributes"));
      return;
    }

    const wasRejected = editing?.status === "REJECTED";

    try {
      if (editing) {
        await updateProduct.mutateAsync({
          id: editing.id,
          body: {
            title: form.title,
            description: form.description || form.title,
            categoryId: form.categoryId,
            attributes: attrsParsed.options ?? null,
          },
          silent: wasRejected,
        });

        const original = variantsOf(editing);
        for (let i = 0; i < variants.length; i++) {
          const draft = variants[i];
          const payload = cleaned[i];
          const sellingPrice = payload.sellingPrice;
          const options = payload.options;
          if (draft.id) {
            const prev = original.find((o) => o.id === draft.id);
            const priceChanged = prev && prev.sellingPrice !== sellingPrice;
            const optChanged = prev && !optionsEqual(prev.options, options ?? null);
            if (priceChanged || optChanged) {
              await updateVariant.mutateAsync({
                productId: editing.id,
                variantId: draft.id,
                body: {
                  sellingPrice,
                  options: options ?? null,
                },
                silent: true,
              });
            }
          } else if (draft.sku.trim()) {
            await addVariant.mutateAsync({
              productId: editing.id,
              body: {
                sku: draft.sku.trim(),
                sellingPrice,
                options,
              },
              silent: true,
            });
          }
        }

        if (removedUrls.length) {
          await deleteImages.mutateAsync({
            productId: editing.id,
            urls: removedUrls,
          });
        }
        if (newFiles.length) {
          await uploadImages.mutateAsync({
            productId: editing.id,
            files: newFiles,
          });
        }

        if (wasRejected) {
          toast.success("Resubmitted — Pending review");
        }
      } else {
        const created = await createProduct.mutateAsync({
          title: form.title,
          description: form.description || form.title,
          categoryId: form.categoryId,
          attributes: attrsParsed.options,
          variants: cleaned,
        });
        if (newFiles.length && created?.id) {
          await uploadImages.mutateAsync({
            productId: created.id,
            files: newFiles,
          });
        }
      }
      resetForm();
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(getErrorMessage(err, t("toast.createFailed"), locale));
      } else {
        setFormError(t("toast.somethingWentWrong"));
      }
    }
  };

  const statusOptions = useMemo(
    () => ["", "PENDING", "ACTIVE", "REJECTED", "HIDDEN"],
    [],
  );

  const saving =
    createProduct.isPending ||
    updateProduct.isPending ||
    addVariant.isPending ||
    updateVariant.isPending ||
    uploadImages.isPending ||
    deleteImages.isPending ||
    uploadVariantImages.isPending ||
    deleteVariantImages.isPending;

  return (
    <div className="space-y-6">
      {isError && (
        <div className="mq-alert mq-alert-error">
          {getErrorMessage(error, t("admin.common.failed"))}
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap gap-3 items-end">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-mq-text-muted text-xs">{t("seller.productsPage.status")}</span>
            <select
              className="mq-input max-w-xs"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              {statusOptions.map((s) => (
                <option key={s || "all"} value={s}>
                  {s === "" ? t("seller.common.all") : translateStatus(t, "product", s)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {!showForm ? (
          <button type="button" className="mq-btn mq-btn-primary text-sm" onClick={openCreate}>
            {t("seller.productsPage.create")}
          </button>
        ) : (
          <button type="button" className="mq-btn mq-btn-outline text-sm" onClick={resetForm}>
            {t("seller.common.cancel")}
          </button>
        )}
      </div>

      {showForm ? (
        <form className="mq-card p-6 grid sm:grid-cols-2 gap-3" onSubmit={(e) => void submit(e)}>
          <h2 className="sm:col-span-2 text-lg">
            {editing
              ? `${t("seller.productsPage.edit")} (${translateStatus(t, "product", editing.status)})`
              : t("seller.productsPage.create")}
          </h2>
          {editing?.status === "REJECTED" ? (
            <div className="sm:col-span-2 mq-alert mq-alert-error space-y-1">
              <p className="font-medium">{t("seller.productsPage.rejectedHint")}</p>
              {reasonText(editing.rejectionReason) ? (
                <p className="text-sm">
                  {t("admin.common.reasonPrefix")}
                  {reasonText(editing.rejectionReason)}
                </p>
              ) : null}
              <p className="text-xs opacity-90">
                Changing title, description, category, gallery, sell price, or options sends the
                product back to Pending.
              </p>
            </div>
          ) : null}
          {formError ? (
            <div className="sm:col-span-2 mq-alert mq-alert-error">{formError}</div>
          ) : null}

          <select
            className="mq-input"
            value={form.categoryId}
            onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            required
          >
            <option value="">Category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {locale ? categoryLabel(c, locale) : c.name || c.slug}
              </option>
            ))}
          </select>
          <input
            className="mq-input"
            placeholder={t("seller.productsPage.title")}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
            minLength={3}
          />
          <textarea
            className="mq-textarea sm:col-span-2"
            placeholder={t("seller.productsPage.description")}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            required
          />
          <input
            className="mq-input sm:col-span-2"
            placeholder={t("seller.productsPage.options")}
            value={form.attributesText}
            onChange={(e) => setForm({ ...form, attributesText: e.target.value })}
          />

          <div className="sm:col-span-2 space-y-3 border border-mq-border rounded-[var(--mq-radius)] p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold">{t("seller.productsPage.variants")}</h3>
              <button
                type="button"
                className="mq-btn mq-btn-outline text-xs inline-flex items-center gap-1"
                onClick={addVariantRow}
              >
                <Plus className="w-3.5 h-3.5" />
                {t("seller.productsPage.addVariant")}
              </button>
            </div>
            <p className="text-xs text-mq-text-muted">
              Sell price lives on each SKU. Optional options:{" "}
              <code>size=M, color=black</code>. Stock starts at 0 — adjust via{" "}
              <Link href="/seller/inventory" className="underline">
                {t("seller.ordersPage.inventorySlips")}
              </Link>
              .
            </p>
            <div className="space-y-4">
              {variants.map((v) => (
                <div
                  key={v.key}
                  className="space-y-2 border-b border-mq-border/60 pb-4 last:border-0 last:pb-0"
                >
                  <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-2 items-center">
                    <input
                      className="mq-input"
                      placeholder={t("seller.productsPage.sku")}
                      value={v.sku}
                      maxLength={64}
                      disabled={!!v.id}
                      onChange={(e) => updateVariantDraft(v.key, { sku: e.target.value })}
                      required
                    />
                    <input
                      className="mq-input"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder={t("seller.productsPage.sellPrice")}
                      value={v.sellingPrice}
                      onChange={(e) =>
                        updateVariantDraft(v.key, { sellingPrice: e.target.value })
                      }
                      required
                    />
                    <div className="flex items-center gap-2 justify-end">
                      <span className="text-xs text-mq-text-muted whitespace-nowrap">
                        {t("seller.productsPage.stock")}: {v.id ? (v.availableStock ?? 0) : 0}
                      </span>
                      {!v.id && variants.length > 1 ? (
                        <button
                          type="button"
                          className="mq-icon-btn text-mq-text-muted"
                          aria-label={t("admin.common.delete")}
                          onClick={() => removeVariantRow(v.key)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <input
                    className="mq-input w-full"
                    placeholder={t("seller.productsPage.options")}
                    value={v.optionsText}
                    onChange={(e) =>
                      updateVariantDraft(v.key, { optionsText: e.target.value })
                    }
                  />
                  {v.id && editing ? (
                    <div className="space-y-2 rounded-[var(--mq-radius-sm)] bg-mq-surface-subtle p-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-xs font-medium">SKU images</p>
                        <p className="text-[11px] text-mq-text-muted">
                          {(v.images?.length ?? 0)}/{MAX_IMAGES} · empty → product gallery
                        </p>
                      </div>
                      <input
                        className="mq-input text-xs"
                        type="file"
                        accept={ACCEPT}
                        multiple
                        disabled={uploadVariantImages.isPending}
                        onChange={(e) => {
                          void onPickVariantFiles(v.id!, e.target.files);
                          e.target.value = "";
                        }}
                      />
                      {(v.images?.length ?? 0) > 0 ? (
                        <ul className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                          {v.images!.map((url) => (
                            <li
                              key={url}
                              className="relative border border-mq-border rounded overflow-hidden"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={url}
                                alt=""
                                className="w-full aspect-square object-cover"
                              />
                              <button
                                type="button"
                                className="absolute top-0.5 right-0.5 text-[9px] px-1 py-0.5 bg-black/70 text-white rounded"
                                disabled={deleteVariantImages.isPending}
                                onClick={() => void removeVariantImage(v.id!, url)}
                              >
                                ×
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-[11px] text-mq-text-muted">No SKU images yet.</p>
                      )}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div className="sm:col-span-2 space-y-3 border border-mq-border rounded-[var(--mq-radius)] p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold">{t("seller.productsPage.gallery")}</h3>
              <p className="text-xs text-mq-text-muted">
                {existingUrls.length + newFiles.length}/{MAX_IMAGES} · ≤5MB · JPEG/PNG/WebP/GIF
              </p>
            </div>
            <input
              className="mq-input"
              type="file"
              accept={ACCEPT}
              multiple
              onChange={(e) => {
                onPickFiles(e.target.files);
                e.target.value = "";
              }}
            />
            {(existingUrls.length > 0 || newFiles.length > 0) && (
              <ul className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {existingUrls.map((url) => (
                  <li
                    key={url}
                    className="relative group border border-mq-border rounded-[var(--mq-radius-sm)] overflow-hidden"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="w-full aspect-square object-cover" />
                    <button
                      type="button"
                      className="absolute top-1 right-1 text-[10px] px-1.5 py-0.5 bg-black/70 text-white rounded"
                      onClick={() => removeExisting(url)}
                    >
                      {t("admin.common.delete")}
                    </button>
                  </li>
                ))}
                {newFiles.map((file, i) => (
                  <li
                    key={`${file.name}-${i}`}
                    className="relative border border-dashed border-mq-border rounded-[var(--mq-radius-sm)] p-2 text-xs"
                  >
                    <p className="line-clamp-3 break-all">{file.name}</p>
                    <p className="text-mq-text-muted mt-1">
                      {(file.size / 1024).toFixed(0)} KB · pending upload
                    </p>
                    <button
                      type="button"
                      className="mt-2 underline"
                      onClick={() => removeNewFile(i)}
                    >
                      {t("admin.common.delete")}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-mq-text-muted">
              Images upload to MinIO after the product exists (
              <code>POST /products/:id/images</code>). Optional on create.
            </p>
          </div>

          <div className="sm:col-span-2 flex flex-wrap gap-2">
            <button className="mq-btn mq-btn-primary" disabled={saving}>
              {uploadImages.isPending
                ? t("admin.marketing.uploading")
                : editing
                  ? saving
                    ? t("seller.common.saving")
                    : t("seller.common.save")
                  : createProduct.isPending
                    ? t("admin.common.working")
                    : t("seller.productsPage.create")}
            </button>
            <button type="button" className="mq-btn mq-btn-outline" onClick={resetForm}>
              {t("seller.common.cancel")}
            </button>
          </div>
        </form>
      ) : null}

      {!showForm ? (
        <>
          {productsLoading ? (
            <TableSkeleton rows={6} cols={5} />
          ) : products.length === 0 ? (
            <div className="mq-card p-8 text-center space-y-3">
              <p className="text-sm text-mq-text-secondary">{t("seller.productsPage.empty")}</p>
              <button type="button" className="mq-btn mq-btn-primary text-sm" onClick={openCreate}>
                {t("seller.productsPage.create")}
              </button>
            </div>
          ) : (
            <div className="mq-table-wrap">
              <table className="w-full text-sm">
                <thead className="bg-mq-surface-subtle text-left">
                  <tr>
                    <th className="p-3">{t("seller.productsPage.title")}</th>
                    <th className="p-3">{t("seller.productsPage.price")}</th>
                    <th className="p-3">{t("seller.productsPage.stock")}</th>
                    <th className="p-3">{t("seller.productsPage.sku")}</th>
                    <th className="p-3">{t("seller.productsPage.status")}</th>
                    <th className="p-3" />
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => {
                    const imgs = productImages(p);
                    const vars = variantsOf(p);
                    return (
                      <tr key={p.id} className="border-t border-mq-border">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            {imgs[0] ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={imgs[0]}
                                alt=""
                                className="w-10 h-10 rounded object-cover border border-mq-border"
                              />
                            ) : null}
                            <div>
                              <div>{p.title || p.name || "—"}</div>
                              {p.status === "REJECTED" && reasonText(p.rejectionReason) ? (
                                <div className="text-xs text-mq-accent-pink mt-1">
                                  {reasonText(p.rejectionReason)}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="p-3">{priceLabel(p)}</td>
                        <td className="p-3">{p.stock ?? "—"}</td>
                        <td className="p-3 text-xs text-mq-text-muted">
                          {vars.length
                            ? vars.map((v) => v.sku).join(", ")
                            : p.sku || "—"}
                        </td>
                        <td className="p-3">
                          <span className={statusBadgeClass(p.status)}>
                            {translateStatus(t, "product", p.status)}
                          </span>
                          {p.status === "REJECTED" ? (
                            <button
                              type="button"
                              className="block mt-1 text-xs underline text-mq-accent-pink"
                              onClick={() => startEdit(p)}
                            >
                              {t("seller.common.edit")}
                            </button>
                          ) : null}
                        </td>
                        <td className="p-3">
                          <AdminActions>
                            <AdminIconButton
                              label={t("seller.common.edit")}
                              icon={Pencil}
                              tone="secondary"
                              onClick={() => startEdit(p)}
                            />
                            {p.status === "HIDDEN" ? (
                              <AdminIconButton
                                label={t("seller.common.unhide")}
                                icon={Eye}
                                tone="approve"
                                disabled={unhideProduct.isPending}
                                onClick={() => void unhideProduct.mutateAsync(p.id)}
                              />
                            ) : (
                              <AdminIconButton
                                label={t("seller.common.hide")}
                                icon={EyeOff}
                                tone="warn"
                                disabled={hideProduct.isPending}
                                onClick={() => void hideProduct.mutateAsync(p.id)}
                              />
                            )}
                          </AdminActions>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <PaginationBar page={page} meta={meta} onPageChange={setPage} />
        </>
      ) : null}
    </div>
  );
}

export default function SellerProductsPage() {
  return (
    <AuthGuard roles={["SELLER"]}>
      <ProductsInner />
    </AuthGuard>
  );
}
