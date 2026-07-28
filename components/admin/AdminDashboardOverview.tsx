"use client";

import { useRouter } from "next/navigation";
import {
  BadgePercent,
  HandCoins,
  Package,
  Percent,
  RotateCcw,
  Scale,
  Shield,
  ShieldCheck,
  ShoppingBag,
  Store,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  ADMIN_DASHBOARD_QUEUE_ORDER,
  ADMIN_DASHBOARD_SNAPSHOT_ORDER,
  normalizeDashboardHref,
  type AdminDashboardQueues,
  type AdminDashboardSnapshot,
  type DashboardCountTile,
} from "@/lib/api/admin-dashboard";
import {
  ADMIN_DASHBOARD_QUEUE_I18N,
  ADMIN_DASHBOARD_SNAPSHOT_I18N,
} from "@/lib/i18n/admin-dashboard-labels";
import { formatDateTimeLocale, formatMoneyLocale } from "@/lib/i18n/locale-format";
import type { Locale } from "@/lib/i18n/types";
import { useAdminDashboard } from "@/lib/queries/admin";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { Skeleton } from "@/components/ui/Skeleton";

const QUEUE_ICONS: Record<keyof AdminDashboardQueues, LucideIcon> = {
  shopsPending: Store,
  productsPending: Package,
  ordersPending: ShoppingBag,
  rmaPending: RotateCcw,
  settlementsPendingReconcile: Scale,
  sellerPayoutsPending: HandCoins,
  walletPayoutsPending: Wallet,
  promotionsPending: BadgePercent,
  dsarSubmitted: Shield,
  dsarApprovedAwaitingExecute: ShieldCheck,
  staffPending: Users,
  financeConfigsPending: Percent,
};

function formatSnapshotValue(
  key: keyof AdminDashboardSnapshot,
  value: number | string,
  locale: Locale | null,
): string {
  if (key === "gmvDeliveredThisMonthUsd") {
    return formatMoneyLocale(value, locale);
  }
  return String(value);
}

type QueueTileProps = {
  tileKey: keyof AdminDashboardQueues;
  tile: DashboardCountTile;
  label: string;
  locale: Locale | null;
  onNavigate: (href: string) => void;
};

function QueueTile({ tileKey, tile, label, locale, onNavigate }: QueueTileProps) {
  const Icon = QUEUE_ICONS[tileKey];
  const href = normalizeDashboardHref(tile.href, tileKey);

  return (
    <button
      type="button"
      className="mq-admin-queue-tile"
      onClick={() => onNavigate(href)}
    >
      <span className="mq-admin-queue-icon">
        <Icon size={16} strokeWidth={1.75} />
      </span>
      <span className="mq-admin-queue-body">
        <span className="mq-admin-queue-label">{label}</span>
        {tile.amountUsd ? (
          <span className="mq-admin-queue-sub">{formatMoneyLocale(tile.amountUsd, locale)}</span>
        ) : null}
      </span>
      <span className="mq-admin-queue-count">{tile.count}</span>
    </button>
  );
}

function DashboardSkeleton({ label }: { label: string }) {
  return (
    <div className="space-y-4 mb-6" aria-busy="true" aria-label={label}>
      <Skeleton className="h-4 w-40" />
      <div className="mq-admin-queue-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[4.5rem] rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

export function AdminDashboardOverview() {
  const router = useRouter();
  const { t, locale } = useLanguage();
  const { data, isLoading, isError, error, dataUpdatedAt } = useAdminDashboard();

  if (isLoading) {
    return <DashboardSkeleton label={t("admin.overview.loading")} />;
  }

  const queues = data?.queues ?? {};
  const snapshot = data?.snapshot;
  const generatedAt = data?.generatedAt;
  const visibleQueues = ADMIN_DASHBOARD_QUEUE_ORDER.flatMap((key) => {
    const tile = queues[key];
    if (!tile || tile.count === 0) return [];
    return [{ key, tile }];
  });

  const visibleSnapshot = snapshot
    ? ADMIN_DASHBOARD_SNAPSHOT_ORDER.flatMap((key) => {
        const value = snapshot[key];
        if (value === undefined) return [];
        return [{ key, value }];
      })
    : [];

  const hasQueues = visibleQueues.length > 0;
  const hasSnapshot = visibleSnapshot.length > 0;

  if (!isError && !hasQueues && !hasSnapshot) {
    return null;
  }

  const updatedLabel = generatedAt
    ? t("admin.overview.updatedAt", {
        time: formatDateTimeLocale(generatedAt, locale),
      })
    : dataUpdatedAt
      ? t("admin.overview.updatedAt", {
          time: formatDateTimeLocale(new Date(dataUpdatedAt).toISOString(), locale),
        })
      : null;

  return (
    <section className="mb-6 space-y-5">
      {isError ? (
        <div className="mq-alert mq-alert-error text-sm">
          {error instanceof Error ? error.message : t("admin.common.failed")}
        </div>
      ) : null}

      {hasQueues ? (
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
            <h2 className="text-sm font-semibold text-mq-text">
              {t("admin.overview.queuesTitle")}
            </h2>
            {updatedLabel ? (
              <p className="text-[11px] text-mq-text-muted">{updatedLabel}</p>
            ) : null}
          </div>
          <div className="mq-admin-queue-grid">
            {visibleQueues.map(({ key, tile }) => (
              <QueueTile
                key={key}
                tileKey={key}
                tile={tile}
                label={t(ADMIN_DASHBOARD_QUEUE_I18N[key])}
                locale={locale}
                onNavigate={(href) => router.push(href)}
              />
            ))}
          </div>
        </div>
      ) : null}

      {hasSnapshot ? (
        <div>
          <h2 className="text-sm font-semibold text-mq-text mb-3">
            {t("admin.overview.snapshotTitle")}
          </h2>
          <div className="mq-admin-kpi-grid">
            {visibleSnapshot.map(({ key, value }) => (
              <div key={key} className="mq-admin-kpi-tile">
                <p className="mq-admin-kpi-label">{t(ADMIN_DASHBOARD_SNAPSHOT_I18N[key])}</p>
                <p className="mq-admin-kpi-value tabular-nums">
                  {formatSnapshotValue(key, value, locale)}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
