"use client";

import { FormEvent, useMemo, useState } from "react";
import { Pencil, Plus, X } from "lucide-react";
import {
  useCreateSellerPromotion,
  useSellerPromotions,
  useUpdateSellerPromotion,
} from "@/lib/queries/promotions";
import { useCategories } from "@/lib/queries/seller";
import { useInventoryVariants } from "@/lib/queries/inventory";
import type {
  CreatePromotionBody,
  Promotion,
  PromotionStatus,
  PromotionType,
} from "@/lib/api/promotions";
import { categoryLabel } from "@/lib/api/categoryLabel";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminActions, AdminIconButton } from "@/components/admin/AdminIconButton";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { translateStatus } from "@/lib/i18n/status";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { getErrorMessage } from "@/lib/queries/utils";

const TYPES: PromotionType[] = ["PERCENT", "FIXED", "FREE_SHIP", "VOUCHER"];
const STATUSES: Array<PromotionStatus | ""> = [
  "",
  "PENDING",
  "ACTIVE",
  "REJECTED",
  "EXPIRED",
];

function statusBadgeClass(status: PromotionStatus): string {
  switch (status) {
    case "PENDING":
      return "mq-badge mq-badge-cyan";
    case "ACTIVE":
      return "mq-badge mq-badge-teal";
    case "REJECTED":
      return "mq-badge mq-badge-pink";
    case "EXPIRED":
      return "mq-badge mq-badge-muted";
    default:
      return "mq-badge mq-badge-muted";
  }
}

