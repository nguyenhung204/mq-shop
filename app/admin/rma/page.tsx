"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import type { RmaStatus } from "@/lib/api/orders";
import { useAdminRma, useAdminRmaDecision } from "@/lib/queries/orders";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { AdminActions, AdminIconButton } from "@/components/admin/AdminIconButton";
import { AdminCardListSkeleton } from "@/components/ui/Skeleton";

function RmaInner() {
  const [status, setStatus] = useState<RmaStatus | "">("PENDING");
  const { data, isLoading, isError, error } = useAdminRma(status || undefined);
  const items = data?.items ?? [];
  const rmaDecision = useAdminRmaDecision();

  return (
    <>
      <AdminPageHeader
        title="RMA"
        description="Approve or reject return requests. Approve → order REFUND_APPROVED (payout outside system)."
      />
      <div className="space-y-4">
        <select
          className="mq-input max-w-[12rem]"
          value={status}
          onChange={(e) => setStatus(e.target.value as RmaStatus | "")}
        >
          <option value="">All</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="CLOSED">Closed</option>
        </select>
        {isError && (
          <div className="mq-alert mq-alert-error">
            {error instanceof Error ? error.message : "Failed"}
          </div>
        )}
        {isLoading && <AdminCardListSkeleton />}
        {items.map((r) => (
          <div key={r.id} className="mq-card p-4 flex flex-wrap justify-between gap-3 text-sm">
            <div>
              <p>
                Order {r.orderId.slice(0, 8)}… ·{" "}
                <span className="mq-badge mq-badge-pink">{r.status}</span>
              </p>
              <p className="text-xs text-mq-text-muted line-clamp-2 mt-1">{r.reason}</p>
              {r.bankInfo ? (
                <p className="text-xs text-mq-text-muted mt-1">
                  {r.bankInfo.bankName} · {r.bankInfo.accountNumber} · {r.bankInfo.accountName}
                </p>
              ) : null}
              {(r.evidenceUrls?.length ?? 0) > 0 ? (
                <p className="text-xs text-mq-text-muted mt-1">
                  {r.evidenceUrls.length} evidence image(s)
                </p>
              ) : null}
            </div>
            {r.status === "PENDING" ? (
              <AdminActions>
                <AdminIconButton
                  label="Approve"
                  icon={Check}
                  tone="approve"
                  disabled={rmaDecision.isPending}
                  onClick={() =>
                    void rmaDecision.mutateAsync({ id: r.id, decision: "APPROVED" })
                  }
                />
                <AdminIconButton
                  label="Reject"
                  icon={X}
                  tone="reject"
                  disabled={rmaDecision.isPending}
                  onClick={() =>
                    void rmaDecision.mutateAsync({
                      id: r.id,
                      decision: "REJECTED",
                      note: "Not eligible",
                    })
                  }
                />
              </AdminActions>
            ) : null}
          </div>
        ))}
        {!isLoading && items.length === 0 ? (
          <p className="text-sm text-mq-text-muted">No RMA for this filter.</p>
        ) : null}
      </div>
    </>
  );
}

export default function AdminRmaPage() {
  return (
    <AuthGuard roles={["ADMIN", "SUPER_ADMIN", "ACCOUNTANT"]} permissions={["MANAGE_RMA"]}>
      <RmaInner />
    </AuthGuard>
  );
}
