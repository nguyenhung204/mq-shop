"use client";

import { Check, X } from "lucide-react";
import { useAdminRma, useAdminRmaDecision } from "@/lib/queries/admin";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { AdminActions, AdminIconButton } from "@/components/admin/AdminIconButton";
import { AdminCardListSkeleton } from "@/components/ui/Skeleton";

function RmaInner() {
  const { data: items = [], isLoading, isError, error } = useAdminRma();
  const rmaDecision = useAdminRmaDecision();

  return (
    <>
      <AdminPageHeader
        title="RMA"
        description="Approve or reject return requests."
      />
      <div className="space-y-4">
        <p className="text-sm text-mq-text-muted">
          Admin can decide anytime while REQUESTED (no need to wait 3 days).
        </p>
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
                {r.orderId.slice(0, 8)}… · {r.status}
              </p>
              <p className="text-xs text-mq-text-muted line-clamp-2">{r.reason}</p>
            </div>
            {r.status === "REQUESTED" && (
              <AdminActions>
                <AdminIconButton
                  label="Approve"
                  icon={Check}
                  tone="approve"
                  disabled={rmaDecision.isPending}
                  onClick={() => void rmaDecision.mutateAsync({ id: r.id, decision: "APPROVED" })}
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
                      reason: "Not eligible",
                    })
                  }
                />
              </AdminActions>
            )}
          </div>
        ))}
      </div>
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