function toLocalInput(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(local: string): string {
  const d = new Date(local);
  return d.toISOString();
}

type FormState = {
  name: string;
  type: PromotionType;
  discountValue: string;
  code: string;
  budget: string;
  startAt: string;
  endAt: string;
  skus: string[];
  categoryIds: string[];
};

const emptyForm = (): FormState => ({
  name: "",
  type: "PERCENT",
  discountValue: "",
  code: "",
  budget: "",
  startAt: "",
  endAt: "",
  skus: [],
  categoryIds: [],
});

function formFromPromotion(p: Promotion): FormState {
  return {
    name: p.name,
    type: p.type,
    discountValue: p.discountValue === "0" && p.type === "FREE_SHIP" ? "" : p.discountValue,
    code: p.code ?? "",
    budget: p.budget ?? "",
    startAt: toLocalInput(p.startAt),
    endAt: toLocalInput(p.endAt),
    skus: [...p.skus],
    categoryIds: [...p.categoryIds],
  };
}

function buildBody(form: FormState): CreatePromotionBody | null {
  if (!form.name.trim() || !form.startAt || !form.endAt) return null;
  if (form.skus.length === 0 && form.categoryIds.length === 0) return null;

  const body: CreatePromotionBody = {
    name: form.name.trim(),
    type: form.type,
    startAt: fromLocalInput(form.startAt),
    endAt: fromLocalInput(form.endAt),
    skus: form.skus,
    categoryIds: form.categoryIds,
  };

  if (form.budget.trim()) body.budget = form.budget.trim();

  if (form.type !== "FREE_SHIP") {
    if (!form.discountValue.trim()) return null;
    body.discountValue = form.discountValue.trim();
  }

  if (form.type === "VOUCHER") {
    const code = form.code.trim().toUpperCase();
    if (code.length < 3) return null;
    body.code = code;
  }

  return body;
}

function PromotionsInner() {
  const { t, locale } = useLanguage();
  const catLocale = locale ?? "en";
  const [status, setStatus] = useState<PromotionStatus | "">("");
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState("");
  const [skuPick, setSkuPick] = useState("");

  const { data, isLoading, isError, error } = useSellerPromotions({
    status: status || undefined,
    page,
    pageSize: 20,
  });
  const items = data?.items ?? [];
  const meta = data?.meta;

  const { data: variantPage } = useInventoryVariants({ pageSize: 100 });
  const { data: categories = [] } = useCategories();
  const createPromo = useCreateSellerPromotion();
  const updatePromo = useUpdateSellerPromotion();

  const skuOptions = useMemo(
    () =>
      (variantPage?.items ?? []).map((v) => ({
        value: v.sku,
        label: v.sku,
        keywords: v.productId,
      })),
    [variantPage?.items],
  );

  const availableSkuOptions = useMemo(
    () => skuOptions.filter((o) => !form.skus.includes(o.value)),
    [skuOptions, form.skus],
  );

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (p: Promotion) => {
    if (p.status !== "PENDING") return;
    setEditingId(p.id);
    setForm(formFromPromotion(p));
    setFormError("");
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm());
    setFormError("");
  };

  const addSku = (sku: string) => {
    if (!sku || form.skus.includes(sku)) return;
    setForm((f) => ({ ...f, skus: [...f.skus, sku] }));
    setSkuPick("");
  };

  const toggleCategory = (id: string) => {
    setForm((f) => ({
      ...f,
      categoryIds: f.categoryIds.includes(id)
        ? f.categoryIds.filter((c) => c !== id)
        : [...f.categoryIds, id],
    }));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError("");
    const body = buildBody(form);
    if (!body) {
      setFormError(t("seller.promotions.formError"));
      return;
    }
    try {
      if (editingId) {
        await updatePromo.mutateAsync({ id: editingId, body });
      } else {
        await createPromo.mutateAsync(body);
      }
      closeForm();
      setStatus("PENDING");
      setPage(1);
    } catch {
      /* toast from hook */
    }
  };

  const busy = createPromo.isPending || updatePromo.isPending;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <select
          className="mq-input max-w-[11rem]"
          value={status}
          aria-label={t("admin.common.filterStatus")}
          onChange={(e) => {
            setStatus(e.target.value as PromotionStatus | "");
            setPage(1);
          }}
        >
          {STATUSES.map((s) => (
            <option key={s || "all"} value={s}>
              {s === "" ? t("admin.common.allStatuses") : translateStatus(t, "promo", s)}
            </option>
          ))}
        </select>
        <button type="button" className="mq-btn mq-btn-primary" onClick={openCreate}>
          <Plus size={16} aria-hidden />
          {t("seller.promotions.newBtn")}
        </button>
      </div>

      {showForm && (
        <form className="mq-card p-5 space-y-4" onSubmit={(e) => void onSubmit(e)}>
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold text-mq-text">
              {editingId
                ? t("seller.promotions.editTitle")
                : t("seller.promotions.createTitle")}
            </h3>
            <button type="button" className="mq-btn mq-btn-ghost text-xs" onClick={closeForm}>
              {t("seller.promotions.cancel")}
            </button>
          </div>
          {formError && <div className="mq-alert mq-alert-error">{formError}</div>}
          {(form.type === "FIXED" || form.type === "VOUCHER") && (
            <p className="text-xs text-mq-text-muted">{t("seller.priceTwdHint")}</p>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="space-y-1 text-sm sm:col-span-2">
              <span className="text-mq-text-muted">{t("seller.promotions.name")}</span>
              <input
                className="mq-input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="text-mq-text-muted">{t("seller.promotions.type")}</span>
              <select
                className="mq-input"
                value={form.type}
                onChange={(e) =>
                  setForm({ ...form, type: e.target.value as PromotionType })
                }
              >
                {TYPES.map((promoType) => (
                  <option key={promoType} value={promoType}>
                    {translateStatus(t, "promoType", promoType)}
                  </option>
                ))}
              </select>
            </label>

            {form.type !== "FREE_SHIP" && (
              <label className="space-y-1 text-sm">
                <span className="text-mq-text-muted">
                  {form.type === "PERCENT"
                    ? t("seller.promotions.discountPct")
                    : t("seller.promotions.discountAmt")}
                </span>
                <input
                  className="mq-input"
                  value={form.discountValue}
                  onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                  placeholder={form.type === "PERCENT" ? "10" : "5.00"}
                  required
                />
              </label>
            )}

            {form.type === "VOUCHER" && (
              <label className="space-y-1 text-sm">
                <span className="text-mq-text-muted">{t("seller.promotions.voucherCode")}</span>
                <input
                  className="mq-input uppercase"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  minLength={3}
                  maxLength={40}
                  pattern="[A-Za-z0-9_-]+"
                  required
                />
              </label>
            )}

            <label className="space-y-1 text-sm">
              <span className="text-mq-text-muted">{t("seller.promotions.budget")}</span>
              <input
                className="mq-input"
                value={form.budget}
                onChange={(e) => setForm({ ...form, budget: e.target.value })}
                placeholder="1000.00"
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="text-mq-text-muted">{t("seller.promotions.start")}</span>
              <input
                className="mq-input"
                type="datetime-local"
                value={form.startAt}
                onChange={(e) => setForm({ ...form, startAt: e.target.value })}
                required
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="text-mq-text-muted">{t("seller.promotions.end")}</span>
              <input
                className="mq-input"
                type="datetime-local"
                value={form.endAt}
                onChange={(e) => setForm({ ...form, endAt: e.target.value })}
                required
              />
            </label>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-mq-text-muted">{t("seller.promotions.skus")}</p>
            <div className="flex flex-wrap gap-2 items-center">
              <div className="min-w-[14rem] flex-1">
                <SearchableSelect
                  options={availableSkuOptions}
                  value={skuPick}
                  onChange={addSku}
                  placeholder={t("seller.promotions.addSku")}
                  searchPlaceholder={t("seller.promotions.searchSku")}
                  aria-label={t("seller.promotions.addSku")}
                />
              </div>
            </div>
            {form.skus.length > 0 && (
              <ul className="flex flex-wrap gap-2 mt-2">
                {form.skus.map((sku) => (
                  <li
                    key={sku}
                    className="inline-flex items-center gap-1 rounded-md bg-mq-surface-2 px-2 py-1 text-xs"
                  >
                    {sku}
                    <button
                      type="button"
                      className="text-mq-text-muted hover:text-mq-text"
                      aria-label={`Remove ${sku}`}
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          skus: f.skus.filter((s) => s !== sku),
                        }))
                      }
                    >
                      <X size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm text-mq-text-muted">{t("seller.promotions.categories")}</p>
            <div className="max-h-40 overflow-y-auto space-y-1 rounded-md border border-mq-border p-2">
              {categories.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.categoryIds.includes(c.id)}
                    onChange={() => toggleCategory(c.id)}
                  />
                  {categoryLabel(c, catLocale)}
                </label>
              ))}
              {categories.length === 0 && (
                <p className="text-xs text-mq-text-muted">
                  {t("seller.promotions.noCategories")}
                </p>
              )}
            </div>
          </div>

          <button type="submit" className="mq-btn mq-btn-primary" disabled={busy}>
            {busy
              ? t("seller.promotions.saving")
              : editingId
                ? t("seller.promotions.save")
                : t("seller.promotions.submit")}
          </button>
        </form>
      )}

      {isError && (
        <div className="mq-alert mq-alert-error">
          {getErrorMessage(error, t("seller.promotions.loadFailed"))}
        </div>
      )}

      {isLoading ? (
        <TableSkeleton rows={5} />
      ) : (
        <div className="mq-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-mq-border text-left text-mq-text-muted">
                <th className="py-2.5 px-3 font-medium">{t("seller.promotions.name")}</th>
                <th className="py-2.5 px-3 font-medium">{t("seller.promotions.type")}</th>
                <th className="py-2.5 px-3 font-medium">{t("seller.common.status")}</th>
                <th className="py-2.5 px-3 font-medium">{t("seller.promotions.window")}</th>
                <th className="py-2.5 px-3 font-medium">{t("seller.promotions.targets")}</th>
                <th className="py-2.5 px-3 font-medium w-16" />
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="border-b border-mq-border/60 align-top">
                  <td className="py-2.5 px-3">
                    <p className="font-medium">{p.name}</p>
                    {p.code && (
                      <p className="text-xs text-mq-text-muted font-mono">{p.code}</p>
                    )}
                    {p.status === "REJECTED" && p.rejectionReason && (
                      <p className="text-xs text-mq-danger mt-1">{p.rejectionReason}</p>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    {translateStatus(t, "promoType", p.type)}
                    {p.type !== "FREE_SHIP" && (
                      <span className="text-mq-text-muted"> · {p.discountValue}</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={statusBadgeClass(p.status)}>{translateStatus(t, "promo", p.status)}</span>
                  </td>
                  <td className="py-2.5 px-3 text-xs text-mq-text-muted whitespace-nowrap">
                    {new Date(p.startAt).toLocaleString()}
                    <br />
                    {t("seller.promotions.windowTo")} {new Date(p.endAt).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-xs text-mq-text-muted">
                    {p.skus.length > 0 && (
                      <p>{t("seller.promotions.skusLine", { skus: p.skus.join(", ") })}</p>
                    )}
                    {p.categoryIds.length > 0 && (
                      <p>
                        {t("seller.promotions.categoriesLine", {
                          cats: p.categoryIds
                            .map((id) => {
                              const cat = categories.find((c) => c.id === id);
                              return cat ? categoryLabel(cat, catLocale) : id;
                            })
                            .join(", "),
                        })}
                      </p>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    {p.status === "PENDING" && (
                      <AdminActions>
                        <AdminIconButton
                          label={t("seller.common.edit")}
                          icon={Pencil}
                          onClick={() => openEdit(p)}
                        />
                      </AdminActions>
                    )}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-mq-text-muted">
                    {t("seller.promotions.empty")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {meta && (
        <PaginationBar page={page} meta={meta} onPageChange={setPage} />
      )}
    </div>
  );
}

export default function SellerPromotionsPage() {
  return (
    <AuthGuard roles={["SELLER"]}>
      <PromotionsInner />
    </AuthGuard>
  );
}
