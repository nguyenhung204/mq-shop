"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ShoppingBag } from "lucide-react";
import type { AdminChartRange } from "@/lib/api/admin-dashboard";
import { useAdminOrdersChart } from "@/lib/queries/admin";
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

export function AdminOrdersChart() {
  const { t } = useLanguage();
  const [range, setRange] = useState<AdminChartRange>("30d");
  const { data, isLoading, isError, error } = useAdminOrdersChart(range);

  const points = data?.current ?? [];
  const chartData = points.map((p) => ({
    label: formatXLabel(p.date, data?.groupBy ?? "day"),
    count: p.count,
  }));

  return (
    <AdminChartCard
      title={t("admin.overview.ordersChart")}
      icon={ShoppingBag}
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
          <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-mq-border, #e5e7eb)" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--color-mq-text-muted, #9ca3af)" />
            <YAxis tick={{ fontSize: 11 }} stroke="var(--color-mq-text-muted, #9ca3af)" />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="rounded-lg border border-mq-border bg-mq-surface p-2 shadow-sm text-xs">
                    <p className="font-medium text-mq-text mb-1">{label}</p>
                    <p className="tabular-nums">{payload[0]?.value} {t("admin.overview.orderCount")}</p>
                  </div>
                );
              }}
            />
            <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </AdminChartCard>
  );
}
