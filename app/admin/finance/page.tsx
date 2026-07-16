"use client";

import { useEffect, useState } from "react";
import { adminApi, financeApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import { asArray } from "@/lib/api/utils";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminNav } from "@/components/admin/AdminNav";
import { Container, PageHero } from "@/components/ui/shared";

type Batch = { id: string; status?: string; netAmountUsd?: string | number };
type Withdraw = { id: string; status?: string; amountPoints?: string | number };
type Gateway = { id: string; gatewayName?: string; status?: string; createdBy?: string };

function FinanceInner() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [withdraws, setWithdraws] = useState<Withdraw[]>([]);
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [report, setReport] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const load = async () => {
    try {
      const [b, w, g] = await Promise.all([
        financeApi.payoutBatches(),
        financeApi.withdrawRequests(),
        financeApi.gateways(),
      ]);
      setBatches(asArray(b) as Batch[]);
      setWithdraws(asArray(w) as Withdraw[]);
      setGateways(asArray(g) as Gateway[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <>
      <PageHero title="Finance" breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Finance" }]} />
      <Container className="py-10 space-y-8">
        <AdminNav />
        {error && <div className="mq-alert mq-alert-error">{error}</div>}
        {msg && <div className="mq-alert mq-alert-success">{msg}</div>}
        <p className="text-sm text-mq-text-muted">
          Mark completed = paid outside the system. No bank API.
        </p>

        <section className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <h2 className="text-lg">Payout batches</h2>
            <button
              type="button"
              className="mq-btn mq-btn-outline text-xs"
              onClick={() =>
                void financeApi
                  .createPayoutBatch({})
                  .then(() => {
                    setMsg("Batch create attempted");
                    return load();
                  })
                  .catch((e) => setError(e instanceof ApiError ? e.message : "Error"))
              }
            >
              Create batch
            </button>
          </div>
          {batches.map((b) => (
            <div key={b.id} className="mq-card p-4 flex flex-wrap justify-between gap-2 text-sm">
              <span>{b.id.slice(0, 8)}… · {b.status} · {b.netAmountUsd}</span>
              <div className="flex gap-2">
                {b.status === "PENDING" && (
                  <>
                    <button type="button" className="mq-btn mq-btn-primary text-xs" onClick={() => void financeApi.approvePayout(b.id).then(load)}>Approve</button>
                    <button type="button" className="mq-btn mq-btn-outline text-xs" onClick={() => void financeApi.rejectPayout(b.id, { reason: "Invalid" }).then(load)}>Reject</button>
                  </>
                )}
                {b.status === "APPROVED" && (
                  <button type="button" className="mq-btn mq-btn-primary text-xs" onClick={() => void financeApi.completePayout(b.id).then(load)}>Mark completed</button>
                )}
              </div>
            </div>
          ))}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg">Wallet withdraw requests</h2>
          {withdraws.map((w) => (
            <div key={w.id} className="mq-card p-4 flex flex-wrap justify-between gap-2 text-sm">
              <span>{w.amountPoints} pts · {w.status}</span>
              <div className="flex gap-2">
                {w.status === "PENDING" && (
                  <>
                    <button type="button" className="mq-btn mq-btn-primary text-xs" onClick={() => void financeApi.withdrawDecision(w.id, { decision: "APPROVED" }).then(load)}>Approve</button>
                    <button type="button" className="mq-btn mq-btn-outline text-xs" onClick={() => void financeApi.withdrawDecision(w.id, { decision: "REJECTED", reason: "Invalid bank" }).then(load)}>Reject</button>
                  </>
                )}
                {w.status === "APPROVED" && (
                  <button type="button" className="mq-btn mq-btn-primary text-xs" onClick={() => void financeApi.completeWithdraw(w.id).then(load)}>Mark paid</button>
                )}
              </div>
            </div>
          ))}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg">Payment gateways</h2>
          {gateways.map((g) => (
            <div key={g.id} className="mq-card p-4 flex justify-between text-sm">
              <span>{g.gatewayName || g.id.slice(0, 8)} · {g.status}</span>
              {g.status === "PENDING_REVIEW" && (
                <div className="flex gap-2">
                  <button type="button" className="mq-btn mq-btn-primary text-xs" onClick={() => void financeApi.reviewGateway(g.id, { decision: "APPROVED" }).then(load)}>Approve</button>
                  <button type="button" className="mq-btn mq-btn-outline text-xs" onClick={() => void financeApi.reviewGateway(g.id, { decision: "REJECTED", reason: "Invalid" }).then(load)}>Reject</button>
                </div>
              )}
            </div>
          ))}
        </section>

        <button
          type="button"
          className="mq-btn mq-btn-outline"
          onClick={() =>
            void adminApi
              .dailyRefundReport()
              .then((r) => setReport(JSON.stringify(r, null, 2)))
              .catch((e) => setError(e instanceof ApiError ? e.message : "Error"))
          }
        >
          Load daily refund report
        </button>
        {report && <pre className="mq-card p-4 text-xs overflow-auto">{report}</pre>}
      </Container>
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
