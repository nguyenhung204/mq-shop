"use client";

import { useEffect, useState } from "react";
import { adminApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import type { ApiRma } from "@/lib/api/types";
import { asArray } from "@/lib/api/utils";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminNav } from "@/components/admin/AdminNav";
import { Container, PageHero } from "@/components/ui/shared";

function RmaInner() {
  const [items, setItems] = useState<ApiRma[]>([]);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setItems(asArray(await adminApi.rma()) as ApiRma[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <>
      <PageHero title="Admin RMA" breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "RMA" }]} />
      <Container className="py-10 space-y-4">
        <AdminNav />
        <p className="text-sm text-mq-text-muted">Admin can decide anytime while REQUESTED (no need to wait 3 days).</p>
        {error && <div className="mq-alert mq-alert-error">{error}</div>}
        {items.map((r) => (
          <div key={r.id} className="mq-card p-4 flex flex-wrap justify-between gap-3 text-sm">
            <div>
              <p>{r.orderId.slice(0, 8)}… · {r.status}</p>
              <p className="text-xs text-mq-text-muted line-clamp-2">{r.reason}</p>
            </div>
            {r.status === "REQUESTED" && (
              <div className="flex gap-2">
                <button type="button" className="mq-btn mq-btn-primary text-xs" onClick={() => void adminApi.rmaDecision(r.id, { decision: "APPROVED" }).then(load).catch((e) => setError(e instanceof ApiError ? e.message : "Error"))}>Approve</button>
                <button type="button" className="mq-btn mq-btn-outline text-xs" onClick={() => void adminApi.rmaDecision(r.id, { decision: "REJECTED", reason: "Not eligible" }).then(load).catch((e) => setError(e instanceof ApiError ? e.message : "Error"))}>Reject</button>
              </div>
            )}
          </div>
        ))}
      </Container>
    </>
  );
}

export default function AdminRmaPage() {
  return (
    <AuthGuard roles={["ADMIN", "SUPER_ADMIN"]} permissions={["MANAGE_RMA"]}>
      <RmaInner />
    </AuthGuard>
  );
}
