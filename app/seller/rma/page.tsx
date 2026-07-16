"use client";

import { FormEvent, useEffect, useState } from "react";
import { inventoryApi, sellerApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import type { ApiRma } from "@/lib/api/types";
import { asArray } from "@/lib/api/utils";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { SellerNav } from "@/components/seller/SellerNav";
import { Container, PageHero } from "@/components/ui/shared";

type Warehouse = { id: string; name: string };

function SellerRmaInner() {
  const [items, setItems] = useState<ApiRma[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [error, setError] = useState("");
  const [forms, setForms] = useState<Record<string, { warehouseId: string; sku: string; quantity: string; kind: "RETURNED" | "NEW"; note: string }>>({});

  const load = async () => {
    try {
      const [r, w] = await Promise.all([sellerApi.rma(), inventoryApi.warehouses()]);
      setItems(asArray(r));
      setWarehouses(asArray(w) as Warehouse[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const confirm = async (id: string, e: FormEvent) => {
    e.preventDefault();
    const f = forms[id];
    if (!f) return;
    try {
      await sellerApi.confirmStockReturn(id, {
        warehouseId: f.warehouseId,
        sku: f.sku,
        quantity: Number(f.quantity),
        kind: f.kind,
        note: f.note || undefined,
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Confirm failed");
    }
  };

  return (
    <>
      <PageHero title="Seller RMA" breadcrumb={[{ label: "Seller", href: "/seller" }, { label: "RMA" }]} />
      <Container className="py-10 space-y-4">
        <SellerNav />
        <p className="text-sm text-mq-text-muted">
          You cannot approve/reject RMA. After APPROVED, confirm stock when goods arrive (qty + RETURNED/NEW).
        </p>
        {error && <div className="mq-alert mq-alert-error">{error}</div>}
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
                  onChange={(e) =>
                    setForms({
                      ...forms,
                      [r.id]: {
                        warehouseId: e.target.value,
                        sku: forms[r.id]?.sku || "",
                        quantity: forms[r.id]?.quantity || "1",
                        kind: forms[r.id]?.kind || "RETURNED",
                        note: forms[r.id]?.note || "",
                      },
                    })
                  }
                >
                  <option value="">Warehouse</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
                <input
                  className="mq-input"
                  placeholder="SKU"
                  required
                  value={forms[r.id]?.sku || ""}
                  onChange={(e) =>
                    setForms({
                      ...forms,
                      [r.id]: {
                        warehouseId: forms[r.id]?.warehouseId || "",
                        sku: e.target.value,
                        quantity: forms[r.id]?.quantity || "1",
                        kind: forms[r.id]?.kind || "RETURNED",
                        note: forms[r.id]?.note || "",
                      },
                    })
                  }
                />
                <input
                  className="mq-input"
                  type="number"
                  min="1"
                  required
                  value={forms[r.id]?.quantity || "1"}
                  onChange={(e) =>
                    setForms({
                      ...forms,
                      [r.id]: {
                        warehouseId: forms[r.id]?.warehouseId || "",
                        sku: forms[r.id]?.sku || "",
                        quantity: e.target.value,
                        kind: forms[r.id]?.kind || "RETURNED",
                        note: forms[r.id]?.note || "",
                      },
                    })
                  }
                />
                <select
                  className="mq-input"
                  value={forms[r.id]?.kind || "RETURNED"}
                  onChange={(e) =>
                    setForms({
                      ...forms,
                      [r.id]: {
                        warehouseId: forms[r.id]?.warehouseId || "",
                        sku: forms[r.id]?.sku || "",
                        quantity: forms[r.id]?.quantity || "1",
                        kind: e.target.value as "RETURNED" | "NEW",
                        note: forms[r.id]?.note || "",
                      },
                    })
                  }
                >
                  <option value="RETURNED">RETURNED</option>
                  <option value="NEW">NEW</option>
                </select>
                <input
                  className="mq-input sm:col-span-2"
                  placeholder="Note"
                  value={forms[r.id]?.note || ""}
                  onChange={(e) =>
                    setForms({
                      ...forms,
                      [r.id]: {
                        warehouseId: forms[r.id]?.warehouseId || "",
                        sku: forms[r.id]?.sku || "",
                        quantity: forms[r.id]?.quantity || "1",
                        kind: forms[r.id]?.kind || "RETURNED",
                        note: e.target.value,
                      },
                    })
                  }
                />
                <button className="mq-btn mq-btn-primary sm:col-span-2">Confirm stock return</button>
              </form>
            )}
          </div>
        ))}
      </Container>
    </>
  );
}

export default function SellerRmaPage() {
  return (
    <AuthGuard roles={["SELLER"]}>
      <SellerRmaInner />
    </AuthGuard>
  );
}
