"use client";

import { FormEvent, useState } from "react";
import { walletApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { Container, PageHero } from "@/components/ui/shared";

function P2pInner() {
  const [recipient, setRecipient] = useState("");
  const [amountPoints, setAmount] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtp] = useState("");
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [idempotencyKey] = useState(() =>
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `p2p-${Date.now()}`,
  );
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  const requestOtp = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await walletApi.requestP2pOtp({ recipient, amountPoints: Number(amountPoints) });
      setStep("confirm");
      setOk("OTP sent to your email. Enter password + OTP to confirm. No PIN required.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to request OTP");
    } finally {
      setBusy(false);
    }
  };

  const transfer = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await walletApi.p2pTransfer({
        recipient,
        amountPoints: Number(amountPoints),
        password,
        otpCode,
        idempotencyKey,
      });
      setOk("Transfer completed.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Transfer failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHero title="P2P transfer" breadcrumb={[{ label: "Wallet", href: "/wallet" }, { label: "P2P" }]} />
      <Container className="py-10 max-w-md mx-auto">
        <div className="mq-card p-6 space-y-4">
          {error && <div className="mq-alert mq-alert-error">{error}</div>}
          {ok && <div className="mq-alert mq-alert-success">{ok}</div>}
          {step === "form" ? (
            <form className="space-y-3" onSubmit={requestOtp}>
              <input className="mq-input" placeholder="Recipient (id / email / phone)" value={recipient} onChange={(e) => setRecipient(e.target.value)} required />
              <input className="mq-input" type="number" step="0.000001" min="0.000001" placeholder="Amount (points)" value={amountPoints} onChange={(e) => setAmount(e.target.value)} required />
              <button className="mq-btn mq-btn-primary w-full" disabled={busy}>Request OTP</button>
            </form>
          ) : (
            <form className="space-y-3" onSubmit={transfer}>
              <input type="password" className="mq-input" placeholder="Account password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <input className="mq-input" placeholder="Email OTP" value={otpCode} onChange={(e) => setOtp(e.target.value)} required />
              <p className="text-xs text-mq-text-muted">Idempotency key: {idempotencyKey}</p>
              <button className="mq-btn mq-btn-primary w-full" disabled={busy}>Confirm transfer</button>
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
