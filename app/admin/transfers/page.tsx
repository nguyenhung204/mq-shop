"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowRightLeft, Plus, X } from "lucide-react";
import type { TransferStatus, Warehouse } from "@/lib/api/inventory";
import {
  useCreateTransfer,
  useTransfers,
  useWarehouses,
} from "@/lib/queries/inventory";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { useLanguage } from "@/components/providers/LanguageProvider";
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

function warehouseLabel(w?: Warehouse): string {
  if (!w) return "—";
  const flag = w.countryCode ? `[${w.countryCode}]` : "";
  const type = w.warehouseType === "PLATFORM" ? " (Platform)" : "";
  return `${flag} ${w.code}${type}`.trim();
}

type FormLine = { sku: string; quantity: string };

function TransfersInner() {
  const { t } = useLanguage();
  const [statusFilter, setStatusFilter] = useState<TransferStatus | "">("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);

  // ALL transfers — no shopId filter (admin/warehouse scope)
  const { data, isLoading } = useTransfers({
    status: statusFilter || undefined,
    page,
    pageSize: 20,
  });
  const items = data?.items ?? [];
  const meta = data?.meta;

  // ALL warehouses across all shops/countries
  const { data: warehouses = [] } = useWarehouses();
  const createTransfer = useCreateTransfer();

  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<FormLine[]>([{ sku: "", quantity: "1" }]);

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
    await createTransfer.mutateAsync({
      fromWarehouseId: fromId,
      toWarehouseId: toId,
      items: validItems,
      shippingNote: note.trim() || undefined,
    });
    resetForm();
  };

  return (
    <>
      <AdminPageHeader
        title={t("seller.transfers.title")}
        description={t("seller.transfers.description")}
        actions={
          <button
            type="button"
            className="mq-admin-btn mq-admin-btn-approve"
            onClick={() => setShowCreate(true)}
          >
            <Plus size={16} strokeWidth={2.25} />
            {t("seller.transfers.create")}
          </button>
        }
      />

      <div className="space-y-6">
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
                <select className="mq-input" value={fromId} onChange={(e) => setFromId(e.target.value)} required>
                  <option value="">{t("seller.transfers.selectWarehouse")}</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{warehouseLabel(w)} — {w.address || w.shopId?.slice(0, 8)}</option>
                  ))}
                </select>
              </label>
              <label className="block text-xs space-y-1">
                <span className="text-mq-text-muted">{t("seller.transfers.toWarehouse")}</span>
                <select className="mq-input" value={toId} onChange={(e) => setToId(e.target.value)} required>
                  <option value="">{t("seller.transfers.selectWarehouse")}</option>
                  {warehouses.filter((w) => w.id !== fromId).map((w) => (
                    <option key={w.id} value={w.id}>{warehouseLabel(w)} — {w.address || w.shopId?.slice(0, 8)}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-mq-text-muted font-medium">SKU</p>
              {lines.map((line, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    className="mq-input flex-1"
                    placeholder="SKU"
                    value={line.sku}
                    onChange={(e) => updateLine(i, "sku", e.target.value)}
                    required
                  />
                  <input
                    className="mq-input w-20"
                    type="number"
                    min="1"
                    placeholder="Qty"
                    value={line.quantity}
                    onChange={(e) => updateLine(i, "quantity", e.target.value)}
                    required
                  />
                  {lines.length > 1 && (
                    <button type="button" className="text-mq-text-muted hover:text-red-500" onClick={() => removeLine(i)}>
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
              <button type="button" className="text-xs text-[#e7ba0a] hover:underline" onClick={addLine}>
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
              <option key={s} value={s}>{t(`seller.transfers.status${s}`)}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        {isLoading ? (
          <TableSkeleton rows={5} cols={6} />
        ) : items.length === 0 ? (
          <p className="text-sm text-mq-text-muted">{t("seller.transfers.empty")}</p>
        ) : (
          <div className="mq-table-wrap">
            <table className="w-full text-sm">
              <thead className="bg-mq-surface-subtle text-left">
                <tr>
                  <th className="p-3">ID</th>
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
                    <td className="p-3 font-mono text-xs">{tr.id.slice(0, 8)}…</td>
                    <td className="p-3 text-xs">{warehouseLabel(tr.fromWarehouse)}</td>
                    <td className="p-3 text-xs">{warehouseLabel(tr.toWarehouse)}</td>
                    <td className="p-3">
                      <span className={statusBadgeClass(tr.status)}>
                        {t(`seller.transfers.status${tr.status}`)}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-mq-text-muted">
                      {new Date(tr.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-3">
                      <Link
                        href={`/admin/transfers/${tr.id}`}
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
    </>
  );
}

export default function AdminTransfersPage() {
  return (
    <AuthGuard
      roles={["WAREHOUSE", "ADMIN", "SUPER_ADMIN"]}
      permissions={["SYNC_INVENTORY"]}
    >
      <TransfersInner />
    </AuthGuard>
  );
}
