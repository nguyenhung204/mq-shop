"use client";

import { FormEvent, useState } from "react";
import {
  useApproveInventory,
  useCreateInventoryRequest,
  useCreateWarehouse,
  useRejectInventory,
  useSellerInventory,
} from "@/lib/queries/seller";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminCardListSkeleton } from "@/components/ui/Skeleton";

function InventoryInner() {
  const { data, isLoading, isError, error } = useSellerInventory();
  const createWarehouse = useCreateWarehouse();
  const createRequest = useCreateInventoryRequest();
  const approveInventory = useApproveInventory();
  const rejectInventory = useRejectInventory();
  const [whForm, setWhForm] = useState({ name: "", addressText: "" });
  const [reqForm, setReqForm] = useState({
    warehouseId: "",
    sku: "",
    quantity: "1",
    requestType: "IN" as "IN" | "ADJUST_IN" | "ADJUST_OUT",
    reason: "",
  });

  const warehouses = data?.warehouses ?? [];
  const inventory = data?.inventory ?? [];
  const pending = data?.pending ?? [];

  return (
    <div className="space-y-8">
        {isError && (
          <div className="mq-alert mq-alert-error">
            {error instanceof Error ? error.message : "Failed to load inventory"}
          </div>
        )}
        <p className="text-sm text-mq-text-muted">
          Seller/Admin requests auto-approve. Staff requests stay PENDING until you approve.
        </p>

        <form
          className="mq-card p-5 flex flex-wrap gap-3"
          onSubmit={async (e: FormEvent) => {
            e.preventDefault();
            await createWarehouse.mutateAsync(whForm);
            setWhForm({ name: "", addressText: "" });
          }}
        >
          <input className="mq-input flex-1 min-w-[160px]" placeholder="Warehouse name" value={whForm.name} onChange={(e) => setWhForm({ ...whForm, name: e.target.value })} required />
          <input className="mq-input flex-[2] min-w-[200px]" placeholder="Address" value={whForm.addressText} onChange={(e) => setWhForm({ ...whForm, addressText: e.target.value })} required />
          <button className="mq-btn mq-btn-outline" disabled={createWarehouse.isPending}>
            {createWarehouse.isPending ? "Adding…" : "Add warehouse"}
          </button>
        </form>

        <form
          className="mq-card p-5 grid sm:grid-cols-2 gap-3"
          onSubmit={async (e: FormEvent) => {
            e.preventDefault();
            await createRequest.mutateAsync({
              warehouseId: reqForm.warehouseId,
              sku: reqForm.sku,
              quantity: Number(reqForm.quantity),
              requestType: reqForm.requestType,
              reason: reqForm.reason || undefined,
            });
          }}
        >
          <select className="mq-input" value={reqForm.warehouseId} onChange={(e) => setReqForm({ ...reqForm, warehouseId: e.target.value })} required>
            <option value="">Warehouse</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
          <input className="mq-input" placeholder="SKU" value={reqForm.sku} onChange={(e) => setReqForm({ ...reqForm, sku: e.target.value })} required />
          <input className="mq-input" type="number" min="1" value={reqForm.quantity} onChange={(e) => setReqForm({ ...reqForm, quantity: e.target.value })} required />
          <select className="mq-input" value={reqForm.requestType} onChange={(e) => setReqForm({ ...reqForm, requestType: e.target.value as typeof reqForm.requestType })}>
            <option value="IN">IN</option>
            <option value="ADJUST_IN">ADJUST_IN</option>
            <option value="ADJUST_OUT">ADJUST_OUT</option>
          </select>
          <input className="mq-input sm:col-span-2" placeholder="Reason" value={reqForm.reason} onChange={(e) => setReqForm({ ...reqForm, reason: e.target.value })} />
          <button className="mq-btn mq-btn-primary sm:col-span-2" disabled={createRequest.isPending}>
            {createRequest.isPending ? "Creating…" : "Create stock request"}
          </button>
        </form>

        {isLoading ? (
          <AdminCardListSkeleton count={3} />
        ) : (
          <>
            <section>
              <h2 className="text-lg mb-3">Pending staff requests</h2>
              {pending.length === 0 && <p className="text-sm text-mq-text-muted">None</p>}
              {pending.map((r) => (
                <div key={r.id} className="mq-card p-4 mb-2 flex flex-wrap items-center justify-between gap-3 text-sm">
                  <span>{r.requestType} {r.sku} × {r.quantity}</span>
                  <div className="flex gap-2">
                    <button type="button" className="mq-btn mq-btn-primary text-xs" disabled={approveInventory.isPending} onClick={() => void approveInventory.mutateAsync(r.id)}>Approve</button>
                    <button type="button" className="mq-btn mq-btn-outline text-xs" disabled={rejectInventory.isPending} onClick={() => void rejectInventory.mutateAsync(r.id)}>Reject</button>
                  </div>
                </div>
              ))}
            </section>

            <section>
              <h2 className="text-lg mb-3">Stock snapshot</h2>
              <pre className="mq-card p-4 text-xs overflow-auto">{JSON.stringify(inventory, null, 2)}</pre>
            </section>
          </>
        )}
    </div>
  );
}

export default function SellerInventoryPage() {
  return (
    <AuthGuard roles={["SELLER"]}>
      <InventoryInner />
    </AuthGuard>
  );
}
