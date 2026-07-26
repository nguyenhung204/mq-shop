"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import type { FeaturedReview } from "@/lib/api/reviews";
import { useFeaturedReviews } from "@/lib/queries/reviews";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { Container, SectionHeading, Stars } from "@/components/ui/shared";

const AUTO_SCROLL_MS = 3000;

function displayComment(comment: string | null | undefined): string {
  if (!comment) return "";
  return comment.replace(/^\[SEED\]\s*/i, "").trim();
}

function ReviewCard({ review }: { review: FeaturedReview }) {
  const { t, locale } = useLanguage();
  const productHref = `/product/${review.product.id}`;
  const buyer =
    review.buyer?.fullName?.trim() || t("product.reviewsPage.anonymous");
  const comment = displayComment(review.comment);
  const date = review.createdAt
    ? new Date(review.createdAt).toLocaleDateString(locale ?? "en")
    : "";

  return (
    <blockquote
      data-review-card
      className="shrink-0 w-[min(100%,20rem)] md:w-[22rem] snap-start bg-mq-surface p-6 md:p-8 border border-mq-border rounded-[var(--mq-radius-lg)] flex flex-col gap-4"
    >
      <div className="flex items-center gap-2">
        <Stars rating={review.rating} />
        <time className="text-[11px] text-mq-text-muted ml-auto">{date}</time>
      </div>

      {comment ? (
        <p className="text-mq-text-secondary text-sm leading-relaxed line-clamp-5 flex-1">
          &ldquo;{comment}&rdquo;
        </p>
      ) : null}

      <footer className="space-y-3 pt-1 border-t border-mq-border">
        <p className="text-sm font-medium text-mq-text">{buyer}</p>
        <Link
          href={productHref}
          className="flex items-center gap-3 group min-w-0"
        >
          <span className="relative w-11 h-11 shrink-0 rounded-[var(--mq-radius-sm)] overflow-hidden border border-mq-border mq-product-image-bg">
            {review.product.thumbnailUrl ? (
              <Image
                src={review.product.thumbnailUrl}
                alt=""
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                sizes="44px"
              />
            ) : null}
          </span>
          <span className="min-w-0">
            <span className="block text-sm text-mq-text truncate group-hover:underline">
              {review.product.title}
            </span>
            {review.product.reviewCount != null && review.product.reviewCount > 0 ? (
              <span className="text-[11px] text-mq-text-muted">
                {t("home.productReviewMeta", {
                  avg: String(
                    Number(review.product.ratingAvg ?? 0).toFixed(1),
                  ),
                  count: String(review.product.reviewCount),
                })}
              </span>
            ) : null}
          </span>
        </Link>
      </footer>
    </blockquote>
  );
}

function ReviewsAutoTrack({ reviews }: { reviews: FeaturedReview[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pause = () => {
    pausedRef.current = true;
    if (resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
  };

  const resume = (delayMs = 0) => {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    if (delayMs <= 0) {
      pausedRef.current = false;
      return;
    }
    resumeTimerRef.current = setTimeout(() => {
      pausedRef.current = false;
      resumeTimerRef.current = null;
    }, delayMs);
  };

  useEffect(() => {
    const el = trackRef.current;
    if (!el || reviews.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const stepSize = () => {
      const first = el.querySelector<HTMLElement>("[data-review-card]");
      if (!first) return 0;
      const styles = window.getComputedStyle(el);
      const gap = Number.parseFloat(styles.columnGap || styles.gap || "16") || 16;
      return first.offsetWidth + gap;
    };

    const id = window.setInterval(() => {
      if (pausedRef.current) return;
      const step = stepSize();
      if (step <= 0) return;

      // Duplicated list: wrap seamlessly once past the first half
      const half = el.scrollWidth / 2;
      if (half > 0 && el.scrollLeft >= half - 2) {
        el.scrollLeft -= half;
      }

      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return;

      if (el.scrollLeft + step >= max - 2) {
        el.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        el.scrollBy({ left: step, behavior: "smooth" });
      }
    }, AUTO_SCROLL_MS);

    return () => {
      window.clearInterval(id);
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    };
  }, [reviews]);

  // Duplicate for seamless loop
  const loop = reviews.length > 1 ? [...reviews, ...reviews] : reviews;

  return (
    <div
      ref={trackRef}
      className="mq-carousel-track gap-4 snap-x snap-mandatory"
      onMouseEnter={pause}
      onMouseLeave={() => resume()}
      onFocusCapture={pause}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          resume();
        }
      }}
      onTouchStart={pause}
      onTouchEnd={() => resume(1500)}
      onPointerDown={(e) => {
        if (e.pointerType === "mouse") return;
        pause();
      }}
      onPointerUp={(e) => {
        if (e.pointerType === "mouse") return;
        resume(1500);
      }}
    >
      {loop.map((review, i) => (
        <ReviewCard key={`${review.id}-${i}`} review={review} />
      ))}
    </div>
  );
}

export function FeaturedReviews() {
  const { t } = useLanguage();
  const { data = [], isLoading, isError } = useFeaturedReviews(4, 12);

  return (
    <section className="py-14 md:py-20 bg-mq-surface-subtle">
      <Container>
        <SectionHeading label={t("home.reviews")} title={t("home.whatClientsSay")} />

        {isLoading ? (
          <div className="mq-carousel-track gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="shrink-0 w-[min(100%,20rem)] md:w-[22rem] h-56 rounded-[var(--mq-radius-lg)] bg-mq-surface animate-pulse border border-mq-border"
              />
            ))}
          </div>
        ) : isError || data.length === 0 ? (
          <p className="text-sm text-mq-text-muted text-center py-8">
            {t("home.noReviews")}
          </p>
        ) : (
          <ReviewsAutoTrack reviews={data} />
        )}
      </Container>
    </section>
  );
}
