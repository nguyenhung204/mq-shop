"use client";

import { useAdminRma, useAdminRmaDecision } from "@/lib/queries/admin";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminNav } from "@/components/admin/AdminNav";
import { Container, PageHero } from "@/components/ui/shared";
import { AdminCardListSkeleton } from "@/components/ui/Skeleton";

function RmaInner() {
  const { data: items = [], isLoading, isError, error } = useAdminRma();
  const rmaDecision = useAdminRmaDecision();

  return (
    <>
      <PageHero title="Admin RMA" breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "RMA" }]} />
      <Container className="py-10 space-y-4">
        <AdminNav />
        <p className="text-sm text-mq-text-muted">Admin can decide anytime while REQUESTED (no need to wait 3 days).</p>
        {isError && (
          <div className="mq-alert mq-alert-error">
            {error instanceof Error ? error.message : "Failed"}
          </div>
        )}
        {isLoading && <AdminCardListSkeleton />}
        {items.map((r) => (
          <div key={r.id} className="mq-card p-4 flex flex-wrap justify-between gap-3 text-sm">
            <div>
              <p>{r.orderId.slice(0, 8)}… · {r.status}</p>
              <p className="text-xs text-mq-text-muted line-clamp-2">{r.reason}</p>
            </div>
            {r.status === "REQUESTED" && (
              <div className="flex gap-2">
                <button type="button" className="mq-btn mq-btn-primary text-xs" disabled={rmaDecision.isPending} onClick={() => void rmaDecision.mutateAsync({ id: r.id, decision: "APPROVED" })}>Approve</button>
                <button type="button" className="mq-btn mq-btn-outline text-xs" disabled={rmaDecision.isPending} onClick={() => void rmaDecision.mutateAsync({ id: r.id, decision: "REJECTED", reason: "Not eligible" })}>Reject</button>
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
