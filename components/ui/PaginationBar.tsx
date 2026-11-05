"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PageMeta } from "@/lib/api/types";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { calculateRange, getPageNumbers } from "@/lib/ui/pagination";

export { calculateRange, getPageNumbers };

export interface PaginationBarProps {
  page: number;
  meta?: PageMeta | null;
  onPageChange: (page: number) => void;
  className?: string;
  variant?: "default" | "storefront";
  showPageNumbers?: boolean;
  showRangeInfo?: boolean;
}

export function PaginationBar({
  page,
  meta,
  onPageChange,
  className = "",
  variant = "default",
  showPageNumbers,
  showRangeInfo,
}: PaginationBarProps) {
  const { t } = useLanguage();

  const isStorefront = variant === "storefront";
  const displayNumbers = showPageNumbers ?? isStorefront;
  const displayRange = showRangeInfo ?? isStorefront;

  const pageNumbers = useMemo(() => {
    if (!meta || meta.totalPages <= 1) return [];
    return getPageNumbers(page, meta.totalPages);
  }, [page, meta?.totalPages]);

  if (!meta || meta.totalPages <= 1) return null;

  const total = meta.total ?? 0;
  const pageSize = meta.pageSize ?? 8;
  const { from, to } = calculateRange(page, pageSize, total);

  // If classic default variant without storefront styling
  if (!displayNumbers && !displayRange) {
    return (
      <div className={`flex flex-wrap items-center justify-center gap-3 pt-2 ${className}`.trim()}>
        <button
          type="button"
          className="mq-btn mq-btn-outline text-xs"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label={t("admin.common.prev")}
        >
          {t("admin.common.prev")}
        </button>
        <span className="text-sm text-mq-text-muted">
          {page} / {meta.totalPages}
          {typeof meta.total === "number" ? (
            <span className="text-mq-text-muted/80">
              {" "}
              · {t("admin.common.items", { count: String(meta.total) })}
            </span>
          ) : null}
        </span>
        <button
          type="button"
          className="mq-btn mq-btn-outline text-xs"
          disabled={page >= meta.totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label={t("admin.common.next")}
        >
          {t("admin.common.next")}
        </button>
      </div>
    );
  }

  return (
    <nav
      className={`flex flex-col items-center gap-3 pt-4 ${className}`.trim()}
      aria-label={t("shop.page") || "Pagination"}
    >
      {/* Range Info */}
      {displayRange && total > 0 && (
        <p className="text-xs sm:text-sm text-mq-text-muted text-center font-normal">
          {t("shop.showingRange", {
            from: String(from),
            to: String(to),
            total: String(total),
          })}
        </p>
      )}

      {/* Navigation controls */}
      <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
        {/* Prev button */}
        <button
          type="button"
          className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs sm:text-sm rounded-[var(--mq-radius-sm)] border border-mq-border bg-mq-surface text-mq-text transition-all duration-200 ${
            page <= 1
              ? "opacity-35 cursor-not-allowed border-dashed pointer-events-none"
              : "hover:border-mq-gold/70 hover:text-mq-gold hover:shadow-sm"
          }`}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label={t("shop.prev") || "Previous"}
        >
          <ChevronLeft size={16} strokeWidth={1.75} />
          <span className="hidden sm:inline">{t("shop.prev") || "Previous"}</span>
        </button>

        {/* Numbered Page Buttons */}
        {displayNumbers &&
          pageNumbers.map((num, idx) => {
            if (num === "...") {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-2 py-1 text-xs text-mq-text-muted select-none"
                  aria-hidden="true"
                >
                  …
                </span>
              );
            }

            const isActive = num === page;
            return (
              <button
                key={`page-${num}`}
                type="button"
                className={`min-w-[34px] sm:min-w-[38px] h-[34px] sm:h-[38px] px-2.5 text-xs sm:text-sm rounded-[var(--mq-radius-sm)] border transition-all duration-200 flex items-center justify-center ${
                  isActive
                    ? "bg-mq-gold text-black font-semibold border-mq-gold shadow-[0_2px_8px_rgba(255,210,29,0.3)]"
                    : "border-mq-border bg-mq-surface text-mq-text hover:border-mq-gold/70 hover:text-mq-gold hover:shadow-sm"
                }`}
                aria-current={isActive ? "page" : undefined}
                aria-label={`${t("shop.page") || "Page"} ${num}`}
                onClick={() => onPageChange(num)}
              >
                {num}
              </button>
            );
          })}

        {/* Next button */}
        <button
          type="button"
          className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs sm:text-sm rounded-[var(--mq-radius-sm)] border border-mq-border bg-mq-surface text-mq-text transition-all duration-200 ${
            page >= meta.totalPages
              ? "opacity-35 cursor-not-allowed border-dashed pointer-events-none"
              : "hover:border-mq-gold/70 hover:text-mq-gold hover:shadow-sm"
          }`}
          disabled={page >= meta.totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label={t("shop.next") || "Next"}
        >
          <span className="hidden sm:inline">{t("shop.next") || "Next"}</span>
          <ChevronRight size={16} strokeWidth={1.75} />
        </button>
      </div>
    </nav>
  );
}
