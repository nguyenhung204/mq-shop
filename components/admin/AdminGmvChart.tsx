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
import type { AdminChartRange } from "@/lib/api/admin-dashboard";
import { formatMoneyLocale } from "@/lib/i18n/locale-format";
import { useAdminGmvChart } from "@/lib/queries/admin";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { AdminChartCard } from "./AdminChartCard";

const RANGE_OPTIONS = [
  { value: "7d", labelKey: "admin.overview.range7d" },
  { value: "30d", labelKey: "admin.overview.range30d" },
  { value: "12m", labelKey: "admin.overview.range12m" },
];

function formatXLabel(iso: string, groupBy: string): string {
  const d = new Date(iso);
  if (groupBy === "month") return `${d.getMonth() + 1}/${d.getFullYear().toString().slice(-2)}`;
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return String(value);
}

export function AdminGmvChart() {
  const { t, locale } = useLanguage();
  const [range, setRange] = useState<AdminChartRange>("30d");
  const { data, isLoading, isError, error } = useAdminGmvChart(range);

  const points = data?.current ?? [];
  const chartData = points.map((p) => ({
    label: formatXLabel(p.date, data?.groupBy ?? "day"),
    gmv: parseFloat(p.gmv),
    orderCount: p.orderCount,
  }));

  return (
    <AdminChartCard
      title={t("admin.overview.gmvChart")}
      icon={TrendingUp}
      rangeOptions={RANGE_OPTIONS}
      range={range}
      onRangeChange={(v) => setRange(v as AdminChartRange)}
      isLoading={isLoading}
      isError={isError}
      error={error}
      isEmpty={points.length === 0}
    >
      <div className="px-2 pb-4" style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="adminGmvGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-mq-border, #e5e7eb)" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--color-mq-text-muted, #9ca3af)" />
            <YAxis tick={{ fontSize: 11 }} stroke="var(--color-mq-text-muted, #9ca3af)" tickFormatter={formatCompact} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const gmv = payload[0]?.value;
                return (
                  <div className="rounded-lg border border-mq-border bg-mq-surface p-2 shadow-sm text-xs">
                    <p className="font-medium text-mq-text mb-1">{label}</p>
                    <p className="tabular-nums">{formatMoneyLocale(String(gmv ?? 0), locale)}</p>
                  </div>
                );
              }}
            />
            <Area type="monotone" dataKey="gmv" stroke="#3b82f6" strokeWidth={2} fill="url(#adminGmvGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </AdminChartCard>
  );
}
