"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp } from "lucide-react";
import type { RevenueChartRange, RevenueTimePoint } from "@/lib/api/seller-dashboard";
import { formatMoneyLocale } from "@/lib/i18n/locale-format";
import type { Locale } from "@/lib/i18n/types";
import { useSellerRevenueChart } from "@/lib/queries/seller";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { Skeleton } from "@/components/ui/Skeleton";
import { getErrorMessage } from "@/lib/queries/utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RANGES: RevenueChartRange[] = ["7d", "30d", "12m"];

const RANGE_LABEL_KEY: Record<RevenueChartRange, string> = {
  "7d": "seller.dashboard.range7d",
  "30d": "seller.dashboard.range30d",
  "12m": "seller.dashboard.range12m",
};

function formatXLabel(iso: string, groupBy: string): string {
  const d = new Date(iso);
  if (groupBy === "month") {
    return `${d.getMonth() + 1}/${d.getFullYear().toString().slice(-2)}`;
  }
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function buildChartData(
  current: RevenueTimePoint[],
  previous?: RevenueTimePoint[],
  groupBy = "day",
) {
  return current.map((point, i) => ({
    label: formatXLabel(point.date, groupBy),
    current: parseFloat(point.revenue),
    orders: point.orderCount,
    previous: previous?.[i] ? parseFloat(previous[i].revenue) : undefined,
  }));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SellerRevenueChart() {
  const { t, locale } = useLanguage();
  const [range, setRange] = useState<RevenueChartRange>("30d");
  const [compare, setCompare] = useState(false);
  const { data, isLoading, isError, error } = useSellerRevenueChart(range, compare);

  if (isLoading) {
    return (
      <div className="mq-seller-panel !min-h-0 p-4">
        <Skeleton className="h-4 w-40 mb-4" />
        <Skeleton className="h-[200px] rounded-lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mq-alert mq-alert-error text-sm">
        {getErrorMessage(error, t("seller.dashboard.error"))}
      </div>
    );
  }

  if (!data || data.current.length === 0) return null;

  const chartData = buildChartData(data.current, data.previous, data.groupBy);

  return (
    <div className="mq-seller-panel !min-h-0">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 pb-2">
        <h3 className="text-sm font-semibold text-mq-text flex items-center gap-2">
          <TrendingUp size={15} strokeWidth={1.75} aria-hidden />
          {t("seller.dashboard.revenueChart")}
        </h3>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-mq-border overflow-hidden text-xs">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                className={`px-2.5 py-1 transition-colors ${
                  r === range
                    ? "bg-[#e7ba0a] text-black font-medium"
                    : "text-mq-text-muted hover:bg-mq-surface"
                }`}
                onClick={() => setRange(r)}
              >
                {t(RANGE_LABEL_KEY[r])}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-1 text-xs text-mq-text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={compare}
              onChange={(e) => setCompare(e.target.checked)}
              className="accent-[#e7ba0a]"
            />
            {t("seller.dashboard.comparePrevious")}
          </label>
        </div>
      </div>

      <div className="px-2 pb-4" style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorCurrent" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#e7ba0a" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#e7ba0a" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorPrevious" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-mq-border, #e5e7eb)" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11 }}
              stroke="var(--color-mq-text-muted, #9ca3af)"
            />
            <YAxis
              tick={{ fontSize: 11 }}
              stroke="var(--color-mq-text-muted, #9ca3af)"
              tickFormatter={(v: number) => formatCompact(v)}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <ChartTooltip
                    label={label as string}
                    payload={payload as ReadonlyArray<{ value?: number | string; name?: string; dataKey?: string | number }>}
                    locale={locale}
                    t={t}
                  />
                );
              }}
            />
            {compare && data.previous && (
              <Area
                type="monotone"
                dataKey="previous"
                stroke="#94a3b8"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                fill="url(#colorPrevious)"
                name={t("seller.dashboard.previousPeriod")}
              />
            )}
            <Area
              type="monotone"
              dataKey="current"
              stroke="#e7ba0a"
              strokeWidth={2}
              fill="url(#colorCurrent)"
              name={t("seller.dashboard.currentPeriod")}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return String(value);
}

function ChartTooltip({
  label,
  payload,
  locale,
  t,
}: {
  label: string;
  payload: ReadonlyArray<{ value?: number | string; name?: string; dataKey?: string | number }>;
  locale: Locale | null;
  t: (key: string) => string;
}) {
  return (
    <div className="rounded-lg border border-mq-border bg-mq-surface p-2 shadow-sm text-xs">
      <p className="font-medium text-mq-text mb-1">{label}</p>
      {payload.map((entry) => {
        const isCurrent = entry.dataKey === "current";
        return (
          <p
            key={String(entry.dataKey)}
            className="flex items-center gap-2"
          >
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ background: isCurrent ? "#e7ba0a" : "#94a3b8" }}
            />
            <span className="text-mq-text-muted">{entry.name}:</span>
            <span className="font-medium tabular-nums">
              {formatMoneyLocale(String(entry.value ?? 0), locale)}
            </span>
          </p>
        );
      })}
    </div>
  );
}
