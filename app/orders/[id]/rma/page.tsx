"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useCreateRma, useOrder } from "@/lib/queries/orders";
import { canRequestRma } from "@/lib/api/orders";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { Container, PageHero } from "@/components/ui/shared";

function CreateRmaInner() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: order } = useOrder(id);
  const createRma = useCreateRma(id);
  const [reason, setReason] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");

  const allowed = order ? canRequestRma(order) : false;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (reason.length < 5 || reason.length > 1000) {
      setError("Reason must be 5–1000 characters.");
      return;
    }
    setError("");
    try {
      await createRma.mutateAsync({
        body: {
          reason,
          bankInfo: { bankName, accountNumber, accountName },
        },
        evidence: files.length ? files.slice(0, 5) : undefined,
      });
      router.push(`/orders/${id}`);
    } catch {
      setError("Failed to create RMA");
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
        {!order ? (
          <p className="text-sm text-mq-text-muted">Loading order…</p>
        ) : !allowed ? (
          <div className="mq-alert mq-alert-error">
            RMA is only available within 7 days after delivery.
            <Link href={`/orders/${id}`} className="underline ml-2">
              Back to order
            </Link>
          </div>
        ) : (
          <form onSubmit={(e) => void onSubmit(e)} className="mq-card p-6 space-y-4">
            <p className="text-sm text-mq-text-secondary">
              Submit reason + bank details for refund. Evidence images are optional (max 5). After
              admin approval, order becomes REFUND_APPROVED — payout is handled outside the system.
            </p>
            {error ? <div className="mq-alert mq-alert-error">{error}</div> : null}
            <textarea
              className="mq-textarea"
              placeholder="Reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
            <input
              className="mq-input"
              placeholder="Bank name"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              required
            />
            <input
              className="mq-input"
              placeholder="Account number"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              required
            />
            <input
              className="mq-input"
              placeholder="Account name"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              required
            />
            <div>
              <label className="block text-sm mb-1.5" htmlFor="evidence">
                Evidence images (optional, max 5)
              </label>
              <input
                id="evidence"
                className="mq-input"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 5))}
              />
            </div>
            <button className="mq-btn mq-btn-primary w-full" disabled={createRma.isPending}>
              {createRma.isPending ? "Submitting…" : "Submit RMA"}
            </button>
          </form>
        )}
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
