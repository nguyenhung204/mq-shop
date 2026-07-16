"use client";

import { useParams, useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { orderApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { Container, PageHero } from "@/components/ui/shared";

function CreateRmaInner() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState("");
  const [refundAccountInfo, setRefund] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (reason.length < 5 || reason.length > 1000) {
      setError("Reason must be 5–1000 characters.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const evidenceUrls = evidence
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 10);
      await orderApi.createRma(id, {
        reason,
        evidenceUrls: evidenceUrls.length ? evidenceUrls : undefined,
        refundAccountInfo: refundAccountInfo || undefined,
      });
      router.push("/rma");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create RMA");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHero
        title="Request return"
        breadcrumb={[
          { label: "Orders", href: "/orders" },
          { label: id.slice(0, 8), href: `/orders/${id}` },
          { label: "RMA" },
        ]}
      />
      <Container className="py-10 max-w-lg mx-auto">
        <form onSubmit={onSubmit} className="mq-card p-6 space-y-4">
          <p className="text-sm text-mq-text-secondary">
            Within 7 days of delivery. Seller cannot approve/reject in-app — after 3 days the system may auto-approve unless Admin intervenes. Refunds are recorded only (paid outside the system).
          </p>
          {error && <div className="mq-alert mq-alert-error">{error}</div>}
          <textarea className="mq-textarea" placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} required />
          <input className="mq-input" placeholder="Evidence URLs (comma-separated)" value={evidence} onChange={(e) => setEvidence(e.target.value)} />
          <input className="mq-input" placeholder="Refund account info" value={refundAccountInfo} onChange={(e) => setRefund(e.target.value)} />
          <button className="mq-btn mq-btn-primary w-full" disabled={busy}>Submit RMA</button>
        </form>
      </Container>
    </>
  );
}

export default function CreateRmaPage() {
  return (
    <AuthGuard>
      <CreateRmaInner />
    </AuthGuard>
  );
}
