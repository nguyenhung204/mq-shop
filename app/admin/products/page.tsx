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
import { PaginationBar } from "@/components/ui/PaginationBar";
import { AdminCardListSkeleton } from "@/components/ui/Skeleton";

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

type RejectTarget = {
  id: string;
  title: string;
};

function ProductsInner() {
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
        title="Products"
        description="Approve, reject, or hide catalog listings."
        actions={
          <select
            className="mq-input max-w-[11rem]"
            value={status}
            aria-label="Filter by status"
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            {["PENDING", "ACTIVE", "REJECTED", "HIDDEN"].map((s) => (
              <option key={s} value={s}>
                {s === "PENDING" ? "Pending review" : s}
              </option>
            ))}
          </select>
        }
      />

      <div className="space-y-4">
        {isError && (
          <div className="mq-alert mq-alert-error">
            {error instanceof Error ? error.message : "Failed"}
          </div>
        )}
        {isLoading && <AdminCardListSkeleton />}
        {items.map((p) => {
          const thumb = productThumb(p);
          const excerpt = productExcerpt(p);
          const title = p.title || p.name || p.sku || "Product";
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
                  {formatMoney(p.price ?? p.priceUsd)} · {p.status}
                  {p.sku ? ` · SKU ${p.sku}` : ""}
                </p>
                {excerpt ? (
                  <p className="text-xs text-mq-text-secondary mt-2">{excerpt}</p>
                ) : null}
              </div>
              <AdminActions>
                <AdminIconButton
                  label="Approve"
                  icon={Check}
                  tone="approve"
                  disabled={approveProduct.isPending || p.status !== "PENDING"}
                  onClick={() => void approveProduct.mutateAsync(p.id)}
                />
                <AdminIconButton
                  label="Reject"
                  icon={X}
                  tone="reject"
                  disabled={rejectProduct.isPending || p.status !== "PENDING"}
                  onClick={() => setRejectTarget({ id: p.id, title })}
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
            </div>
          );
        })}
        <PaginationBar page={page} meta={meta} onPageChange={setPage} />
      </div>

      <AdminReasonModal
        open={!!rejectTarget}
        title="Reject product"
        description={
          rejectTarget
            ? `Tell the seller why “${rejectTarget.title}” was rejected.`
            : undefined
        }
        confirmLabel="Reject"
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
