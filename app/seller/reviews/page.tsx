"use client";

import { FormEvent, useMemo, useState } from "react";
import { MessageSquare, Trash2 } from "lucide-react";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminActions, AdminIconButton } from "@/components/admin/AdminIconButton";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { Stars } from "@/components/ui/shared";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useSellerProducts } from "@/lib/queries/seller";
import {
  useDeleteReviewReply,
  useProductReviews,
  useReviewReply,
} from "@/lib/queries/reviews";
import type { ProductReview } from "@/lib/api/reviews";
import { getErrorMessage } from "@/lib/queries/utils";

function SellerProductReviews({
  productId,
  productTitle,
}: {
  productId: string;
  productTitle: string;
}) {
  const { t } = useLanguage();
  const [page, setPage] = useState(1);
  const [replyFor, setReplyFor] = useState<ProductReview | null>(null);
  const [body, setBody] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ProductReview | null>(null);
  const { data, isLoading, isError, error } = useProductReviews(productId, page, 10);
  const reply = useReviewReply(productId);
  const deleteReply = useDeleteReviewReply(productId);
  const items = data?.items ?? [];
  const meta = data?.meta;

  const onReply = async (e: FormEvent) => {
    e.preventDefault();
    if (!replyFor || !body.trim()) return;
    try {
      await reply.mutateAsync({ reviewId: replyFor.id, body: body.trim() });
      setReplyFor(null);
      setBody("");
    } catch {
      /* toast */
    }
  };

  return (
    <section className="mq-card p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-mq-text truncate">{productTitle}</h2>
      </div>
      {isError ? (
        <div className="mq-alert mq-alert-error text-sm">
          {getErrorMessage(error, t("admin.common.failed"))}
        </div>
      ) : null}
      {isLoading ? (
        <p className="text-sm text-mq-text-muted">{t("admin.common.loading")}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-mq-text-muted">{t("seller.reviews.emptyProduct")}</p>
      ) : (
        <ul className="divide-y divide-mq-border">
          {items.map((review) => (
            <li key={review.id} className="py-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Stars rating={review.rating} />
                <span className="text-sm font-medium">
                  {review.buyer?.fullName?.trim() || t("product.reviewsPage.anonymous")}
                </span>
                <span className="text-[11px] text-mq-text-muted ml-auto">
                  {review.createdAt ? new Date(review.createdAt).toLocaleDateString() : ""}
                </span>
              </div>
              {review.comment ? (
                <p className="text-sm text-mq-text-secondary whitespace-pre-wrap">
                  {review.comment}
                </p>
              ) : null}
              {review.reply?.body ? (
                <div className="rounded-[var(--mq-radius-sm)] border border-mq-border bg-mq-surface-subtle px-3 py-2 text-sm">
                  <p className="text-[11px] font-medium text-mq-text-muted mb-1">
                    {t("product.reviewsPage.sellerReply")}
                  </p>
                  <p className="whitespace-pre-wrap">{review.reply.body}</p>
                </div>
              ) : null}
              <AdminActions>
                <AdminIconButton
                  label={
                    review.reply?.body
                      ? t("seller.reviews.editReply")
                      : t("seller.reviews.reply")
                  }
                  icon={MessageSquare}
                  tone="secondary"
                  onClick={() => {
                    setReplyFor(review);
                    setBody(review.reply?.body ?? "");
                  }}
                />
                {review.reply?.body ? (
                  <AdminIconButton
                    label={t("seller.reviews.deleteReply")}
                    icon={Trash2}
                    tone="danger"
                    disabled={deleteReply.isPending}
                    onClick={() => setDeleteTarget(review)}
                  />
                ) : null}
              </AdminActions>
            </li>
          ))}
        </ul>
      )}
      <PaginationBar page={page} meta={meta} onPageChange={setPage} />

      {replyFor ? (
        <form
          className="border-t border-mq-border pt-3 space-y-2"
          onSubmit={(e) => void onReply(e)}
        >
          <p className="text-xs font-medium">
            {t("seller.reviews.replyingTo", {
              name: replyFor.buyer?.fullName?.trim() || t("product.reviewsPage.anonymous"),
            })}
          </p>
          <textarea
            className="mq-input min-h-[4rem]"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={2000}
            required
          />
          <div className="flex gap-2">
            <button
              type="submit"
              className="mq-btn mq-btn-primary text-sm"
              disabled={reply.isPending}
            >
              {reply.isPending ? t("admin.common.saving") : t("seller.reviews.saveReply")}
            </button>
            <button
              type="button"
              className="mq-btn mq-btn-outline text-sm"
              onClick={() => {
                setReplyFor(null);
                setBody("");
              }}
            >
              {t("admin.common.cancel")}
            </button>
          </div>
        </form>
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={t("confirm.deleteReplyTitle")}
        description={t("confirm.deleteReplyDesc")}
        confirmLabel={t("confirm.deleteReplyBtn")}
        tone="danger"
        busy={deleteReply.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteReply.mutateAsync(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </section>
  );
}

function SellerReviewsInner() {
  const { t } = useLanguage();
  const [productFilter, setProductFilter] = useState("");
  const { data, isLoading, isError, error } = useSellerProducts("ACTIVE", 1, 100);
  const products = useMemo(() => data?.items ?? [], [data?.items]);
  const selected = productFilter
    ? products.filter((p) => p.id === productFilter)
    : products.slice(0, 8);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-mq-text">{t("seller.titles.reviews")}</h1>
        <p className="text-sm text-mq-text-muted mt-1">{t("seller.titles.reviewsDesc")}</p>
      </div>

      {isError ? (
        <div className="mq-alert mq-alert-error">
          {getErrorMessage(error, t("admin.common.failed"))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3 items-center">
        <select
          className="mq-input max-w-md"
          value={productFilter}
          onChange={(e) => setProductFilter(e.target.value)}
          aria-label={t("seller.reviews.filterProduct")}
        >
          <option value="">{t("seller.reviews.allProducts")}</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title || p.name || p.id}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <TableSkeleton rows={4} cols={3} />
      ) : selected.length === 0 ? (
        <p className="text-sm text-mq-text-muted">{t("seller.reviews.empty")}</p>
      ) : (
        <div className="space-y-4">
          {selected.map((p) => (
            <SellerProductReviews
              key={p.id}
              productId={p.id}
              productTitle={p.title || p.name || p.id}
            />
          ))}
          {!productFilter && products.length > 8 ? (
            <p className="text-xs text-mq-text-muted">{t("seller.reviews.showingFirst")}</p>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function SellerReviewsPage() {
  return (
    <AuthGuard roles={["SELLER"]}>
      <SellerReviewsInner />
    </AuthGuard>
  );
}
