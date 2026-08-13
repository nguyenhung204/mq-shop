"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckCircle, Package, XCircle } from "lucide-react";
import {
  useApproveTransfer,
  useCancelTransfer,
  useReceiveTransfer,
  useTransferDetail,
  useWarehouseLookup,
} from "@/lib/queries/inventory";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { translateStatus } from "@/lib/i18n/status";
import { formatWarehouseLabel } from "@/lib/inventory/warehouse-label";
import {
  TRANSFER_CONFIRM,
  type TransferAction,
} from "@/lib/inventory/transfer-confirm";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Skeleton } from "@/components/ui/Skeleton";

function statusBadgeClass(status: string): string {
  if (status === "RECEIVED") return "mq-badge mq-badge-teal";
  if (status === "IN_TRANSIT") return "mq-badge mq-badge-cyan";
  if (status === "CANCELLED") return "mq-badge mq-badge-pink";
  return "mq-badge mq-badge-muted";
}

function formatWhen(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function TransferDetailInner() {
  const { t } = useLanguage();
  const params = useParams();
  const id = params.id as string;

  const { data: transfer, isLoading, isError } = useTransferDetail(id);
  // Transfer payload references warehouses by id only — resolve to code here.
  const { byId: warehouseById } = useWarehouseLookup();
  const approveMut = useApproveTransfer();
  const receiveMut = useReceiveTransfer();
  const cancelMut = useCancelTransfer();

  const [receiveMode, setReceiveMode] = useState(false);
  const [receiveItems, setReceiveItems] = useState<Array<{ sku: string; receivedQuantity: string }>>([]);
  const [receiveNote, setReceiveNote] = useState("");
  const [pendingAction, setPendingAction] = useState<TransferAction | null>(null);

  const confirmBusy =
    approveMut.isPending || cancelMut.isPending || receiveMut.isPending;

  const runPendingAction = async () => {
    try {
      if (pendingAction === "approve") {
        await approveMut.mutateAsync(id);
      } else if (pendingAction === "cancel") {
        await cancelMut.mutateAsync(id);
      } else if (pendingAction === "receive") {
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
      }
    } finally {
      setPendingAction(null);
    }
  };

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

  const startReceive = () => {
    setReceiveItems(
      transfer.items.map((item) => ({
        sku: item.sku,
        receivedQuantity: String(item.quantity),
      })),
    );
    setReceiveMode(true);
  };

  const onReceive = (e: FormEvent) => {
    e.preventDefault();
    setPendingAction("receive");
  };

  return (
    <>
      <AdminPageHeader
        title={t("seller.transfers.detail")}
        description={transfer.code || t("seller.transfers.detail")}
        actions={
          <Link href="/admin/transfers" className="mq-admin-btn mq-admin-btn-secondary">
            <ArrowLeft size={16} /> {t("admin.common.back")}
          </Link>
        }
      />

      <div className="space-y-6">
        {/* Info card */}
        <div className="mq-card p-5 space-y-3">
          <div className="flex flex-wrap gap-4 text-sm">
            <div>
              <span className="text-xs text-mq-text-muted">{t("admin.common.status")}</span>
              <p><span className={statusBadgeClass(transfer.status)}>{translateStatus(t, "transfer", transfer.status)}</span></p>
            </div>
            <div>
              <span className="text-xs text-mq-text-muted">{t("seller.transfers.fromWarehouse")}</span>
              <p className="text-xs font-medium">
                {formatWarehouseLabel(
                  transfer.fromWarehouse ?? warehouseById.get(transfer.fromWarehouseId),
                  transfer.fromWarehouseId,
                )}
              </p>
            </div>
            <div>
              <span className="text-xs text-mq-text-muted">{t("seller.transfers.toWarehouse")}</span>
              <p className="text-xs font-medium">
                {formatWarehouseLabel(
                  transfer.toWarehouse ?? warehouseById.get(transfer.toWarehouseId),
                  transfer.toWarehouseId,
                )}
              </p>
            </div>
            <div>
              <span className="text-xs text-mq-text-muted">{t("seller.inventoryPage.created")}</span>
              <p className="text-xs">{new Date(transfer.createdAt).toLocaleString()}</p>
            </div>
            {formatWhen(transfer.processedAt) ? (
              <div>
                <span className="text-xs text-mq-text-muted">{t("seller.transfers.approvedAt")}</span>
                <p className="text-xs">{formatWhen(transfer.processedAt)}</p>
              </div>
            ) : null}
            {formatWhen(transfer.receivedAt) ? (
              <div>
                <span className="text-xs text-mq-text-muted">{t("seller.transfers.receivedAt")}</span>
                <p className="text-xs">{formatWhen(transfer.receivedAt)}</p>
              </div>
            ) : null}
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
              disabled={confirmBusy}
              onClick={() => setPendingAction("approve")}
            >
              <CheckCircle size={16} /> {t("seller.transfers.approve")}
            </button>
            <button
              type="button"
              className="mq-btn mq-btn-outline text-sm text-red-500 border-red-300 hover:bg-red-50"
              disabled={confirmBusy}
              onClick={() => setPendingAction("cancel")}
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
          <form className="mq-card p-5 space-y-4 max-w-lg" onSubmit={onReceive}>
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
              <button type="submit" className="mq-btn mq-btn-primary text-sm" disabled={confirmBusy}>
                {receiveMut.isPending ? "…" : t("seller.transfers.receive")}
              </button>
              <button type="button" className="mq-btn mq-btn-outline text-sm" onClick={() => setReceiveMode(false)}>
                {t("admin.common.cancel")}
              </button>
            </div>
          </form>
        )}

        <ConfirmDialog
          open={Boolean(pendingAction)}
          title={pendingAction ? t(TRANSFER_CONFIRM[pendingAction].titleKey) : ""}
          description={pendingAction ? t(TRANSFER_CONFIRM[pendingAction].descKey) : undefined}
          confirmLabel={pendingAction ? t(TRANSFER_CONFIRM[pendingAction].btnKey) : ""}
          tone={pendingAction ? TRANSFER_CONFIRM[pendingAction].tone : "primary"}
          busy={confirmBusy}
          onClose={() => setPendingAction(null)}
          onConfirm={runPendingAction}
        />
      </div>
    </>
  );
}

export default function AdminTransferDetailPage() {
  return (
    <AuthGuard
      roles={["WAREHOUSE", "ADMIN", "SUPER_ADMIN"]}
      permissions={["SYNC_INVENTORY"]}
    >
      <TransferDetailInner />
    </AuthGuard>
  );
}
