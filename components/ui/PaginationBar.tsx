"use client";

import type { PageMeta } from "@/lib/api/types";
import { useLanguage } from "@/components/providers/LanguageProvider";

export function PaginationBar({
  page,
  meta,
  onPageChange,
  className = "",
}: {
  page: number;
  meta?: PageMeta | null;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  const { t } = useLanguage();
  if (!meta || meta.totalPages <= 1) return null;

  return (
    <div className={`flex flex-wrap items-center justify-center gap-3 pt-2 ${className}`.trim()}>
      <button
        type="button"
        className="mq-btn mq-btn-outline text-xs"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
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
      >
        {t("admin.common.next")}
      </button>
    </div>
  );
}
