"use client";

import Image from "next/image";
import type { ProductReview } from "@/lib/api/reviews";
import { Stars } from "@/components/ui/shared";
import { useLanguage } from "@/components/providers/LanguageProvider";

export function ReviewList({
  items,
  emptyLabel,
}: {
  items: ProductReview[];
  emptyLabel?: string;
}) {
  const { t } = useLanguage();

  if (items.length === 0) {
    return (
      <p className="text-sm text-mq-text-muted py-6 text-center">
        {emptyLabel || t("product.reviewsPage.empty")}
      </p>
    );
  }

  return (
    <ul className="divide-y divide-mq-border">
      {items.map((review) => (
        <li key={review.id} className="py-5 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-mq-text">
              {review.buyer?.fullName?.trim() || t("product.reviewsPage.anonymous")}
            </span>
            <Stars rating={review.rating} />
            <span className="text-[11px] text-mq-text-muted ml-auto">
              {review.createdAt
                ? new Date(review.createdAt).toLocaleDateString()
                : ""}
            </span>
          </div>
          {review.comment ? (
            <p className="text-sm text-mq-text-secondary leading-relaxed whitespace-pre-wrap">
              {review.comment}
            </p>
          ) : null}
          {review.images?.length ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {review.images.map((src) => (
                <a
                  key={src}
                  href={src}
                  target="_blank"
                  rel="noreferrer"
                  className="relative w-16 h-16 rounded-[var(--mq-radius-sm)] overflow-hidden border border-mq-border mq-product-image-bg"
                >
                  <Image
                    src={src}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                </a>
              ))}
            </div>
          ) : null}
          {review.reply?.body ? (
            <div className="mt-2 rounded-[var(--mq-radius-sm)] border border-mq-border bg-mq-surface-subtle px-3 py-2 text-sm">
              <p className="text-[11px] font-medium text-mq-text-muted mb-1">
                {t("product.reviewsPage.sellerReply")}
              </p>
              <p className="text-mq-text-secondary whitespace-pre-wrap">{review.reply.body}</p>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
