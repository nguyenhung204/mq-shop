"use client";

import { useState } from "react";
import { Check, Eye, EyeOff, X } from "lucide-react";
import {
  useAdminProducts,
  useApproveProduct,
  useHideAdminProduct,
  useRejectProduct,
  useUnhideAdminProduct,
} from "@/lib/queries/admin";
import { formatMoney } from "@/lib/api/utils";
import type { ApiProduct } from "@/lib/api/types";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { AdminActions, AdminIconButton } from "@/components/admin/AdminIconButton";
import { AdminReasonModal } from "@/components/admin/AdminReasonModal";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { translateStatus } from "@/lib/i18n/status";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { AdminCardListSkeleton } from "@/components/ui/Skeleton";
import { getErrorMessage } from "@/lib/queries/utils";

function productThumb(p: ApiProduct): string {
  const imgs = p.images;
  if (!Array.isArray(imgs) || imgs.length === 0) return "";
  const first = imgs[0];
  return typeof first === "string" ? first : first?.url || "";
}

function productExcerpt(p: ApiProduct): string {
  const raw = p.description || "";
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > 140 ? `${text.slice(0, 140)}…` : text;
}

function productPriceLabel(p: ApiProduct): string {
  const min = p.minPrice ?? p.price ?? Number(p.priceUsd);
  const max = p.maxPrice ?? p.price ?? Number(p.priceUsd);
  if (min != null && max != null && !Number.isNaN(min) && !Number.isNaN(max) && min !== max) {
    return `${formatMoney(min)} – ${formatMoney(max)}`;
  }
  return formatMoney(min ?? p.priceUsd);
}

function productVariants(p: ApiProduct) {
  return Array.isArray(p.variants) ? p.variants : [];
}

type RejectTarget = {
  id: string;
  title: string;
};

function ProductsInner() {
  const { t } = useLanguage();
  const [status, setStatus] = useState("PENDING");
  const [page, setPage] = useState(1);
  const [rejectTarget, setRejectTarget] = useState<RejectTarget | null>(null);
  const { data, isLoading, isError, error } = useAdminProducts(status, page);
  const items = data?.items ?? [];
  const meta = data?.meta;
  const approveProduct = useApproveProduct();
  const rejectProduct = useRejectProduct();
  const hideProduct = useHideAdminProduct();
  const unhideProduct = useUnhideAdminProduct();

  return (
    <>
      <AdminPageHeader
        title={t("admin.products.title")}
        description={t("admin.products.description")}
        actions={
          <select
            className="mq-input max-w-[11rem]"
            value={status}
            aria-label={t("admin.common.filterStatus")}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="PENDING">{t("admin.productsPage.pendingReview")}</option>
            <option value="ACTIVE">{t("admin.common.active")}</option>
            <option value="REJECTED">{t("admin.common.rejected")}</option>
            <option value="HIDDEN">{t("admin.common.hidden")}</option>
          </select>
        }
      />

      <div className="space-y-4">
        {isError && (
          <div className="mq-alert mq-alert-error">
            {getErrorMessage(error, t("admin.common.failed"))}
          </div>
        )}
        {isLoading && <AdminCardListSkeleton />}
        {!isLoading && items.length === 0 && (
          <p className="text-sm text-mq-text-muted py-6 text-center">
            {t("admin.productsPage.empty")}
          </p>
        )}
        {items.map((p) => {
          const thumb = productThumb(p);
          const excerpt = productExcerpt(p);
          const title = p.title || p.name || "Product";
          const variants = productVariants(p);
          return (
            <div key={p.id} className="mq-card p-4 flex flex-wrap gap-4 text-sm">
              {thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumb}
                  alt=""
                  className="w-20 h-20 rounded object-cover border border-mq-border shrink-0 bg-mq-surface-subtle"
                />
              ) : (
                <div className="w-20 h-20 rounded border border-mq-border shrink-0 bg-mq-surface-subtle" />
              )}
              <div className="flex-1 min-w-[200px]">
                <p className="font-medium">{title}</p>
                <p className="text-xs text-mq-text-muted mt-0.5">
                  {productPriceLabel(p)} ·{" "}
                  {t("admin.productsPage.stock", { n: String(p.stock ?? "—") })} · {translateStatus(t, "product", p.status)}
                </p>
                {excerpt ? (
                  <p className="text-xs text-mq-text-secondary mt-2">{excerpt}</p>
                ) : null}
                {variants.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-xs text-mq-text-muted">
                    {variants.map((v) => (
                      <li key={v.id} className="flex flex-wrap gap-x-2">
                        <span className="font-medium text-mq-text-secondary">{v.sku}</span>
                        <span>{formatMoney(v.sellingPrice)}</span>
                        <span>
                          {t("admin.productsPage.qty", { n: String(v.availableStock) })}
                        </span>
                        {v.options && Object.keys(v.options).length > 0 ? (
                          <span>
                            {Object.entries(v.options)
                              .map(([k, val]) => `${k}:${val}`)
                              .join(" · ")}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <AdminActions>
                <AdminIconButton
                  label={t("admin.common.approve")}
                  icon={Check}
                  tone="approve"
                  disabled={approveProduct.isPending || p.status !== "PENDING"}
                  onClick={() => void approveProduct.mutateAsync(p.id)}
                />
                <AdminIconButton
                  label={t("admin.common.reject")}
                  icon={X}
                  tone="reject"
                  disabled={rejectProduct.isPending || p.status !== "PENDING"}
                  onClick={() => setRejectTarget({ id: p.id, title })}
                />
                {p.status === "HIDDEN" ? (
                  <AdminIconButton
                    label={t("admin.common.unhide")}
                    icon={Eye}
                    tone="approve"
                    disabled={unhideProduct.isPending}
                    onClick={() => void unhideProduct.mutateAsync(p.id)}
                  />
                ) : (
                  <AdminIconButton
                    label={t("admin.common.hide")}
                    icon={EyeOff}
                    tone="warn"
                    disabled={hideProduct.isPending}
                    onClick={() => void hideProduct.mutateAsync(p.id)}
                  />
                )}
              </AdminActions>
            </div>
          );
        })}
        <PaginationBar page={page} meta={meta} onPageChange={setPage} />
      </div>

      <AdminReasonModal
        open={!!rejectTarget}
        title={t("admin.productsPage.rejectTitle")}
        description={
          rejectTarget
            ? `Tell the seller why “${rejectTarget.title}” was rejected.`
            : undefined
        }
        confirmLabel={t("admin.common.reject")}
        required
        maxLength={500}
        busy={rejectProduct.isPending}
        onClose={() => {
          if (!rejectProduct.isPending) setRejectTarget(null);
        }}
        onConfirm={async (reason) => {
          if (!rejectTarget) return;
          await rejectProduct.mutateAsync({ id: rejectTarget.id, reason });
          setRejectTarget(null);
        }}
      />
    </>
  );
}

export default function AdminProductsPage() {
  return (
    <AuthGuard roles={["ADMIN", "SUPER_ADMIN"]} permissions={["APPROVE_PRODUCT"]}>
      <ProductsInner />
    </AuthGuard>
  );
}
