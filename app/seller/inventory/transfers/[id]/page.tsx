"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowRightLeft, CheckCircle, Package, XCircle } from "lucide-react";
import type { InventoryTransfer, TransferItem } from "@/lib/api/inventory";
import {
  useApproveTransfer,
  useCancelTransfer,
  useReceiveTransfer,
  useTransferDetail,
} from "@/lib/queries/inventory";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { Skeleton } from "@/components/ui/Skeleton";

function statusBadgeClass(status: string): string {
  if (status === "RECEIVED") return "mq-badge mq-badge-teal";
  if (status === "IN_TRANSIT") return "mq-badge mq-badge-cyan";
  if (status === "CANCELLED") return "mq-badge mq-badge-pink";
  return "mq-badge mq-badge-muted";
}

function warehouseInfo(transfer: InventoryTransfer, direction: "from" | "to") {
  const w = direction === "from" ? transfer.fromWarehouse : transfer.toWarehouse;
  if (!w) return transfer[direction === "from" ? "fromWarehouseId" : "toWarehouseId"].slice(0, 8) + "…";
  const flag = w.countryCode || "";
  const type = w.warehouseType === "PLATFORM" ? " [Platform]" : "";
  return `${flag} ${w.code}${type}`.trim();
}

function TransferDetailInner() {
  const { t } = useLanguage();
  const params = useParams();
  const id = params.id as string;

  const { data: transfer, isLoading, isError } = useTransferDetail(id);
  const approveMut = useApproveTransfer();
  const receiveMut = useReceiveTransfer();
  const cancelMut = useCancelTransfer();

  const [receiveMode, setReceiveMode] = useState(false);
  const [receiveItems, setReceiveItems] = useState<Array<{ sku: string; receivedQuantity: string }>>([]);
  const [receiveNote, setReceiveNote] = useState("");

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  if (isError || !transfer) {
    return <div className="mq-alert mq-alert-error">Transfer not found.</div>;
  }

  const isPending = transfer.status === "PENDING";
  const isInTransit = transfer.status === "IN_TRANSIT";

  const onApprove = async () => {
    if (!confirm(t("seller.transfers.approveConfirm"))) return;
    await approveMut.mutateAsync(id);
  };

  const onCancel = async () => {
    if (!confirm(t("seller.transfers.cancelConfirm"))) return;
    await cancelMut.mutateAsync(id);
  };

  const startReceive = () => {
    setReceiveItems(
      transfer.items.map((item) => ({
        sku: item.sku,
        receivedQuantity: String(item.quantity),
      })),
    );
    setReceiveMode(true);
  };

  const onReceive = async (e: FormEvent) => {
    e.preventDefault();
    if (!confirm(t("seller.transfers.receiveConfirm"))) return;
    await receiveMut.mutateAsync({
      id,
      body: {
        items: receiveItems.map((r) => ({
          sku: r.sku,
          receivedQuantity: Number(r.receivedQuantity),
        })),
        note: receiveNote.trim() || undefined,
      },
    });
    setReceiveMode(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/seller/inventory/transfers" className="mq-btn mq-btn-outline text-xs">
          <ArrowLeft size={14} /> {t("admin.common.back")}
        </Link>
        <h1 className="text-lg font-semibold text-mq-text flex items-center gap-2">
          <ArrowRightLeft size={20} strokeWidth={1.75} />
          {t("seller.transfers.detail")}
        </h1>
      </div>

      {/* Info card */}
      <div className="mq-card p-5 space-y-3">
        <div className="flex flex-wrap gap-4 text-sm">
          <div>
            <span className="text-xs text-mq-text-muted">ID</span>
            <p className="font-mono text-xs">{transfer.id}</p>
          </div>
          <div>
            <span className="text-xs text-mq-text-muted">{t("admin.common.status")}</span>
            <p><span className={statusBadgeClass(transfer.status)}>{t(`seller.transfers.status${transfer.status}`)}</span></p>
          </div>
          <div>
            <span className="text-xs text-mq-text-muted">{t("seller.transfers.fromWarehouse")}</span>
            <p className="text-xs">{warehouseInfo(transfer, "from")}</p>
          </div>
          <div>
            <span className="text-xs text-mq-text-muted">{t("seller.transfers.toWarehouse")}</span>
            <p className="text-xs">{warehouseInfo(transfer, "to")}</p>
          </div>
          <div>
            <span className="text-xs text-mq-text-muted">{t("seller.inventoryPage.created")}</span>
            <p className="text-xs">{new Date(transfer.createdAt).toLocaleString()}</p>
          </div>
        </div>
        {transfer.shippingNote && (
          <p className="text-xs text-mq-text-muted">
            {t("seller.transfers.shippingNote")}: {transfer.shippingNote}
          </p>
        )}
        {transfer.receiveNote && (
          <p className="text-xs text-mq-text-muted">
            {t("seller.transfers.receiveNote")}: {transfer.receiveNote}
          </p>
        )}
      </div>

      {/* Items table */}
      <div className="mq-card">
        <div className="px-4 pt-4 pb-2 flex items-center gap-2">
          <Package size={16} className="text-mq-text-muted" />
          <h3 className="text-sm font-semibold">SKU</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-mq-border text-xs text-mq-text-muted">
                <th className="text-left px-4 py-2 font-medium">SKU</th>
                <th className="text-right px-4 py-2 font-medium">{t("seller.inventoryPage.quantity")}</th>
                {transfer.status === "RECEIVED" && (
                  <th className="text-right px-4 py-2 font-medium">{t("seller.transfers.receivedQty")}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {transfer.items.map((item) => (
                <tr key={item.sku} className="border-b border-mq-border last:border-0">
                  <td className="px-4 py-2 font-mono text-xs">{item.sku}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{item.quantity}</td>
                  {transfer.status === "RECEIVED" && (
                    <td className="px-4 py-2 text-right tabular-nums">
                      {item.receivedQuantity ?? "—"}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Actions */}
      {isPending && (
        <div className="flex gap-3">
          <button
            type="button"
            className="mq-btn mq-btn-primary text-sm"
            disabled={approveMut.isPending}
            onClick={() => void onApprove()}
          >
            <CheckCircle size={16} /> {t("seller.transfers.approve")}
          </button>
          <button
            type="button"
            className="mq-btn mq-btn-outline text-sm text-red-500 border-red-300 hover:bg-red-50"
            disabled={cancelMut.isPending}
            onClick={() => void onCancel()}
          >
            <XCircle size={16} /> {t("seller.transfers.cancel")}
          </button>
        </div>
      )}

      {isInTransit && !receiveMode && (
        <button
          type="button"
          className="mq-btn mq-btn-primary text-sm"
          onClick={startReceive}
        >
          <CheckCircle size={16} /> {t("seller.transfers.receive")}
        </button>
      )}

      {/* Receive form */}
      {isInTransit && receiveMode && (
        <form className="mq-card p-5 space-y-4 max-w-lg" onSubmit={(e) => void onReceive(e)}>
          <h3 className="text-sm font-semibold">{t("seller.transfers.receive")}</h3>
          <div className="space-y-2">
            {receiveItems.map((r, i) => (
              <div key={r.sku} className="flex items-center gap-3">
                <span className="font-mono text-xs flex-1">{r.sku}</span>
                <input
                  className="mq-input w-24"
                  type="number"
                  min="0"
                  value={r.receivedQuantity}
                  onChange={(e) => {
                    const copy = [...receiveItems];
                    copy[i] = { ...copy[i]!, receivedQuantity: e.target.value };
                    setReceiveItems(copy);
                  }}
                  required
                />
              </div>
            ))}
          </div>
          <label className="block text-xs space-y-1">
            <span className="text-mq-text-muted">{t("seller.transfers.receiveNote")}</span>
            <input className="mq-input" value={receiveNote} onChange={(e) => setReceiveNote(e.target.value)} />
          </label>
          <div className="flex gap-2">
            <button type="submit" className="mq-btn mq-btn-primary text-sm" disabled={receiveMut.isPending}>
              {receiveMut.isPending ? "…" : t("seller.transfers.receive")}
            </button>
            <button type="button" className="mq-btn mq-btn-outline text-sm" onClick={() => setReceiveMode(false)}>
              {t("admin.common.cancel")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function TransferDetailPage() {
  return (
    <AuthGuard
      roles={["SELLER", "WAREHOUSE", "ADMIN", "SUPER_ADMIN"]}
      permissions={["SYNC_INVENTORY"]}
    >
      <TransferDetailInner />
    </AuthGuard>
  );
}
