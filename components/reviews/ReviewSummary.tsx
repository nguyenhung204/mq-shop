"use client";

import { toRatingNumber, type ReviewSummary } from "@/lib/api/reviews";
import { Stars } from "@/components/ui/shared";
import { useLanguage } from "@/components/providers/LanguageProvider";

export function ReviewSummaryPanel({ summary }: { summary: ReviewSummary }) {
  const { t } = useLanguage();
  const avg = toRatingNumber(summary.ratingAvg);
  const count = Math.max(0, Number(summary.reviewCount) || 0);
  const breakdown = summary.breakdown ?? {};

  const counts = [5, 4, 3, 2, 1].map((star) => {
    const raw =
      (breakdown as Record<string, number>)[String(star)] ??
      (breakdown as Record<number, number>)[star] ??
      0;
    return { star, count: Number(raw) || 0 };
  });
  const maxBar = Math.max(1, ...counts.map((c) => c.count));

  return (
    <div className="flex flex-col sm:flex-row gap-6 sm:gap-10 items-start">
      <div className="text-center sm:text-left shrink-0">
        <p className="text-3xl font-semibold tabular-nums text-mq-text">
          {avg > 0 ? avg.toFixed(1) : "—"}
        </p>
        <div className="flex justify-center sm:justify-start mt-1">
          <Stars rating={avg} />
        </div>
        <p className="text-xs text-mq-text-muted mt-1">
          {t("product.reviewsPage.basedOn", { count: String(count) })}
        </p>
      </div>
      <div className="flex-1 w-full space-y-1.5 min-w-0">
        {counts.map(({ star, count: c }) => (
          <div key={star} className="flex items-center gap-2 text-xs">
            <span className="w-8 text-mq-text-muted tabular-nums">{star}★</span>
            <div className="flex-1 h-1.5 rounded-full bg-mq-surface-subtle overflow-hidden">
              <div
                className="h-full bg-mq-gold transition-all"
                style={{ width: `${(c / maxBar) * 100}%` }}
              />
            </div>
            <span className="w-8 text-right text-mq-text-muted tabular-nums">{c}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
