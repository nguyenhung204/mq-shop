"use client";

import { useEffect, useState } from "react";
import { adminApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import type { ApiShop } from "@/lib/api/types";
import { asArray } from "@/lib/api/utils";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminNav } from "@/components/admin/AdminNav";
import { Container, PageHero } from "@/components/ui/shared";

function ShopsInner() {
  const [status, setStatus] = useState("PENDING");
  const [shops, setShops] = useState<ApiShop[]>([]);
  const [reason, setReason] = useState("Thiếu giấy tờ");
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setShops(asArray(await adminApi.shops(status)) as ApiShop[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const reasonBody = { reason: { vi: reason, en: reason } };

  return (
    <>
      <PageHero title="Shops" breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Shops" }]} />
      <Container className="py-10 space-y-4">
        <AdminNav />
        {error && <div className="mq-alert mq-alert-error">{error}</div>}
        <select className="mq-input max-w-xs" value={status} onChange={(e) => setStatus(e.target.value)}>
          {["PENDING", "APPROVED", "REJECTED", "SUSPENDED"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <input className="mq-input max-w-md" placeholder="Reject/suspend reason (VI)" value={reason} onChange={(e) => setReason(e.target.value.slice(0, 150))} />
        {shops.map((s) => (
          <div key={s.id} className="mq-card p-4 flex flex-wrap justify-between gap-3 text-sm">
            <div>
              <p className="font-medium">{s.name}</p>
              <p className="text-mq-text-muted text-xs">{s.taxCode} · {s.countryCode} · {s.status}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="mq-btn mq-btn-primary text-xs" onClick={() => void adminApi.approveShop(s.id).then(load).catch((e) => setError(e instanceof ApiError ? e.message : "Error"))}>Approve</button>
              <button type="button" className="mq-btn mq-btn-outline text-xs" onClick={() => void adminApi.rejectShop(s.id, reasonBody).then(load).catch((e) => setError(e instanceof ApiError ? e.message : "Error"))}>Reject</button>
              <button type="button" className="mq-btn mq-btn-outline text-xs" onClick={() => void adminApi.suspendShop(s.id, reasonBody).then(load).catch((e) => setError(e instanceof ApiError ? e.message : "Error"))}>Suspend</button>
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
