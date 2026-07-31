"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, X } from "lucide-react";
import type { TransferStatus } from "@/lib/api/inventory";
import {
  useCreateTransfer,
  useTransfers,
  useWarehouseLookup,
  useWarehouseStock,
} from "@/lib/queries/inventory";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { translateStatus } from "@/lib/i18n/status";
import { formatWarehouseLabel } from "@/lib/inventory/warehouse-label";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { TableSkeleton } from "@/components/ui/Skeleton";

const STATUS_FILTERS: Array<TransferStatus | ""> = [
  "",
  "PENDING",
  "IN_TRANSIT",
  "RECEIVED",
  "CANCELLED",
];

function statusBadgeClass(status: string): string {
  if (status === "RECEIVED") return "mq-badge mq-badge-teal";
  if (status === "IN_TRANSIT") return "mq-badge mq-badge-cyan";
  if (status === "CANCELLED") return "mq-badge mq-badge-pink";
  return "mq-badge mq-badge-muted";
}

type FormLine = { sku: string; quantity: string };

function TransfersInner() {
  const { t } = useLanguage();
  const [statusFilter, setStatusFilter] = useState<TransferStatus | "">("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useTransfers({
    status: statusFilter || undefined,
    page,
    pageSize: 20,
  });
  const items = data?.items ?? [];
  const meta = data?.meta;

  // Warehouses of the caller's shop — transfers only move stock within a shop.
  const { warehouses, byId: warehouseById } = useWarehouseLookup();
  const createTransfer = useCreateTransfer();
  // A transfer needs a distinct source and destination.
  const canTransfer = warehouses.length >= 2;

  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<FormLine[]>([{ sku: "", quantity: "1" }]);

  // Only SKUs that actually have stock in the source warehouse can be moved.
  const { data: sourceStock, isLoading: stockLoading } = useWarehouseStock(
    fromId || null,
    { pageSize: 200 },
  );
  const skuOptions = (sourceStock?.items ?? []).filter(
    (item) => item.availableStock > 0,
  );
  const stockBySku = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of skuOptions) map.set(item.sku, item.availableStock);
    return map;
  }, [skuOptions]);

  /** Switching source warehouse invalidates every picked SKU. */
  const onChangeFrom = (value: string) => {
    setFromId(value);
    setLines([{ sku: "", quantity: "1" }]);
  };

  const addLine = () => setLines([...lines, { sku: "", quantity: "1" }]);
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: keyof FormLine, value: string) => {
    const copy = [...lines];
    copy[i] = { ...copy[i]!, [field]: value };
    setLines(copy);
  };

  const resetForm = () => {
    setFromId("");
    setToId("");
    setNote("");
    setLines([{ sku: "", quantity: "1" }]);
    setShowCreate(false);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const validItems = lines
      .filter((l) => l.sku.trim() && Number(l.quantity) > 0)
      .map((l) => ({ sku: l.sku.trim(), quantity: Number(l.quantity) }));
    if (!validItems.length) return;
    try {
      await createTransfer.mutateAsync({
        fromWarehouseId: fromId,
        toWarehouseId: toId,
        items: validItems,
        shippingNote: note.trim() || undefined,
      });
    } catch {
      return; // toast handled in the mutation; keep the form values for retry
    }
    resetForm();
  };

  return (
    <div className="space-y-6">
      {/* Title + description come from SellerShell's page header. */}
      <div className="flex justify-end">
        <button
          type="button"
          className="mq-btn mq-btn-primary text-sm"
          disabled={!canTransfer}
          title={!canTransfer ? t("seller.transfers.needTwoWarehouses") : undefined}
          onClick={() => setShowCreate(true)}
        >
          <Plus size={16} /> {t("seller.transfers.create")}
        </button>
      </div>

      {!canTransfer ? (
        <div className="mq-alert flex flex-wrap items-center justify-between gap-3">
          <span>{t("seller.transfers.needTwoWarehouses")}</span>
          <Link href="/seller/inventory" className="mq-btn mq-btn-outline text-xs shrink-0">
            {t("seller.inventoryPage.goToWarehouses")}
          </Link>
        </div>
      ) : null}

      {/* Create form */}
      {showCreate && (
        <form
          className="mq-card p-5 space-y-4"
          onSubmit={(e) => void onSubmit(e)}
        >
          <h2 className="text-base font-medium">{t("seller.transfers.create")}</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block text-xs space-y-1">
              <span className="text-mq-text-muted">{t("seller.transfers.fromWarehouse")}</span>
              <select className="mq-input" value={fromId} onChange={(e) => onChangeFrom(e.target.value)} required>
                <option value="">{t("seller.transfers.selectWarehouse")}</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {formatWarehouseLabel(w)}
                    {w.address ? ` — ${w.address}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs space-y-1">
              <span className="text-mq-text-muted">{t("seller.transfers.toWarehouse")}</span>
              <select className="mq-input" value={toId} onChange={(e) => setToId(e.target.value)} required>
                <option value="">{t("seller.transfers.selectWarehouse")}</option>
                {warehouses.filter((w) => w.id !== fromId).map((w) => (
                  <option key={w.id} value={w.id}>
                    {formatWarehouseLabel(w)}
                    {w.address ? ` — ${w.address}` : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-mq-text-muted font-medium">SKU</p>
            {!fromId ? (
              <p className="text-xs text-mq-text-muted">
                {t("seller.transfers.selectSourceFirst")}
              </p>
            ) : stockLoading ? (
              <p className="text-xs text-mq-text-muted">{t("admin.common.loading")}</p>
            ) : skuOptions.length === 0 ? (
              <p className="text-xs text-mq-text-muted">
                {t("seller.transfers.sourceEmpty")}
              </p>
            ) : null}
            {lines.map((line, i) => {
              const maxQty = stockBySku.get(line.sku);
              return (
              <div
                key={i}
                className="grid grid-cols-[minmax(0,1fr)_5.5rem_2rem] gap-2 items-center"
              >
                <select
                  className="mq-input w-full"
                  value={line.sku}
                  aria-label="SKU"
                  disabled={!fromId || skuOptions.length === 0}
                  onChange={(e) => updateLine(i, "sku", e.target.value)}
                  required
                >
                  <option value="">SKU</option>
                  {skuOptions.map((item) => (
                    <option key={item.sku} value={item.sku}>
                      {item.sku} — {item.productTitle} ({item.availableStock})
                    </option>
                  ))}
                </select>
                <input
                  className="mq-input w-full"
                  type="number"
                  min="1"
                  max={maxQty}
                  aria-label={t("seller.inventoryPage.quantity")}
                  title={
                    maxQty != null
                      ? t("seller.transfers.maxAvailable", { count: String(maxQty) })
                      : undefined
                  }
                  placeholder={t("seller.inventoryPage.qty")}
                  value={line.quantity}
                  onChange={(e) => updateLine(i, "quantity", e.target.value)}
                  required
                />
                {lines.length > 1 ? (
                  <button
                    type="button"
                    className="mq-icon-btn text-mq-text-muted hover:text-red-500 justify-self-center"
                    aria-label={t("seller.inventoryPage.removeLine")}
                    onClick={() => removeLine(i)}
                  >
                    <X size={16} />
                  </button>
                ) : (
                  <span />
                )}
              </div>
              );
            })}
            <button
              type="button"
              className="text-xs text-[#e7ba0a] hover:underline disabled:opacity-50"
              disabled={!fromId || skuOptions.length === 0}
              onClick={addLine}
            >
              + {t("seller.transfers.addItem")}
            </button>
          </div>

          <label className="block text-xs space-y-1">
            <span className="text-mq-text-muted">{t("seller.transfers.shippingNote")}</span>
            <input className="mq-input" value={note} onChange={(e) => setNote(e.target.value)} />
          </label>

          <div className="flex gap-2">
            <button type="submit" className="mq-btn mq-btn-primary text-sm" disabled={createTransfer.isPending}>
              {createTransfer.isPending ? "…" : t("seller.transfers.create")}
            </button>
            <button type="button" className="mq-btn mq-btn-outline text-sm" onClick={resetForm}>
              {t("admin.common.cancel")}
            </button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="flex gap-3">
        <select
          className="mq-input max-w-[12rem]"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as TransferStatus | ""); setPage(1); }}
        >
          <option value="">{t("admin.common.allStatuses")}</option>
          {STATUS_FILTERS.filter(Boolean).map((s) => (
            <option key={s} value={s}>{translateStatus(t, "transfer", s)}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : items.length === 0 ? (
        <p className="text-sm text-mq-text-muted">{t("seller.transfers.empty")}</p>
      ) : (
        <div className="mq-table-wrap">
          <table className="w-full text-sm">
            <thead className="bg-mq-surface-subtle text-left">
              <tr>
                <th className="p-3">{t("seller.inventoryPage.code")}</th>
                <th className="p-3">{t("seller.transfers.fromWarehouse")}</th>
                <th className="p-3">{t("seller.transfers.toWarehouse")}</th>
                <th className="p-3">{t("admin.common.status")}</th>
                <th className="p-3">{t("seller.inventoryPage.created")}</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {items.map((tr) => (
                <tr key={tr.id} className="border-t border-mq-border">
                  <td className="p-3 font-mono text-xs">
                    {tr.code || `${tr.id.slice(0, 8)}…`}
                  </td>
                  <td className="p-3 text-xs">
                    {formatWarehouseLabel(
                      tr.fromWarehouse ?? warehouseById.get(tr.fromWarehouseId),
                      tr.fromWarehouseId,
                    )}
                  </td>
                  <td className="p-3 text-xs">
                    {formatWarehouseLabel(
                      tr.toWarehouse ?? warehouseById.get(tr.toWarehouseId),
                      tr.toWarehouseId,
                    )}
                  </td>
                  <td className="p-3">
                    <span className={statusBadgeClass(tr.status)}>
                      {translateStatus(t, "transfer", tr.status)}
                    </span>
                  </td>
                  <td className="p-3 text-xs text-mq-text-muted">
                    {new Date(tr.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-3">
                    <Link
                      href={`/seller/inventory/transfers/${tr.id}`}
                      className="text-xs text-[#e7ba0a] hover:underline"
                    >
                      {t("seller.transfers.detail")}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PaginationBar page={page} meta={meta} onPageChange={setPage} />
    </div>
  );
}

export default function TransfersPage() {
  return (
    <AuthGuard
      roles={["SELLER", "WAREHOUSE", "ADMIN", "SUPER_ADMIN"]}
      permissions={["SYNC_INVENTORY"]}
    >
      <TransfersInner />
    </AuthGuard>
  );
}
