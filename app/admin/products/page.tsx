"use client";

import { useState } from "react";
import {
  useAdminProducts,
  useApproveProduct,
  useHideAdminProduct,
  useRejectProduct,
} from "@/lib/queries/admin";
import { formatMoney } from "@/lib/api/utils";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminNav } from "@/components/admin/AdminNav";
import { Container, PageHero } from "@/components/ui/shared";
import { AdminCardListSkeleton } from "@/components/ui/Skeleton";

function ProductsInner() {
  const [status, setStatus] = useState("PENDING");
  const [reason, setReason] = useState("Nội dung không phù hợp");
  const { data: items = [], isLoading, isError, error } = useAdminProducts(status);
  const approveProduct = useApproveProduct();
  const rejectProduct = useRejectProduct();
  const hideProduct = useHideAdminProduct();

  return (
    <>
      <PageHero title="Products" breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Products" }]} />
      <Container className="py-10 space-y-4">
        <AdminNav />
        {isError && (
          <div className="mq-alert mq-alert-error">
            {error instanceof Error ? error.message : "Failed"}
          </div>
        )}
        <select className="mq-input max-w-xs" value={status} onChange={(e) => setStatus(e.target.value)}>
          {["PENDING", "ACTIVE", "REJECTED"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <input className="mq-input max-w-md" value={reason} onChange={(e) => setReason(e.target.value.slice(0, 150))} placeholder="Reject reason" />
        {isLoading && <AdminCardListSkeleton />}
        {items.map((p) => (
          <div key={p.id} className="mq-card p-4 flex flex-wrap justify-between gap-3 text-sm">
            <div>
              <p className="font-medium">{p.name || p.sku}</p>
              <p className="text-xs text-mq-text-muted">{formatMoney(p.priceUsd)} · {p.status}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" className="mq-btn mq-btn-primary text-xs" disabled={approveProduct.isPending} onClick={() => void approveProduct.mutateAsync(p.id)}>Approve</button>
              <button type="button" className="mq-btn mq-btn-outline text-xs" disabled={rejectProduct.isPending} onClick={() => void rejectProduct.mutateAsync({ id: p.id, reason: { vi: reason } })}>Reject</button>
              <button type="button" className="mq-btn mq-btn-outline text-xs" disabled={hideProduct.isPending} onClick={() => void hideProduct.mutateAsync(p.id)}>Hide</button>
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
