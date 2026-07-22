"use client";

import { useState } from "react";
import {
  useAdminFinance,
  useApprovePayout,
  useCompletePayout,
  useCompleteWithdraw,
  useCreatePayoutBatch,
  useDailyRefundReport,
  useRejectPayout,
  useReviewGateway,
  useWithdrawDecision,
} from "@/lib/queries/admin";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { AdminActions, AdminIconButton } from "@/components/admin/AdminIconButton";
import { AdminCardListSkeleton } from "@/components/ui/Skeleton";
import { BadgeCheck, Check, X } from "lucide-react";

function FinanceInner() {
  const { data, isLoading, isError, error } = useAdminFinance();
  const createBatch = useCreatePayoutBatch();
  const approvePayout = useApprovePayout();
  const rejectPayout = useRejectPayout();
  const completePayout = useCompletePayout();
  const withdrawDecision = useWithdrawDecision();
  const completeWithdraw = useCompleteWithdraw();
  const reviewGateway = useReviewGateway();
  const refundReport = useDailyRefundReport();
  const [report, setReport] = useState("");

  const batches = data?.batches ?? [];
  const withdraws = data?.withdraws ?? [];
  const gateways = data?.gateways ?? [];

  return (
    <>
      <AdminPageHeader
        title="Finance"
        description="Payouts, withdraws, gateways, and refunds."
      />
<div className="space-y-8">
{isError && (
          <div className="mq-alert mq-alert-error">
            {error instanceof Error ? error.message : "Failed"}
          </div>
        )}
        <p className="text-sm text-mq-text-muted">
          Mark completed = paid outside the system. No bank API.
        </p>

        {isLoading && <AdminCardListSkeleton count={6} />}

        {!isLoading && (
          <>
            <section className="space-y-3">
              <div className="flex flex-wrap gap-2 items-center">
                <h2 className="text-lg">Payout batches</h2>
                <button
                  type="button"
                  className="mq-btn mq-btn-outline text-xs"
                  disabled={createBatch.isPending}
                  onClick={() => void createBatch.mutateAsync()}
                >
                  Create batch
                </button>
              </div>
              {batches.map((b) => (
                <div key={b.id} className="mq-card p-4 flex flex-wrap justify-between gap-2 text-sm">
                  <span>{b.id.slice(0, 8)}… · {b.status} · {b.netAmountUsd}</span>
                  <AdminActions>
                    {b.status === "PENDING" && (
                      <>
                        <AdminIconButton label="Approve" icon={Check} tone="approve" disabled={approvePayout.isPending} onClick={() => void approvePayout.mutateAsync(b.id)} />
                        <AdminIconButton label="Reject" icon={X} tone="reject" disabled={rejectPayout.isPending} onClick={() => void rejectPayout.mutateAsync(b.id)} />
                      </>
                    )}
                    {b.status === "APPROVED" && (
                      <AdminIconButton label="Mark completed" icon={BadgeCheck} tone="approve" disabled={completePayout.isPending} onClick={() => void completePayout.mutateAsync(b.id)} />
                    )}
                  </AdminActions>
                </div>
              ))}
            </section>

            <section className="space-y-3">
              <h2 className="text-lg">Wallet withdraw requests</h2>
              {withdraws.map((w) => (
                <div key={w.id} className="mq-card p-4 flex flex-wrap justify-between gap-2 text-sm">
                  <span>{w.amountPoints} pts · {w.status}</span>
                  <AdminActions>
                    {w.status === "PENDING" && (
                      <>
                        <AdminIconButton label="Approve" icon={Check} tone="approve" disabled={withdrawDecision.isPending} onClick={() => void withdrawDecision.mutateAsync({ id: w.id, decision: "APPROVED" })} />
                        <AdminIconButton label="Reject" icon={X} tone="reject" disabled={withdrawDecision.isPending} onClick={() => void withdrawDecision.mutateAsync({ id: w.id, decision: "REJECTED", reason: "Invalid bank" })} />
                      </>
                    )}
                    {w.status === "APPROVED" && (
                      <AdminIconButton label="Mark paid" icon={BadgeCheck} tone="approve" disabled={completeWithdraw.isPending} onClick={() => void completeWithdraw.mutateAsync(w.id)} />
                    )}
                  </AdminActions>
                </div>
              ))}
            </section>

            <section className="space-y-3">
              <h2 className="text-lg">Payment gateways</h2>
              {gateways.map((g) => (
                <div key={g.id} className="mq-card p-4 flex justify-between text-sm">
                  <span>{g.gatewayName || g.id.slice(0, 8)} · {g.status}</span>
                  {g.status === "PENDING_REVIEW" && (
                    <AdminActions>
                      <AdminIconButton label="Approve" icon={Check} tone="approve" disabled={reviewGateway.isPending} onClick={() => void reviewGateway.mutateAsync({ id: g.id, decision: "APPROVED" })} />
                      <AdminIconButton label="Reject" icon={X} tone="reject" disabled={reviewGateway.isPending} onClick={() => void reviewGateway.mutateAsync({ id: g.id, decision: "REJECTED", reason: "Invalid" })} />
                    </AdminActions>
                  )}
                </div>
              ))}
            </section>
          </>
        )}

        <button
          type="button"
          className="mq-btn mq-btn-outline"
          disabled={refundReport.isPending}
          onClick={() =>
            void refundReport.mutateAsync().then((r) => setReport(JSON.stringify(r, null, 2)))
          }
        >
          {refundReport.isPending ? "Loading…" : "Load daily refund report"}
        </button>
        {report && <pre className="mq-card p-4 text-xs overflow-auto">{report}</pre>}
      </div>
    </>
  );
}

export default function AdminFinancePage() {
  return (
    <AuthGuard
      roles={["ADMIN", "SUPER_ADMIN"]}
      permissions={["MANAGE_PAYOUT", "MANAGE_WALLET_WITHDRAW", "REVIEW_PAYMENT_GATEWAY", "VIEW_REFUND_REPORT"]}
    >
      <FinanceInner />
    </AuthGuard>
  );
}
