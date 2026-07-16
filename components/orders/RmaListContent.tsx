"use client";

import { useEffect, useState } from "react";
import { orderApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import type { ApiRma } from "@/lib/api/types";
import { asArray } from "@/lib/api/utils";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { Container, PageHero } from "@/components/ui/shared";

function countdown(autoApproveAt?: string) {
  if (!autoApproveAt) return null;
  const ms = new Date(autoApproveAt).getTime() - Date.now();
  if (ms <= 0) return "Auto-approve window reached";
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  return `${d}d ${h}h until auto-approve`;
}

function RmaInner() {
  const [items, setItems] = useState<ApiRma[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setItems(asArray(await orderApi.myRma()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const withdraw = async (id: string) => {
    try {
      await orderApi.withdrawRma(id);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Withdraw failed");
    }
  };

  return (
    <>
      <PageHero title="My returns (RMA)" breadcrumb={[{ label: "RMA" }]} />
      <Container className="py-10 md:py-14 space-y-4">
        {loading && <p className="text-sm text-mq-text-muted">Loading…</p>}
        {error && <div className="mq-alert mq-alert-error">{error}</div>}
        {items.map((r) => (
          <div key={r.id} className="mq-card p-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Order {r.orderId.slice(0, 8)}…</p>
              <p className="text-xs text-mq-text-muted mt-1 line-clamp-2">{r.reason}</p>
              {r.status === "REQUESTED" && (
                <p className="text-xs text-mq-accent-orange mt-2">{countdown(r.autoApproveAt)}</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="mq-badge mq-badge-pink">{r.status}</span>
              {r.status === "REQUESTED" && (
                <button type="button" className="mq-btn mq-btn-outline text-xs" onClick={() => void withdraw(r.id)}>
                  Withdraw
                </button>
              )}
            </div>
          </div>
        ))}
        {!loading && items.length === 0 && !error && (
          <p className="text-mq-text-secondary text-center py-10">No RMA requests.</p>
        )}
      </Container>
    </>
  );
}

export function RmaListContent() {
  return (
    <AuthGuard>
      <RmaInner />
    </AuthGuard>
  );
}
