"use client";

import { FormEvent, useEffect, useState } from "react";
import { walletApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import { asArray } from "@/lib/api/utils";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { Container, PageHero } from "@/components/ui/shared";

type Withdrawal = {
  id: string;
  amountPoints?: string | number;
  status?: string;
  createdAt?: string;
};

function WithdrawInner() {
  const [amountPoints, setAmount] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [list, setList] = useState<Withdrawal[]>([]);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setList(asArray(await walletApi.myWithdrawals()) as Withdrawal[]);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await walletApi.withdraw({
        amountPoints: Number(amountPoints),
        bankInfo: { bankName, accountNumber, accountName },
      });
      setOk("Withdrawal requested. Points frozen until Admin decision. Payout is completed outside the system.");
      setAmount("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Withdraw failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHero title="Withdraw points" breadcrumb={[{ label: "Wallet", href: "/wallet" }, { label: "Withdraw" }]} />
      <Container className="py-10 max-w-lg mx-auto space-y-6">
        {error && <div className="mq-alert mq-alert-error">{error}</div>}
        {ok && <div className="mq-alert mq-alert-success">{ok}</div>}
        <form className="mq-card p-6 space-y-3" onSubmit={onSubmit}>
          <input className="mq-input" type="number" step="0.000001" placeholder="Amount (points)" value={amountPoints} onChange={(e) => setAmount(e.target.value)} required />
          <input className="mq-input" placeholder="Bank name" value={bankName} onChange={(e) => setBankName(e.target.value)} required />
          <input className="mq-input" placeholder="Account number" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} required />
          <input className="mq-input" placeholder="Account name" value={accountName} onChange={(e) => setAccountName(e.target.value)} required />
          <button className="mq-btn mq-btn-primary w-full" disabled={busy}>Submit withdrawal</button>
        </form>
        <div className="space-y-3">
          <h2 className="text-lg">My requests</h2>
          {list.map((w) => (
            <div key={w.id} className="mq-card p-4 flex justify-between text-sm">
              <span>{w.amountPoints} pts</span>
              <span className="mq-badge mq-badge-cyan">{w.status}</span>
            </div>
          ))}
        </div>
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
