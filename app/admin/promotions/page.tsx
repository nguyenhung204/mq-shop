"use client";

import { FormEvent, useMemo, useState } from "react";
import { Check, Plus, X } from "lucide-react";
import {
  useAdminPromotions,
  useApprovePromotion,
  useCreateAdminPromotion,
  useRejectPromotion,
} from "@/lib/queries/promotions";
import { useCategories } from "@/lib/queries/seller";
import type {
  CreatePromotionBody,
  Promotion,
  PromotionScope,
  PromotionStatus,
  PromotionType,
} from "@/lib/api/promotions";
import { categoryLabel } from "@/lib/api/categoryLabel";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { AdminActions, AdminIconButton } from "@/components/admin/AdminIconButton";
import { AdminReasonModal } from "@/components/admin/AdminReasonModal";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { translateStatus } from "@/lib/i18n/status";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { AdminCardListSkeleton } from "@/components/ui/Skeleton";
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

function fromLocalInput(local: string): string {
  return new Date(local).toISOString();
}

type FormState = {
  name: string;
  type: PromotionType;
  scopeType: PromotionScope;
  discountValue: string;
  code: string;
  budget: string;
  startAt: string;
  endAt: string;
  skusText: string;
  categoryIds: string[];
};

const emptyForm = (): FormState => ({
  name: "",
  type: "PERCENT",
  scopeType: "PLATFORM",
  discountValue: "",
  code: "",
  budget: "",
  startAt: "",
  endAt: "",
  skusText: "",
  categoryIds: [],
});

