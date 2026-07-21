"use client";

import { FormEvent, useState } from "react";
import { useConfirmStockReturn, useSellerRma, useWarehouses } from "@/lib/queries/seller";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { RmaListSkeleton } from "@/components/ui/Skeleton";

function SellerRmaInner() {
  const { data: items = [], isLoading, isError, error } = useSellerRma();
  const { data: warehouses = [] } = useWarehouses();
  const confirmStock = useConfirmStockReturn();
  const [forms, setForms] = useState<Record<string, { warehouseId: string; sku: string; quantity: string; kind: "RETURNED" | "NEW"; note: string }>>({});

  const confirm = async (id: string, e: FormEvent) => {
    e.preventDefault();
    const f = forms[id];
    if (!f) return;
    await confirmStock.mutateAsync({
      id,
      body: {
        warehouseId: f.warehouseId,
        sku: f.sku,
        quantity: Number(f.quantity),
        kind: f.kind,
        note: f.note || undefined,
      },
    });
  };

  const updateForm = (id: string, patch: Partial<(typeof forms)[string]>) => {
    setForms({
      ...forms,
      [id]: {
        warehouseId: forms[id]?.warehouseId || "",
        sku: forms[id]?.sku || "",
        quantity: forms[id]?.quantity || "1",
        kind: forms[id]?.kind || "RETURNED",
        note: forms[id]?.note || "",
        ...patch,
      },
    });
  };

  return (
    <div className="space-y-4">
        <p className="text-sm text-mq-text-muted">
          You cannot approve/reject RMA. After APPROVED, confirm stock when goods arrive (qty + RETURNED/NEW).
        </p>
        {isLoading && <RmaListSkeleton />}
        {isError && (
          <div className="mq-alert mq-alert-error">
            {error instanceof Error ? error.message : "Failed"}
          </div>
        )}
        {items.map((r) => (
          <div key={r.id} className="mq-card p-5 space-y-3">
            <div className="flex justify-between gap-3 text-sm">
              <span>Order {r.orderId.slice(0, 8)}…</span>
              <span className="mq-badge mq-badge-pink">{r.status}</span>
            </div>
            <p className="text-xs text-mq-text-muted">{r.reason}</p>
            {r.status === "APPROVED" && (
              <form
                className="grid sm:grid-cols-2 gap-2 pt-2 border-t border-mq-border"
                onSubmit={(e) => void confirm(r.id, e)}
              >
                <select
                  className="mq-input"
                  required
                  value={forms[r.id]?.warehouseId || ""}
                  onChange={(e) => updateForm(r.id, { warehouseId: e.target.value })}
                >
                  <option value="">Warehouse</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
                <input className="mq-input" placeholder="SKU" required value={forms[r.id]?.sku || ""} onChange={(e) => updateForm(r.id, { sku: e.target.value })} />
                <input className="mq-input" type="number" min="1" required value={forms[r.id]?.quantity || "1"} onChange={(e) => updateForm(r.id, { quantity: e.target.value })} />
                <select className="mq-input" value={forms[r.id]?.kind || "RETURNED"} onChange={(e) => updateForm(r.id, { kind: e.target.value as "RETURNED" | "NEW" })}>
                  <option value="RETURNED">RETURNED</option>
                  <option value="NEW">NEW</option>
                </select>
                <input className="mq-input sm:col-span-2" placeholder="Note" value={forms[r.id]?.note || ""} onChange={(e) => updateForm(r.id, { note: e.target.value })} />
                <button className="mq-btn mq-btn-primary sm:col-span-2" disabled={confirmStock.isPending}>
                  {confirmStock.isPending ? "Confirming…" : "Confirm stock return"}
                </button>
              </form>
            )}
          </div>
        ))}
    </div>
  );
}

export default function SellerRmaPage() {
  return (
    <AuthGuard roles={["SELLER"]}>
      <SellerRmaInner />
    </AuthGuard>
  );
}
