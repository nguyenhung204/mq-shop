"use client";

import { useState } from "react";
import Image from "next/image";
import { Trophy } from "lucide-react";
import type { TopProductsRange } from "@/lib/api/seller-dashboard";
import { formatMoneyLocale } from "@/lib/i18n/locale-format";
import type { Locale } from "@/lib/i18n/types";
import { useSellerTopProducts } from "@/lib/queries/seller";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { Skeleton } from "@/components/ui/Skeleton";
import { getErrorMessage } from "@/lib/queries/utils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RANGES: TopProductsRange[] = ["7d", "30d", "90d"];

const RANGE_LABEL_KEY: Record<TopProductsRange, string> = {
  "7d": "seller.dashboard.range7dShort",
  "30d": "seller.dashboard.range30dShort",
  "90d": "seller.dashboard.range90dShort",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SellerTopProducts() {
  const { t, locale } = useLanguage();
  const [range, setRange] = useState<TopProductsRange>("30d");
  const { data, isLoading, isError, error } = useSellerTopProducts(range, 10);

  if (isLoading) {
    return (
      <div className="mq-seller-panel !min-h-0 p-4">
        <Skeleton className="h-4 w-40 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 rounded-lg" />
          ))}
        </div>
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

  if (!data || data.items.length === 0) {
    return (
      <div className="mq-seller-panel !min-h-0 p-4">
        <h3 className="text-sm font-semibold text-mq-text flex items-center gap-2 mb-2">
          <Trophy size={15} strokeWidth={1.75} aria-hidden />
          {t("seller.dashboard.topProducts")}
        </h3>
        <p className="text-xs text-mq-text-muted">{t("seller.dashboard.noProducts")}</p>
      </div>
    );
  }

  return (
    <div className="mq-seller-panel !min-h-0">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 pb-2">
        <div>
          <h3 className="text-sm font-semibold text-mq-text flex items-center gap-2">
            <Trophy size={15} strokeWidth={1.75} aria-hidden />
            {t("seller.dashboard.topProducts")}
          </h3>
          <p className="text-xs text-mq-text-muted mt-0.5">
            {t("seller.dashboard.topProductsDesc")}
          </p>
        </div>

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
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-label={t("seller.dashboard.topProducts")}>
          <thead>
            <tr className="border-b border-mq-border text-xs text-mq-text-muted">
              <th className="text-left px-4 py-2 font-medium w-8">#</th>
              <th className="text-left px-4 py-2 font-medium">
                {t("seller.dashboard.product")}
              </th>
              <th className="text-right px-4 py-2 font-medium">
                {t("seller.dashboard.quantity")}
              </th>
              <th className="text-right px-4 py-2 font-medium">
                {t("seller.dashboard.totalRevenue")}
              </th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, idx) => (
              <TopProductRow
                key={item.productId}
                rank={idx + 1}
                title={item.title}
                thumbnailUrl={item.thumbnailUrl}
                totalQuantity={item.totalQuantity}
                totalRevenue={item.totalRevenue}
                locale={locale}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component
// ---------------------------------------------------------------------------

function TopProductRow({
  rank,
  title,
  thumbnailUrl,
  totalQuantity,
  totalRevenue,
  locale,
}: {
  rank: number;
  title: string;
  thumbnailUrl: string | null;
  totalQuantity: number;
  totalRevenue: string;
  locale: Locale | null;
}) {
  return (
    <tr className="border-b border-mq-border last:border-0">
      <td className="px-4 py-2 tabular-nums text-mq-text-muted text-xs font-medium">
        {rank}
      </td>
      <td className="px-4 py-2">
        <div className="flex items-center gap-2">
          {thumbnailUrl ? (
            <Image
              src={thumbnailUrl}
              alt={title}
              width={28}
              height={28}
              className="rounded object-cover"
            />
          ) : (
            <span className="w-7 h-7 rounded bg-mq-surface flex items-center justify-center text-xs text-mq-text-muted">
              —
            </span>
          )}
          <span className="truncate max-w-[180px] sm:max-w-[260px]">{title}</span>
        </div>
      </td>
      <td className="px-4 py-2 text-right tabular-nums font-medium">
        {totalQuantity}
      </td>
      <td className="px-4 py-2 text-right tabular-nums">
        {formatMoneyLocale(totalRevenue, locale)}
      </td>
    </tr>
  );
}
