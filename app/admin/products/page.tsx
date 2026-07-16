"use client";

import { useEffect, useState } from "react";
import { adminApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import type { ApiProduct } from "@/lib/api/types";
import { asArray, formatMoney } from "@/lib/api/utils";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminNav } from "@/components/admin/AdminNav";
import { Container, PageHero } from "@/components/ui/shared";

function ProductsInner() {
  const [status, setStatus] = useState("PENDING");
  const [items, setItems] = useState<ApiProduct[]>([]);
  const [reason, setReason] = useState("Nội dung không phù hợp");
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setItems(asArray(await adminApi.products(status)) as ApiProduct[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return (
    <>
      <PageHero title="Products" breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Products" }]} />
      <Container className="py-10 space-y-4">
        <AdminNav />
        {error && <div className="mq-alert mq-alert-error">{error}</div>}
        <select className="mq-input max-w-xs" value={status} onChange={(e) => setStatus(e.target.value)}>
          {["PENDING", "ACTIVE", "REJECTED"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <input className="mq-input max-w-md" value={reason} onChange={(e) => setReason(e.target.value.slice(0, 150))} placeholder="Reject reason" />
        {items.map((p) => (
          <div key={p.id} className="mq-card p-4 flex flex-wrap justify-between gap-3 text-sm">
            <div>
              <p className="font-medium">{p.name || p.sku}</p>
              <p className="text-xs text-mq-text-muted">{formatMoney(p.priceUsd)} · {p.status}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" className="mq-btn mq-btn-primary text-xs" onClick={() => void adminApi.approveProduct(p.id).then(load).catch((e) => setError(e instanceof ApiError ? e.message : "Error"))}>Approve</button>
              <button type="button" className="mq-btn mq-btn-outline text-xs" onClick={() => void adminApi.rejectProduct(p.id, { reason: { vi: reason } }).then(load).catch((e) => setError(e instanceof ApiError ? e.message : "Error"))}>Reject</button>
              <button type="button" className="mq-btn mq-btn-outline text-xs" onClick={() => void adminApi.hideProduct(p.id).then(load).catch((e) => setError(e instanceof ApiError ? e.message : "Error"))}>Hide</button>
            </div>
          </div>
        ))}
      </Container>
    </>
  );
}

export default function AdminProductsPage() {
  return (
    <AuthGuard roles={["ADMIN", "SUPER_ADMIN"]} permissions={["APPROVE_PRODUCT"]}>
      <ProductsInner />
    </AuthGuard>
  );
}
