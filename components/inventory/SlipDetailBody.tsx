"use client";

import { formatMoney } from "@/lib/api/utils";
import type { InventorySlip } from "@/lib/api/inventory";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { translateStatus } from "@/lib/i18n/status";

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function SlipDetailBody({
  slip,
  loading,
  error,
}: {
  slip?: InventorySlip | null;
  loading?: boolean;
  error?: string | null;
}) {
  const { t } = useLanguage();
  if (loading) {
    return <p className="text-xs text-mq-text-muted py-2">Loading slip…</p>;
  }
  if (error) {
    return <p className="text-xs text-mq-accent-pink py-2">{error}</p>;
  }
  if (!slip) return null;

  return (
    <div className="rounded-[var(--mq-radius-sm)] bg-mq-surface-subtle p-3 space-y-2 text-xs">
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-mq-text-secondary">
        <span className="font-mono font-medium text-mq-text">{slip.code}</span>
        <span>{translateStatus(t, "inventorySlipType", slip.type)}</span>
        <span>{translateStatus(t, "inventorySlip", slip.status)}</span>
        {slip.warehouseCode ? <span>WH {slip.warehouseCode}</span> : null}
      </div>
      {slip.locationNote ? (
        <p className="text-mq-text-muted">{slip.locationNote}</p>
      ) : null}
      <ul className="space-y-1">
        {(slip.items ?? []).map((it) => (
          <li key={it.id} className="flex flex-wrap justify-between gap-2">
            <span className="font-medium font-mono">{it.sku}</span>
            <span className="text-mq-text-muted">
              ×{it.quantity}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-mq-text-muted">
        Created {formatWhen(slip.createdAt)}
        {slip.processedAt ? ` · Processed ${formatWhen(slip.processedAt)}` : ""}
        {slip.createdByUserId ? ` · By ${slip.createdByUserId.slice(0, 8)}…` : ""}
      </p>
    </div>
  );
}
