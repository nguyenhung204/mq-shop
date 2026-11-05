"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { Skeleton } from "@/components/ui/Skeleton";
import { getErrorMessage } from "@/lib/queries/utils";
import { AdminChartRangeSelector } from "./AdminChartRangeSelector";

type RangeOption = { value: string; labelKey: string };

/**
 * Shared shell for the admin dashboard charts.
 *
 * The header — including the range selector — is always rendered, so switching
 * to a range with no data (or a failing request) cannot make the control
 * disappear and leave the user stuck on an apparently blank card.
 */
export function AdminChartCard({
  title,
  description,
  icon: Icon,
  rangeOptions,
  range,
  onRangeChange,
  isLoading,
  isError,
  error,
  isEmpty,
  skeleton,
  children,
}: {
  title: string;
  description?: string;
  icon: LucideIcon;
  rangeOptions?: RangeOption[];
  range?: string;
  onRangeChange?: (value: string) => void;
  isLoading?: boolean;
  isError?: boolean;
  error?: unknown;
  isEmpty?: boolean;
  /** Body placeholder while loading; defaults to a single block. */
  skeleton?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useLanguage();

  const body = () => {
    if (isLoading) {
      return skeleton ?? <Skeleton className="h-[180px] rounded-lg" />;
    }
    if (isError) {
      return (
        <p className="text-xs text-red-500 py-2">
          {getErrorMessage(error, t("admin.common.failed"))}
        </p>
      );
    }
    if (isEmpty) {
      return (
        <p className="text-xs text-mq-text-muted py-2">
          {t("admin.overview.noChartData")}
        </p>
      );
    }
    return children;
  };

  const showPlaceholder = isLoading || isError || isEmpty;

  return (
    <div className="mq-card">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 pt-3 pb-1.5">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-mq-text flex items-center gap-2">
            <Icon size={14} strokeWidth={1.75} aria-hidden />
            {title}
          </h3>
          {description ? (
            <p className="text-[11px] text-mq-text-muted mt-0.5">{description}</p>
          ) : null}
        </div>
        {rangeOptions && range && onRangeChange ? (
          <AdminChartRangeSelector
            options={rangeOptions}
            value={range}
            onChange={onRangeChange}
          />
        ) : null}
      </div>
      <div className={showPlaceholder ? "px-3.5 pb-3" : undefined}>{body()}</div>
    </div>
  );
}
