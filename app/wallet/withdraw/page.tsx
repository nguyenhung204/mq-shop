"use client";

import { FormEvent, useState } from "react";
import { walletApi } from "@/lib/api/wallet";
import { ApiError } from "@/lib/api/client";
import { formatMoney } from "@/lib/api/utils";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { Container, PageHero } from "@/components/ui/shared";

/** Temporary bridge — full status tracking lands in Phase 2. */
function WithdrawInner() {
  const [amount, setAmount] = useState("");
  const [pin, setPin] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [lastId, setLastId] = useState<string | null>(null);
  const [lastStatus, setLastStatus] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setOk("");
    try {
      const res = await walletApi.withdraw({
        amount: Number(amount),
        pin,
        bankInfo: { bankName, accountNumber, accountName },
      });
      setLastId(res.id);
      setLastStatus(res.status);
      setOk(
        `Withdrawal submitted (${formatMoney(res.amount)}). Funds frozen until admin decision.`,
      );
      setAmount("");
      setPin("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Withdraw failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHero
        title="Withdraw"
        breadcrumb={[{ label: "Wallet", href: "/wallet" }, { label: "Withdraw" }]}
      />
      <Container className="py-10 max-w-lg mx-auto space-y-6">
        {error && <div className="mq-alert mq-alert-error">{error}</div>}
        {ok && <div className="mq-alert mq-alert-success">{ok}</div>}
        <form className="mq-card p-6 space-y-3" onSubmit={onSubmit}>
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
          <button className="mq-btn mq-btn-primary w-full" disabled={busy}>
            Submit withdrawal
          </button>
        </form>
        {lastId ? (
          <div className="mq-card p-4 text-sm flex justify-between gap-3">
            <span className="font-mono truncate">{lastId}</span>
            <span className="mq-badge mq-badge-cyan">{lastStatus}</span>
          </div>
        ) : null}
      </Container>
    </>
  );
}

export default function WithdrawPage() {
  return (
    <AuthGuard>
      <WithdrawInner />
    </AuthGuard>
  );
}
