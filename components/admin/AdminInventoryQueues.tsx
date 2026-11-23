"use client";

import { useRouter } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAdminInventorySlips } from "@/lib/queries/inventory";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { Skeleton } from "@/components/ui/Skeleton";

type QueueTile = {
  key: string;
  icon: LucideIcon;
  label: string;
  count: number;
  href: string;
};

/**
 * Inventory work queues for warehouse staff.
 *
 * `GET /admin/dashboard` has no inventory section, so the counts come from the
 * list endpoints' `meta.total` with `pageSize: 1` — we only need the total.
 */
export function AdminInventoryQueues() {
  const router = useRouter();
  const { t } = useLanguage();

  const slips = useAdminInventorySlips({ status: "PENDING", pageSize: 1 });

  const isLoading = slips.isLoading;

  if (isLoading) {
    return (
      <div className="mq-admin-queue-grid" aria-busy="true">
        <Skeleton className="h-[4.5rem] rounded-2xl" />
      </div>
    );
  }

  const tiles: QueueTile[] = [
    {
      key: "slipsPending",
      icon: ClipboardCheck,
      label: t("admin.overview.inventory.slipsPending"),
      count: slips.data?.meta?.total ?? 0,
      href: "/admin/inventory?tab=slips",
    },
  ];

  return (
    <div>
      <h2 className="text-sm font-semibold text-mq-text mb-3">
        {t("admin.overview.inventory.title")}
      </h2>
      <div className="mq-admin-queue-grid">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <button
              key={tile.key}
              type="button"
              className="mq-admin-queue-tile"
              onClick={() => router.push(tile.href)}
            >
              <span className="mq-admin-queue-icon">
                <Icon size={16} strokeWidth={1.75} />
              </span>
              <span className="mq-admin-queue-body">
                <span className="mq-admin-queue-label">{tile.label}</span>
              </span>
              <span className="mq-admin-queue-count">{tile.count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
