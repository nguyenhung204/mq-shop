"use client";

import { useState } from "react";
import { Store } from "lucide-react";
import type { TopShopsRange } from "@/lib/api/admin-dashboard";
import { formatMoneyLocale } from "@/lib/i18n/locale-format";
import { useAdminTopShops } from "@/lib/queries/admin";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { Skeleton } from "@/components/ui/Skeleton";
import { AdminChartRangeSelector } from "./AdminChartRangeSelector";

const RANGE_OPTIONS = [
  { value: "7d", labelKey: "admin.overview.range7d" },
  { value: "30d", labelKey: "admin.overview.range30d" },
  { value: "90d", labelKey: "admin.overview.range90d" },
];

export function AdminTopShops() {
  const { t, locale } = useLanguage();
  const [range, setRange] = useState<TopShopsRange>("30d");
  const { data, isLoading } = useAdminTopShops(range, 10);

  if (isLoading) {
    return (
      <div className="mq-card p-4">
        <Skeleton className="h-4 w-32 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="mq-card p-4">
        <h3 className="text-sm font-semibold text-mq-text flex items-center gap-2">
          <Store size={15} strokeWidth={1.75} aria-hidden />
          {t("admin.overview.topShops")}
        </h3>
        <p className="text-xs text-mq-text-muted mt-2">{t("admin.overview.noChartData")}</p>
      </div>
    );
  }

  const maxRevenue = Math.max(...data.items.map((i) => parseFloat(i.revenue)));

  return (
    <div className="mq-card">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 pb-2">
        <div>
          <h3 className="text-sm font-semibold text-mq-text flex items-center gap-2">
            <Store size={15} strokeWidth={1.75} aria-hidden />
            {t("admin.overview.topShops")}
          </h3>
          <p className="text-xs text-mq-text-muted mt-0.5">
            {t("admin.overview.topShopsDesc")}
          </p>
        </div>
        <AdminChartRangeSelector
          options={RANGE_OPTIONS}
          value={range}
          onChange={(v) => setRange(v as TopShopsRange)}
        />
      </div>

      <div className="px-4 pb-4 space-y-2">
        {data.items.map((item, idx) => {
          const pct = maxRevenue > 0 ? (parseFloat(item.revenue) / maxRevenue) * 100 : 0;
          return (
            <div key={item.shopId} className="flex items-center gap-3 text-xs">
              <span className="w-5 text-right tabular-nums text-mq-text-muted font-medium">
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="truncate font-medium text-mq-text">{item.shopName}</span>
                  <span className="tabular-nums text-mq-text-muted ml-2 shrink-0">
                    {formatMoneyLocale(item.revenue, locale)}
                  </span>
                </div>
                <div className="h-1.5 bg-mq-surface rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
