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
import { Users } from "lucide-react";
import type { AdminChartRange } from "@/lib/api/admin-dashboard";
import { useAdminNewUsersChart } from "@/lib/queries/admin";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { Skeleton } from "@/components/ui/Skeleton";
import { AdminChartRangeSelector } from "./AdminChartRangeSelector";

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

export function AdminNewUsersChart() {
  const { t } = useLanguage();
  const [range, setRange] = useState<AdminChartRange>("30d");
  const { data, isLoading } = useAdminNewUsersChart(range);

  if (isLoading) {
    return (
      <div className="mq-card p-4">
        <Skeleton className="h-4 w-32 mb-4" />
        <Skeleton className="h-[180px] rounded-lg" />
      </div>
    );
  }

  if (!data || data.current.length === 0) {
    return (
      <div className="mq-card p-4">
        <h3 className="text-sm font-semibold text-mq-text flex items-center gap-2">
          <Users size={15} strokeWidth={1.75} aria-hidden />
          {t("admin.overview.newUsersChart")}
        </h3>
        <p className="text-xs text-mq-text-muted mt-2">{t("admin.overview.noChartData")}</p>
      </div>
    );
  }

  const chartData = data.current.map((p) => ({
    label: formatXLabel(p.date, data.groupBy),
    count: p.count,
  }));

  return (
    <div className="mq-card">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 pb-2">
        <h3 className="text-sm font-semibold text-mq-text flex items-center gap-2">
          <Users size={15} strokeWidth={1.75} aria-hidden />
          {t("admin.overview.newUsersChart")}
        </h3>
        <AdminChartRangeSelector
          options={RANGE_OPTIONS}
          value={range}
          onChange={(v) => setRange(v as AdminChartRange)}
        />
      </div>
      <div className="px-2 pb-4" style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="adminUsersGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-mq-border, #e5e7eb)" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--color-mq-text-muted, #9ca3af)" />
            <YAxis tick={{ fontSize: 11 }} stroke="var(--color-mq-text-muted, #9ca3af)" allowDecimals={false} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="rounded-lg border border-mq-border bg-mq-surface p-2 shadow-sm text-xs">
                    <p className="font-medium text-mq-text mb-1">{label}</p>
                    <p className="tabular-nums">{payload[0]?.value} {t("admin.overview.newUsersChart")}</p>
                  </div>
                );
              }}
            />
            <Area type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2} fill="url(#adminUsersGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
