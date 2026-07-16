"use client";

import { FormEvent, useEffect, useState } from "react";
import { inventoryApi, sellerApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import { asArray } from "@/lib/api/utils";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { SellerNav } from "@/components/seller/SellerNav";
import { Container, PageHero } from "@/components/ui/shared";

type Warehouse = { id: string; name: string; addressText?: string };
type InvReq = { id: string; sku: string; quantity: number; requestType: string; status: string };

function InventoryInner() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [inventory, setInventory] = useState<unknown[]>([]);
  const [pending, setPending] = useState<InvReq[]>([]);
  const [error, setError] = useState("");
  const [whForm, setWhForm] = useState({ name: "", addressText: "" });
  const [reqForm, setReqForm] = useState({
    warehouseId: "",
    sku: "",
    quantity: "1",
    requestType: "IN" as "IN" | "ADJUST_IN" | "ADJUST_OUT",
    reason: "",
  });

  const load = async () => {
    try {
      const [w, inv, pend] = await Promise.all([
        inventoryApi.warehouses(),
        inventoryApi.list(),
        sellerApi.inventoryRequests("PENDING"),
      ]);
      setWarehouses(asArray(w) as Warehouse[]);
      setInventory(asArray(inv));
      setPending(asArray(pend) as InvReq[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load inventory");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <>
      <PageHero title="Inventory" breadcrumb={[{ label: "Seller", href: "/seller" }, { label: "Inventory" }]} />
      <Container className="py-10 space-y-8">
        <SellerNav />
        {error && <div className="mq-alert mq-alert-error">{error}</div>}
        <p className="text-sm text-mq-text-muted">
          Seller/Admin requests auto-approve. Staff requests stay PENDING until you approve.
        </p>

        <form
          className="mq-card p-5 flex flex-wrap gap-3"
          onSubmit={async (e: FormEvent) => {
            e.preventDefault();
            try {
              await inventoryApi.createWarehouse(whForm);
              setWhForm({ name: "", addressText: "" });
              await load();
            } catch (err) {
              setError(err instanceof ApiError ? err.message : "Create warehouse failed");
            }
          }}
        >
          <input className="mq-input flex-1 min-w-[160px]" placeholder="Warehouse name" value={whForm.name} onChange={(e) => setWhForm({ ...whForm, name: e.target.value })} required />
          <input className="mq-input flex-[2] min-w-[200px]" placeholder="Address" value={whForm.addressText} onChange={(e) => setWhForm({ ...whForm, addressText: e.target.value })} required />
          <button className="mq-btn mq-btn-outline">Add warehouse</button>
        </form>

        <form
          className="mq-card p-5 grid sm:grid-cols-2 gap-3"
          onSubmit={async (e: FormEvent) => {
            e.preventDefault();
            try {
              await inventoryApi.createRequest({
                warehouseId: reqForm.warehouseId,
                sku: reqForm.sku,
                quantity: Number(reqForm.quantity),
                requestType: reqForm.requestType,
                reason: reqForm.reason || undefined,
              });
              await load();
            } catch (err) {
              setError(err instanceof ApiError ? err.message : "Request failed");
            }
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
          <button className="mq-btn mq-btn-primary sm:col-span-2">Create stock request</button>
        </form>

        <section>
          <h2 className="text-lg mb-3">Pending staff requests</h2>
          {pending.length === 0 && <p className="text-sm text-mq-text-muted">None</p>}
          {pending.map((r) => (
            <div key={r.id} className="mq-card p-4 mb-2 flex flex-wrap items-center justify-between gap-3 text-sm">
              <span>{r.requestType} {r.sku} × {r.quantity}</span>
              <div className="flex gap-2">
                <button type="button" className="mq-btn mq-btn-primary text-xs" onClick={() => void sellerApi.approveInventory(r.id).then(load)}>Approve</button>
                <button type="button" className="mq-btn mq-btn-outline text-xs" onClick={() => void sellerApi.rejectInventory(r.id, { reason: "Rejected by seller" }).then(load)}>Reject</button>
              </div>
            </div>
          ))}
        </section>

        <section>
          <h2 className="text-lg mb-3">Stock snapshot</h2>
          <pre className="mq-card p-4 text-xs overflow-auto">{JSON.stringify(inventory, null, 2)}</pre>
        </section>
      </Container>
    </>
  );
}

export default function SellerInventoryPage() {
  return (
    <AuthGuard roles={["SELLER"]}>
      <InventoryInner />
    </AuthGuard>
  );
}
