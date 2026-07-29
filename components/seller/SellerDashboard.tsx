"use client";

import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  Package,
  RotateCcw,
  ShoppingBag,
  Truck,
  XCircle,
} from "lucide-react";
import { formatDateTimeLocale, formatMoneyLocale } from "@/lib/i18n/locale-format";
import type { Locale } from "@/lib/i18n/types";
import type { DashboardSummary, LowStockItem } from "@/lib/api/seller-dashboard";
import { useSellerDashboard } from "@/lib/queries/seller";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { Skeleton } from "@/components/ui/Skeleton";
import { getErrorMessage } from "@/lib/queries/utils";

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading dashboard">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-40 rounded-xl" />
    </div>
  );
}

function GrowthBadge({
  percent,
  naLabel,
}: {
  percent: number | null;
  naLabel: string;
}) {
  if (percent === null) {
    return (
      <span className="text-xs text-mq-text-muted">{naLabel}</span>
    );
  }
  const positive = percent >= 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium ${
        positive ? "text-green-600" : "text-red-500"
      }`}
    >
      <Icon size={14} strokeWidth={2} aria-hidden />
      {Math.abs(percent).toFixed(1)}%
    </span>
  );
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  icon: typeof ShoppingBag;
}) {
  return (
    <div className="mq-seller-panel !min-h-0 flex flex-col gap-1 p-4">
      <div className="flex items-center gap-2 text-mq-text-muted">
        <Icon size={15} strokeWidth={1.75} aria-hidden />
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-lg font-semibold tabular-nums text-mq-text">{value}</p>
      {sub}
    </div>
  );
}

function SummarySection({
  summary,
  locale,
  t,
}: {
  summary: DashboardSummary;
  locale: Locale | null;
  t: (key: string, vars?: Record<string, string>) => string;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      <KpiCard
        label={t("seller.dashboard.revenueThisMonth")}
        value={formatMoneyLocale(summary.revenueThisMonth, locale)}
        icon={Truck}
        sub={
          <GrowthBadge
            percent={summary.revenueGrowthPercent}
            naLabel={t("seller.dashboard.growthNA")}
          />
        }
      />
      <KpiCard
        label={t("seller.dashboard.totalOrders")}
        value={String(summary.totalOrders)}
        icon={ShoppingBag}
      />
      <KpiCard
        label={t("seller.dashboard.delivered")}
        value={String(summary.deliveredOrders)}
        icon={Package}
      />
      <KpiCard
        label={t("seller.dashboard.cancelled")}
        value={String(summary.cancelledOrders)}
        icon={XCircle}
      />
      <KpiCard
        label={t("seller.dashboard.rmaRate")}
        value={
          summary.rmaRate.rmaRatePercent !== null
            ? `${summary.rmaRate.rmaRatePercent.toFixed(1)}%`
            : t("seller.dashboard.growthNA")
        }
        icon={RotateCcw}
        sub={
          summary.rmaRate.rmaRatePercent !== null && summary.rmaRate.rmaRatePercent > 5 ? (
            <span className="text-xs text-red-500 font-medium">
              {t("seller.dashboard.rmaWarning")}
            </span>
          ) : undefined
        }
      />
    </div>
  );
}

function LowStockSection({
  items,
  total,
  threshold,
  locale,
  t,
}: {
  items: LowStockItem[];
  total: number;
  threshold: number;
  locale: Locale | null;
  t: (key: string, vars?: Record<string, string>) => string;
}) {
  const remaining = total - items.length;

  return (
    <div className="mq-seller-panel !min-h-0">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div>
          <h3 className="text-sm font-semibold text-mq-text flex items-center gap-2">
            <Boxes size={15} strokeWidth={1.75} aria-hidden />
            {t("seller.dashboard.lowStock")}
          </h3>
          <p className="text-xs text-mq-text-muted mt-0.5">
            {t("seller.dashboard.lowStockDesc")} (&lt;{threshold})
          </p>
        </div>
        <Link
          href="/seller/inventory"
          className="text-xs text-[#e7ba0a] hover:underline"
        >
          {t("seller.dashboard.viewInventory")}
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-label={t("seller.dashboard.lowStock")}>
          <thead>
            <tr className="border-b border-mq-border text-xs text-mq-text-muted">
              <th className="text-left px-4 py-2 font-medium">
                {t("seller.dashboard.sku")}
              </th>
              <th className="text-left px-4 py-2 font-medium">
                {t("seller.dashboard.product")}
              </th>
              <th className="text-right px-4 py-2 font-medium">
                {t("seller.dashboard.stock")}
              </th>
              <th className="text-right px-4 py-2 font-medium">
                {t("seller.dashboard.reserved")}
              </th>
              <th className="text-right px-4 py-2 font-medium">
                {t("seller.dashboard.price")}
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.variantId}
                className="border-b border-mq-border last:border-0"
              >
                <td className="px-4 py-2 font-mono text-xs">{item.sku}</td>
                <td className="px-4 py-2 max-w-[200px] truncate">
                  {item.productTitle}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  <span
                    className={
                      item.availableStock === 0
                        ? "text-red-500 font-medium"
                        : "text-orange-500"
                    }
                  >
                    {item.availableStock}
                  </span>
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-mq-text-muted">
                  {item.reservedStock}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {formatMoneyLocale(item.sellingPrice, locale)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {remaining > 0 && (
        <p className="text-xs text-mq-text-muted px-4 pb-3 pt-1">
          {t("seller.dashboard.andMore", { count: String(remaining) })}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function SellerDashboard() {
  const { t, locale } = useLanguage();
  const { data, isLoading, isError, error } = useSellerDashboard();

  if (isLoading) return <DashboardSkeleton />;

  if (isError) {
    return (
      <div className="mq-alert mq-alert-error text-sm">
        {getErrorMessage(error, t("seller.dashboard.error"))}
      </div>
    );
  }

  const summary = data?.summary;
  const lowStock = data?.lowStock;
  const generatedAt = data?.generatedAt;

  if (!summary && !lowStock) {
    return (
      <p className="text-sm text-mq-text-muted">{t("seller.dashboard.noData")}</p>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-mq-text">
          {t("seller.dashboard.title")}
        </h2>
        {generatedAt && (
          <p className="text-[11px] text-mq-text-muted">
            {t("seller.dashboard.updatedAt", {
              time: formatDateTimeLocale(generatedAt, locale),
            })}
          </p>
        )}
      </div>

      {summary && <SummarySection summary={summary} locale={locale} t={t} />}

      {lowStock && lowStock.items.length > 0 && (
        <LowStockSection
          items={lowStock.items}
          total={lowStock.total}
          threshold={lowStock.threshold}
          locale={locale}
          t={t}
        />
      )}
    </section>
  );
}
