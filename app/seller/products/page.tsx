"use client";

import { FormEvent, useMemo, useState } from "react";
import { Eye, EyeOff, Pencil } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/client";
import { formatMoney } from "@/lib/api/utils";
import {
  useCategories,
  useCreateSellerProduct,
  useHideSellerProduct,
  useSellerProducts,
  useUnhideSellerProduct,
  useUpdateSellerProduct,
  useUploadProductImages,
} from "@/lib/queries/seller";
import type { ApiProduct } from "@/lib/api/types";
import { AuthGuard } from "@/components/guards/AuthGuard";
import {
  AdminActions,
  AdminIconButton,
} from "@/components/admin/AdminIconButton";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { categoryLabel } from "@/lib/api/categoryLabel";

const MAX_IMAGES = 10;
const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

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

function statusLabel(status: ApiProduct["status"]): string {
  switch (status) {
    case "PENDING":
      return "Pending review";
    case "ACTIVE":
      return "Active";
    case "REJECTED":
      return "Rejected";
    case "HIDDEN":
      return "Hidden";
    default:
      return status;
  }
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

function ProductsInner() {
  const { locale } = useLanguage();
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
  const hideProduct = useHideSellerProduct();
  const unhideProduct = useUnhideSellerProduct();
  const uploadImages = useUploadProductImages();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ApiProduct | null>(null);
  const [formError, setFormError] = useState("");
  const [existingUrls, setExistingUrls] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [form, setForm] = useState({
    categoryId: "",
    title: "",
    description: "",
    price: "19.99",
    stock: "0",
    sku: "",
  });

  const resetForm = () => {
    setShowForm(false);
    setEditing(null);
    setFormError("");
    setExistingUrls([]);
    setNewFiles([]);
    setForm({
      categoryId: "",
      title: "",
      description: "",
      price: "19.99",
      stock: "0",
      sku: "",
    });
  };

  const openCreate = () => {
    setEditing(null);
    setFormError("");
    setExistingUrls([]);
    setNewFiles([]);
    setForm({
      categoryId: "",
      title: "",
      description: "",
      price: "19.99",
      stock: "0",
      sku: "",
    });
    setShowForm(true);
  };

  const startEdit = (p: ApiProduct) => {
    setEditing(p);
    setFormError("");
    setNewFiles([]);
    setExistingUrls(productImages(p).slice(0, MAX_IMAGES));
    setForm({
      categoryId: p.categoryId || "",
      title: p.title || p.name || "",
      description: p.description || "",
      price: String(p.price ?? p.priceUsd ?? ""),
      stock: String(p.stock ?? 0),
      sku: p.sku || "",
    });
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
      if (!ACCEPT.split(",").includes(file.type) && !/\.(jpe?g|png|webp|gif)$/i.test(file.name)) {
        setFormError(`“${file.name}” is not JPEG/PNG/WebP/GIF.`);
        return;
      }
      next.push(file);
    }
    setNewFiles((prev) => [...prev, ...next].slice(0, room));
  };

  const removeExisting = (url: string) => {
    setExistingUrls((prev) => prev.filter((u) => u !== url));
  };

  const removeNewFile = (index: number) => {
    setNewFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError("");

    const total = existingUrls.length + newFiles.length;
    if (total < 1) {
      setFormError("Add at least 1 product image.");
      return;
    }
    if (total > MAX_IMAGES) {
      setFormError(`Maximum ${MAX_IMAGES} images.`);
      return;
    }

    try {
      let uploaded: string[] = [];
      if (newFiles.length) {
        const res = await uploadImages.mutateAsync(newFiles);
        const raw = res?.urls ?? (Array.isArray(res) ? res : []);
        uploaded = raw
          .map((item) => (typeof item === "string" ? item : (item as { url?: string })?.url || ""))
          .map((u) => u.trim())
          .filter(Boolean);
        if (!uploaded.length) {
          setFormError("Image upload did not return URLs. Check MinIO / STORAGE_PUBLIC_URL.");
          return;
        }
      }
      const images = [...existingUrls, ...uploaded].slice(0, MAX_IMAGES);
      if (!images.every((u) => /^https?:\/\//i.test(u))) {
        setFormError(
          "Image URLs must be absolute http(s) links. Check STORAGE_PUBLIC_URL on the API.",
        );
        return;
      }
      const body = {
        title: form.title,
        description: form.description || form.title,
        categoryId: form.categoryId,
        price: Number(form.price),
        stock: Number(form.stock) || 0,
        sku: form.sku || undefined,
        images,
      };
      if (editing) {
        await updateProduct.mutateAsync({ id: editing.id, body });
      } else {
        await createProduct.mutateAsync(body);
      }
      resetForm();
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
      } else {
        toast.error("Save failed");
      }
    }
  };

  const statusOptions = useMemo(
    () => ["", "PENDING", "ACTIVE", "REJECTED", "HIDDEN"],
    [],
  );

  const saving =
    createProduct.isPending || updateProduct.isPending || uploadImages.isPending;

  return (
    <div className="space-y-6">
      {isError && (
        <div className="mq-alert mq-alert-error">
          {error instanceof Error ? error.message : "Failed to load"}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3 items-center">
          <label className="text-sm text-mq-text-muted">Status</label>
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
                {s === "PENDING" ? "Pending review" : s || "All"}
              </option>
            ))}
          </select>
        </div>
        {!showForm ? (
          <button type="button" className="mq-btn mq-btn-primary text-sm" onClick={openCreate}>
            Add product
          </button>
        ) : (
          <button type="button" className="mq-btn mq-btn-outline text-sm" onClick={resetForm}>
            Back to list
          </button>
        )}
      </div>

      {showForm ? (
        <form className="mq-card p-6 grid sm:grid-cols-2 gap-3" onSubmit={(e) => void submit(e)}>
          <h2 className="sm:col-span-2 text-lg">
            {editing ? `Edit product (${statusLabel(editing.status)})` : "Create product"}
          </h2>
          {editing?.status === "REJECTED" && reasonText(editing.rejectionReason) && (
            <p className="sm:col-span-2 text-sm text-mq-accent-pink">
              Rejection: {reasonText(editing.rejectionReason)} — edit sensitive fields to
              resubmit.
            </p>
          )}
          {formError && (
            <div className="sm:col-span-2 mq-alert mq-alert-error">{formError}</div>
          )}
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
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
            minLength={3}
          />
          <textarea
            className="mq-textarea sm:col-span-2"
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            required
          />
          <input
            className="mq-input"
            type="number"
            step="0.01"
            min="0"
            placeholder="Price"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            required
          />
          <input
            className="mq-input"
            type="number"
            min="0"
            placeholder="Stock"
            value={form.stock}
            onChange={(e) => setForm({ ...form, stock: e.target.value })}
          />
          <input
            className="mq-input sm:col-span-2"
            placeholder="SKU (optional)"
            value={form.sku}
            onChange={(e) => setForm({ ...form, sku: e.target.value })}
          />

          <div className="sm:col-span-2 space-y-3 border border-mq-border rounded-[var(--mq-radius)] p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold">Images</h3>
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
                      Remove
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
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-mq-text-muted">
              New files upload to MinIO first, then URLs are saved on the product. Removing an
              existing URL on save lets the backend delete unused MinIO objects.
            </p>
          </div>

          <div className="sm:col-span-2 flex flex-wrap gap-2">
            <button className="mq-btn mq-btn-primary" disabled={saving}>
              {uploadImages.isPending
                ? "Uploading images…"
                : editing
                  ? updateProduct.isPending
                    ? "Saving…"
                    : "Save changes"
                  : createProduct.isPending
                    ? "Creating…"
                    : "Create product"}
            </button>
            <button type="button" className="mq-btn mq-btn-outline" onClick={resetForm}>
              Cancel
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
              <p className="text-sm text-mq-text-secondary">No products yet.</p>
              <button type="button" className="mq-btn mq-btn-primary text-sm" onClick={openCreate}>
                Add product
              </button>
            </div>
          ) : (
            <div className="mq-table-wrap">
              <table className="w-full text-sm">
                <thead className="bg-mq-surface-subtle text-left">
                  <tr>
                    <th className="p-3">Title</th>
                    <th className="p-3">Price</th>
                    <th className="p-3">Stock</th>
                    <th className="p-3">Status</th>
                    <th className="p-3" />
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} className="border-t border-mq-border">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {productImages(p)[0] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={productImages(p)[0]}
                              alt=""
                              className="w-10 h-10 rounded object-cover border border-mq-border"
                            />
                          ) : null}
                          <div>
                            <div>{p.title || p.name || p.sku || "—"}</div>
                            {p.status === "REJECTED" && reasonText(p.rejectionReason) && (
                              <div className="text-xs text-mq-accent-pink mt-1">
                                {reasonText(p.rejectionReason)}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-3">{formatMoney(p.price ?? p.priceUsd)}</td>
                      <td className="p-3">{p.stock ?? "—"}</td>
                      <td className="p-3">
                        <span className={statusBadgeClass(p.status)}>
                          {statusLabel(p.status)}
                        </span>
                      </td>
                      <td className="p-3">
                        <AdminActions>
                          <AdminIconButton
                            label="Edit"
                            icon={Pencil}
                            tone="secondary"
                            onClick={() => startEdit(p)}
                          />
                          {p.status === "HIDDEN" ? (
                            <AdminIconButton
                              label="Unhide"
                              icon={Eye}
                              tone="approve"
                              disabled={unhideProduct.isPending}
                              onClick={() => void unhideProduct.mutateAsync(p.id)}
                            />
                          ) : (
                            <AdminIconButton
                              label="Hide"
                              icon={EyeOff}
                              tone="warn"
                              disabled={hideProduct.isPending}
                              onClick={() => void hideProduct.mutateAsync(p.id)}
                            />
                          )}
                        </AdminActions>
                      </td>
                    </tr>
                  ))}
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
