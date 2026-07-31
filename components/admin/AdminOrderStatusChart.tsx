"use client";

import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { PieChartIcon } from "lucide-react";
import type { AdminChartRange } from "@/lib/api/admin-dashboard";
import { useAdminOrderStatus } from "@/lib/queries/admin";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { translateStatus } from "@/lib/i18n/status";
import { Skeleton } from "@/components/ui/Skeleton";
import { AdminChartCard } from "./AdminChartCard";

const RANGE_OPTIONS = [
  { value: "7d", labelKey: "admin.overview.range7d" },
  { value: "30d", labelKey: "admin.overview.range30d" },
  { value: "12m", labelKey: "admin.overview.range12m" },
];

const STATUS_COLORS: Record<string, string> = {
  DELIVERED: "#22c55e",
  SHIPPED: "#3b82f6",
  CONFIRMED: "#8b5cf6",
  PAID: "#6366f1",
  PACKED: "#06b6d4",
  PENDING: "#f59e0b",
  CANCELLED: "#ef4444",
  REFUNDED: "#f97316",
};

function getColor(status: string, idx: number): string {
  return STATUS_COLORS[status] ?? ["#64748b", "#94a3b8", "#cbd5e1"][idx % 3];
}

export function AdminOrderStatusChart() {
  const { t } = useLanguage();
  const [range, setRange] = useState<AdminChartRange>("30d");
  const { data, isLoading, isError, error } = useAdminOrderStatus(range);

  const distribution = data?.distribution ?? [];
  const total = distribution.reduce((sum, d) => sum + d.count, 0);

  return (
    <AdminChartCard
      title={t("admin.overview.orderStatus")}
      icon={PieChartIcon}
      rangeOptions={RANGE_OPTIONS}
      range={range}
      onRangeChange={(v) => setRange(v as AdminChartRange)}
      isLoading={isLoading}
      isError={isError}
      error={error}
      isEmpty={distribution.length === 0}
      skeleton={<Skeleton className="h-[160px] rounded-lg" />}
    >
      <div className="flex items-center gap-4 px-4 pb-4">
        <div style={{ width: 160, height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={distribution}
                dataKey="count"
                nameKey="status"
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                strokeWidth={1}
              >
                {distribution.map((entry, idx) => (
                  <Cell key={entry.status} fill={getColor(entry.status, idx)} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0];
                  const count = Number(item?.value);
                  const pct = total > 0 ? ((count / total) * 100).toFixed(1) : "0.0";
                  return (
                    <div className="rounded-lg border border-mq-border bg-mq-surface p-2 shadow-sm text-xs">
                      <p className="font-medium">
                        {translateStatus(t, "order", String(item?.name))}
                      </p>
                      <p className="tabular-nums">
                        {count} ({pct}%)
                      </p>
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-1.5">
          {distribution.map((item, idx) => (
            <div key={item.status} className="flex items-center gap-2 text-xs">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ background: getColor(item.status, idx) }}
              />
              <span className="flex-1 text-mq-text-muted">
                {translateStatus(t, "order", item.status)}
              </span>
              <span className="tabular-nums font-medium">{item.count}</span>
            </div>
          ))}
        </div>
      </div>
    </AdminChartCard>
  );
}
