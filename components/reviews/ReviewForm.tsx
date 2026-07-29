"use client";

import { FormEvent, useState } from "react";
import { X } from "lucide-react";
import { ReviewStarsInput } from "@/components/reviews/ReviewStarsInput";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { getErrorMessage } from "@/lib/queries/utils";
import {
  useCreateReview,
  useDeleteReview,
  useUpdateReview,
} from "@/lib/queries/reviews";
import type { ProductReview } from "@/lib/api/reviews";

const MAX_IMAGES = 5;
const MAX_BYTES = 5 * 1024 * 1024;

export function ReviewForm({
  productId,
  orderId,
  existing,
  onDone,
  onCancel,
}: {
  productId: string;
  orderId?: string;
  existing?: ProductReview | null;
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const { t, locale } = useLanguage();
  const createReview = useCreateReview(productId);
  const updateReview = useUpdateReview(productId);
  const deleteReview = useDeleteReview(productId);
  const [rating, setRating] = useState(existing?.rating ?? 5);
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [files, setFiles] = useState<File[]>([]);
  const [localError, setLocalError] = useState("");

  const busy =
    createReview.isPending || updateReview.isPending || deleteReview.isPending;

  const onFiles = (list: FileList | null) => {
    if (!list?.length) return;
    const next: File[] = [...files];
    for (const file of Array.from(list)) {
      if (next.length >= MAX_IMAGES) break;
      if (!file.type.startsWith("image/")) {
        setLocalError(t("product.reviewsPage.invalidImage"));
        continue;
      }
      if (file.size > MAX_BYTES) {
        setLocalError(t("product.reviewsPage.imageTooLarge"));
        continue;
      }
      next.push(file);
    }
    setFiles(next.slice(0, MAX_IMAGES));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError("");
    if (rating < 1 || rating > 5) {
      setLocalError(t("product.reviewsPage.ratingRequired"));
      return;
    }
    try {
      if (existing) {
        await updateReview.mutateAsync({
          reviewId: existing.id,
          body: { rating, comment: comment.trim() || undefined },
          images: files.length ? files : undefined,
        });
      } else {
        await createReview.mutateAsync({
          body: {
            rating,
            comment: comment.trim() || undefined,
            orderId,
          },
          images: files.length ? files : undefined,
        });
      }
      setFiles([]);
      onDone?.();
    } catch (err) {
      const fallback = existing ? t("toast.reviewUpdateFailed") : t("toast.reviewCreateFailed");
      setLocalError(getErrorMessage(err, fallback, locale));
    }
  };

  const onDelete = async () => {
    if (!existing) return;
    if (
      typeof window !== "undefined" &&
      !window.confirm(t("product.reviewsPage.deleteConfirm"))
    ) {
      return;
    }
    try {
      await deleteReview.mutateAsync(existing.id);
      onDone?.();
    } catch {
      /* toast */
    }
  };

  return (
    <form className="space-y-3" onSubmit={(e) => void onSubmit(e)}>
      <div>
        <p className="text-xs font-medium text-mq-text-muted mb-1.5">
          {t("product.reviewsPage.rating")}
        </p>
        <ReviewStarsInput value={rating} onChange={setRating} />
      </div>
      <div>
        <label className="block text-xs font-medium text-mq-text-muted mb-1.5">
          {t("product.reviewsPage.comment")} ({t("admin.common.optional")})
        </label>
        <textarea
          className="mq-input min-h-[5rem]"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={2000}
          placeholder={t("product.reviewsPage.commentPh")}
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-mq-text-muted mb-1.5">
          {t("product.reviewsPage.photos")} ({t("product.reviewsPage.photosHint")})
        </label>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          className="mq-input text-xs"
          onChange={(e) => {
            onFiles(e.target.files);
            e.target.value = "";
          }}
        />
        {files.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-2">
            {files.map((f, i) => (
              <li
                key={`${f.name}-${i}`}
                className="text-[11px] flex items-center gap-1 rounded-md border border-mq-border px-2 py-1"
              >
                <span className="truncate max-w-[8rem]">{f.name}</span>
                <button
                  type="button"
                  className="text-mq-text-muted hover:text-mq-text"
                  aria-label={t("admin.common.close")}
                  onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                >
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {localError ? <p className="text-xs text-mq-accent-pink">{localError}</p> : null}
      <div className="flex flex-wrap gap-2 pt-1">
        <button type="submit" className="mq-btn mq-btn-primary text-sm" disabled={busy}>
          {busy
            ? t("admin.common.working")
            : existing
              ? t("product.reviewsPage.save")
              : t("product.reviewsPage.submit")}
        </button>
        {existing ? (
          <button
            type="button"
            className="mq-btn mq-btn-outline text-sm"
            disabled={busy}
            onClick={() => void onDelete()}
          >
            {t("product.reviewsPage.delete")}
          </button>
        ) : null}
        {onCancel ? (
          <button
            type="button"
            className="mq-btn mq-btn-outline text-sm"
            disabled={busy}
            onClick={onCancel}
          >
            {t("admin.common.cancel")}
          </button>
        ) : null}
      </div>
    </form>
  );
}