function parseSkus(text: string): string[] {
  return text
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildBody(form: FormState): CreatePromotionBody | null {
  if (!form.name.trim() || !form.startAt || !form.endAt) return null;

  const skus = parseSkus(form.skusText);
  const body: CreatePromotionBody = {
    name: form.name.trim(),
    type: form.type,
    scopeType: form.scopeType,
    startAt: fromLocalInput(form.startAt),
    endAt: fromLocalInput(form.endAt),
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

  if (form.scopeType === "PLATFORM") {
    // no skus/categories
  } else {
    if (skus.length === 0 && form.categoryIds.length === 0) return null;
    body.skus = skus;
    body.categoryIds = form.categoryIds;
  }

  return body;
}

function PromotionsInner() {
  const { t, locale } = useLanguage();
  const catLocale = locale ?? "en";
  const [status, setStatus] = useState<PromotionStatus | "">("");
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState("");
  const [rejectTarget, setRejectTarget] = useState<Promotion | null>(null);

  const { data, isLoading, isError, error } = useAdminPromotions({
    status: status || undefined,
    page,
    pageSize: 20,
  });
  const items = data?.items ?? [];
  const meta = data?.meta;

  const { data: categories = [] } = useCategories();
  const createPromo = useCreateAdminPromotion();
  const approvePromo = useApprovePromotion();
  const rejectPromo = useRejectPromotion();

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories) {
      map.set(c.id, categoryLabel(c, catLocale));
    }
    return map;
  }, [categories, catLocale]);

  const formatCategories = (ids: string[]) =>
    ids.map((id) => categoryNameById.get(id) ?? id).join(", ");

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
      setFormError(t("admin.promotions.formError"));
      return;
    }
    try {
      await createPromo.mutateAsync(body);
      setForm(emptyForm());
      setShowForm(false);
      setStatus("ACTIVE");
      setPage(1);
    } catch {
      /* toast */
    }
  };

  return (
    <>
      <AdminPageHeader
        title={t("admin.promotions.title")}
        description={t("admin.promotions.description")}
        actions={
          <button
            type="button"
            className="mq-btn mq-btn-primary shrink-0 whitespace-nowrap"
            onClick={() => {
              setShowForm((v) => !v);
              setFormError("");
            }}
          >
            <Plus size={16} aria-hidden />
            {showForm ? t("admin.common.hideForm") : t("admin.common.create")}
          </button>
        }
      />

      <div className="space-y-5">
        <select
          className="mq-input !w-[11rem] max-w-[11rem]"
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

        {showForm && (
          <form className="mq-card p-5 space-y-4" onSubmit={(e) => void onSubmit(e)}>
            <h3 className="font-semibold">{t("admin.promotions.createHeading")}</h3>
            {formError && <div className="mq-alert mq-alert-error">{formError}</div>}

            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="scope"
                  checked={form.scopeType === "PLATFORM"}
                  onChange={() => setForm({ ...form, scopeType: "PLATFORM" })}
                />
                {t("admin.promotions.scopePlatform")}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="scope"
                  checked={form.scopeType === "TARGETED"}
                  onChange={() => setForm({ ...form, scopeType: "TARGETED" })}
                />
                {t("admin.promotions.scopeTargeted")}
              </label>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <label className="space-y-1 text-sm sm:col-span-2">
                <span className="text-mq-text-muted">{t("admin.promotions.name")}</span>
                <input
                  className="mq-input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </label>

              <label className="space-y-1 text-sm">
                <span className="text-mq-text-muted">{t("admin.promotions.type")}</span>
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
                      ? t("admin.promotions.discountPct")
                      : t("admin.promotions.discountAmt")}
                  </span>
                  <input
                    className="mq-input"
                    value={form.discountValue}
                    onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                    required
                  />
                </label>
              )}

              {form.type === "VOUCHER" && (
                <label className="space-y-1 text-sm">
                  <span className="text-mq-text-muted">{t("admin.promotions.voucherCode")}</span>
                  <input
                    className="mq-input uppercase"
                    value={form.code}
                    onChange={(e) =>
                      setForm({ ...form, code: e.target.value.toUpperCase() })
                    }
                    required
                  />
                </label>
              )}

              <label className="space-y-1 text-sm">
                <span className="text-mq-text-muted">{t("admin.promotions.budget")}</span>
                <input
                  className="mq-input"
                  value={form.budget}
                  onChange={(e) => setForm({ ...form, budget: e.target.value })}
                />
              </label>

              <label className="space-y-1 text-sm">
                <span className="text-mq-text-muted">{t("admin.promotions.start")}</span>
                <input
                  className="mq-input"
                  type="datetime-local"
                  value={form.startAt}
                  onChange={(e) => setForm({ ...form, startAt: e.target.value })}
                  required
                />
              </label>

              <label className="space-y-1 text-sm">
                <span className="text-mq-text-muted">{t("admin.promotions.end")}</span>
                <input
                  className="mq-input"
                  type="datetime-local"
                  value={form.endAt}
                  onChange={(e) => setForm({ ...form, endAt: e.target.value })}
                  required
                />
              </label>
            </div>

            {form.scopeType === "TARGETED" && (
              <>
                <label className="space-y-1 text-sm block">
                  <span className="text-mq-text-muted">{t("admin.promotions.skus")}</span>
                  <textarea
                    className="mq-input"
                    rows={2}
                    value={form.skusText}
                    onChange={(e) => setForm({ ...form, skusText: e.target.value })}
                    placeholder={t("admin.promotions.skusPh")}
                  />
                </label>
                <div className="space-y-2">
                  <p className="text-sm text-mq-text-muted">{t("admin.promotions.categories")}</p>
                  <div className="max-h-36 overflow-y-auto space-y-1 rounded-md border border-mq-border p-2">
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
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              className="mq-btn mq-btn-primary"
              disabled={createPromo.isPending}
            >
              {createPromo.isPending
                ? t("admin.promotions.creating")
                : t("admin.promotions.createBtn")}
            </button>
          </form>
        )}

        {isError && (
          <div className="mq-alert mq-alert-error">
            {getErrorMessage(error, t("admin.common.failed"))}
          </div>
        )}

        {isLoading ? (
          <AdminCardListSkeleton />
        ) : (
          <div className="space-y-3">
            {items.map((p) => {
              const metaParts = [
                p.type !== "FREE_SHIP"
                  ? t("admin.promotions.discount", { value: p.discountValue })
                  : null,
                p.code ? t("admin.promotions.code", { code: p.code }) : null,
                p.budget ? t("admin.promotions.budgetLine", { budget: p.budget }) : null,
                `${new Date(p.startAt).toLocaleString()} → ${new Date(p.endAt).toLocaleString()}`,
              ].filter(Boolean);

              return (
                <div key={p.id} className="mq-card p-4 flex flex-wrap justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{p.name}</p>
                      <span className={statusBadgeClass(p.status)}>{translateStatus(t, "promo", p.status)}</span>
                      <span className="mq-badge mq-badge-muted">
                        {translateStatus(t, "promoScope", p.scopeType)}
                      </span>
                      <span className="text-xs text-mq-text-muted">
                        {translateStatus(t, "promoType", p.type)}
                      </span>
                    </div>
                    <p className="text-xs text-mq-text-muted">{metaParts.join(" · ")}</p>
                    {(p.skus.length > 0 || p.categoryIds.length > 0) && (
                      <p className="text-xs text-mq-text-muted">
                        {p.skus.length > 0 &&
                          t("admin.promotions.skusLine", { skus: p.skus.join(", ") })}
                        {p.skus.length > 0 && p.categoryIds.length > 0 ? " · " : ""}
                        {p.categoryIds.length > 0 &&
                          t("admin.promotions.categoriesLine", {
                            cats: formatCategories(p.categoryIds),
                          })}
                      </p>
                    )}
                    {p.rejectionReason && (
                      <p className="text-xs text-mq-danger">{p.rejectionReason}</p>
                    )}
                  </div>
                  {p.status === "PENDING" && (
                    <AdminActions>
                      <AdminIconButton
                        label={t("admin.common.approve")}
                        icon={Check}
                        disabled={approvePromo.isPending}
                        onClick={() => void approvePromo.mutateAsync(p.id)}
                      />
                      <AdminIconButton
                        label={t("admin.common.reject")}
                        icon={X}
                        tone="danger"
                        disabled={rejectPromo.isPending}
                        onClick={() => setRejectTarget(p)}
                      />
                    </AdminActions>
                  )}
                </div>
              );
            })}
            {items.length === 0 && (
              <p className="text-sm text-mq-text-muted py-6 text-center">
                {t("admin.promotions.empty")}
              </p>
            )}
          </div>
        )}

        {meta && <PaginationBar page={page} meta={meta} onPageChange={setPage} />}
      </div>

      <AdminReasonModal
        open={Boolean(rejectTarget)}
        title={t("admin.promotions.rejectTitle")}
        description={
          rejectTarget
            ? t("admin.promotions.rejectDesc", { name: rejectTarget.name })
            : undefined
        }
        confirmLabel={t("admin.promotions.rejectBtn")}
        maxLength={500}
        busy={rejectPromo.isPending}
        onClose={() => setRejectTarget(null)}
        onConfirm={async (reason) => {
          if (!rejectTarget) return;
          await rejectPromo.mutateAsync({ id: rejectTarget.id, reason });
          setRejectTarget(null);
        }}
      />
    </>
  );
}

export default function AdminPromotionsPage() {
  return (
    <AuthGuard
      roles={["ADMIN", "SUPER_ADMIN"]}
      permissions={["APPROVE_PROMO", "MANAGE_PROMO"]}
    >
      <PromotionsInner />
    </AuthGuard>
  );
}
