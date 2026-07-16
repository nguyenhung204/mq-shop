"use client";

import { useState } from "react";
import {
  useAdminShops,
  useApproveShop,
  useRejectShop,
  useSuspendShop,
} from "@/lib/queries/admin";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminNav } from "@/components/admin/AdminNav";
import { Container, PageHero } from "@/components/ui/shared";
import { AdminCardListSkeleton } from "@/components/ui/Skeleton";

function ShopsInner() {
  const [status, setStatus] = useState("PENDING");
  const [reason, setReason] = useState("Thiếu giấy tờ");
  const { data: shops = [], isLoading, isError, error } = useAdminShops(status);
  const approveShop = useApproveShop();
  const rejectShop = useRejectShop();
  const suspendShop = useSuspendShop();

  const reasonBody = { reason: { vi: reason, en: reason } };

  return (
    <>
      <PageHero title="Shops" breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Shops" }]} />
      <Container className="py-10 space-y-4">
        <AdminNav />
        {isError && (
          <div className="mq-alert mq-alert-error">
            {error instanceof Error ? error.message : "Failed"}
          </div>
        )}
        <select className="mq-input max-w-xs" value={status} onChange={(e) => setStatus(e.target.value)}>
          {["PENDING", "APPROVED", "REJECTED", "SUSPENDED"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <input className="mq-input max-w-md" placeholder="Reject/suspend reason (VI)" value={reason} onChange={(e) => setReason(e.target.value.slice(0, 150))} />
        {isLoading && <AdminCardListSkeleton />}
        {shops.map((s) => (
          <div key={s.id} className="mq-card p-4 flex flex-wrap justify-between gap-3 text-sm">
            <div>
              <p className="font-medium">{s.name}</p>
              <p className="text-mq-text-muted text-xs">{s.taxCode} · {s.countryCode} · {s.status}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="mq-btn mq-btn-primary text-xs" disabled={approveShop.isPending} onClick={() => void approveShop.mutateAsync(s.id)}>Approve</button>
              <button type="button" className="mq-btn mq-btn-outline text-xs" disabled={rejectShop.isPending} onClick={() => void rejectShop.mutateAsync({ id: s.id, reason: reasonBody.reason })}>Reject</button>
              <button type="button" className="mq-btn mq-btn-outline text-xs" disabled={suspendShop.isPending} onClick={() => void suspendShop.mutateAsync({ id: s.id, reason: reasonBody.reason })}>Suspend</button>
            </div>
          </div>
        ))}
      </Container>
    </>
  );
}

export default function AdminShopsPage() {
  return (
    <AuthGuard roles={["ADMIN", "SUPER_ADMIN"]} permissions={["APPROVE_SHOP"]}>
      <ShopsInner />
    </AuthGuard>
  );
}
