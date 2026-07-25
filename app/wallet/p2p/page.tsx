"use client";

import { FormEvent, useState } from "react";
import { walletApi, type TransferPreviewResult } from "@/lib/api/wallet";
import { ApiError } from "@/lib/api/client";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { Container, PageHero } from "@/components/ui/shared";

/** Temporary bridge — full PIN UX lands in Phase 2. */
function P2pInner() {
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [pin, setPin] = useState("");
  const [preview, setPreview] = useState<TransferPreviewResult | null>(null);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  const onPreview = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setOk("");
    try {
      const res = await walletApi.transferPreview({ email: email.trim() });
      setPreview(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Preview failed");
    } finally {
      setBusy(false);
    }
  };

  const onTransfer = async (e: FormEvent) => {
    e.preventDefault();
    if (!preview) return;
    setBusy(true);
    setError("");
    try {
      await walletApi.transfer({
        email: preview.email,
        amount: Number(amount),
        pin,
      });
      setOk("Transfer completed.");
      setPreview(null);
      setPin("");
      setAmount("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Transfer failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHero
        title="P2P transfer"
        breadcrumb={[{ label: "Wallet", href: "/wallet" }, { label: "P2P" }]}
      />
      <Container className="py-10 max-w-md mx-auto">
        <div className="mq-card p-6 space-y-4">
          {error && <div className="mq-alert mq-alert-error">{error}</div>}
          {ok && <div className="mq-alert mq-alert-success">{ok}</div>}
          {!preview ? (
            <form className="space-y-3" onSubmit={onPreview}>
              <input
                className="mq-input"
                type="email"
                placeholder="Recipient email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <button className="mq-btn mq-btn-primary w-full" disabled={busy}>
                Look up recipient
              </button>
            </form>
          ) : (
            <form className="space-y-3" onSubmit={onTransfer}>
              <p className="text-sm">
                To: <strong>{preview.fullName || preview.email}</strong> ({preview.email})
              </p>
              <input
                className="mq-input"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="Amount (USD)"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
              <input
                className="mq-input"
                type="password"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="Wallet PIN (6 digits)"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                required
              />
              <button
                type="button"
                className="mq-btn mq-btn-outline w-full"
                onClick={() => setPreview(null)}
              >
                Back
              </button>
              <button className="mq-btn mq-btn-primary w-full" disabled={busy}>
                Confirm transfer
              </button>
            </form>
          )}
        </div>
      </Container>
    </>
  );
}

export default function P2pPage() {
  return (
    <AuthGuard>
      <P2pInner />
    </AuthGuard>
  );
}
