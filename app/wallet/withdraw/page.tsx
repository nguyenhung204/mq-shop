"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { formatMoney } from "@/lib/api/utils";
import type { UserPayoutRequest } from "@/lib/api/wallet";
import { useWalletWithdraw } from "@/lib/queries/wallet";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { Container, PageHero } from "@/components/ui/shared";

function WithdrawInner() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const withdraw = useWalletWithdraw();

  const [amount, setAmount] = useState("");
  const [pin, setPin] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [localError, setLocalError] = useState("");
  const [requests, setRequests] = useState<UserPayoutRequest[]>([]);

  const needsPin = user ? user.hasWalletPin === false : false;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError("");
    if (!/^\d{6}$/.test(pin)) {
      setLocalError(t("wallet.pinMismatch"));
      return;
    }
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      setLocalError(t("wallet.p2pAmountInvalid"));
      return;
    }
    try {
      const res = await withdraw.mutateAsync({
        amount: n,
        pin,
        bankInfo: { bankName, accountNumber, accountName },
      });
      setRequests((prev) => [res, ...prev]);
      setAmount("");
      setPin("");
    } catch {
      /* toast from hook */
    }
  };

  return (
    <>
      <PageHero
        title={t("wallet.withdraw")}
        breadcrumb={[
          { label: t("wallet.title"), href: "/wallet" },
          { label: t("wallet.withdraw") },
        ]}
      />
      <Container className="py-10 max-w-lg mx-auto space-y-6">
        {needsPin ? (
          <div className="mq-alert mq-alert-error">
            {t("wallet.pinRequiredBanner")}{" "}
            <Link href="/wallet" className="underline">
              {t("wallet.title")}
            </Link>
          </div>
        ) : null}
        {localError ? <div className="mq-alert mq-alert-error">{localError}</div> : null}
        <p className="text-sm text-mq-text-muted">{t("wallet.withdrawHint")}</p>

        <form className="mq-card p-6 space-y-3" onSubmit={(e) => void onSubmit(e)}>
          <label className="block text-sm">
            <span className="text-xs text-mq-text-muted">{t("wallet.p2pAmount")}</span>
            <input
              className="mq-input mt-1"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              disabled={needsPin}
            />
          </label>
          <label className="block text-sm">
            <span className="text-xs text-mq-text-muted">{t("wallet.pin")}</span>
            <input
              className="mq-input mt-1"
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              required
              disabled={needsPin}
            />
          </label>
          <label className="block text-sm">
            <span className="text-xs text-mq-text-muted">{t("wallet.bankName")}</span>
            <input
              className="mq-input mt-1"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              required
              disabled={needsPin}
            />
          </label>
          <label className="block text-sm">
            <span className="text-xs text-mq-text-muted">{t("wallet.accountNumber")}</span>
            <input
              className="mq-input mt-1"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              required
              disabled={needsPin}
            />
          </label>
          <label className="block text-sm">
            <span className="text-xs text-mq-text-muted">{t("wallet.accountName")}</span>
            <input
              className="mq-input mt-1"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              required
              disabled={needsPin}
            />
          </label>
          <button
            className="mq-btn mq-btn-primary w-full"
            disabled={needsPin || withdraw.isPending}
          >
            {withdraw.isPending ? t("wallet.loading") : t("wallet.withdrawSubmit")}
          </button>
        </form>

        {requests.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-lg">{t("wallet.withdrawRequests")}</h2>
            {requests.map((w) => (
              <div
                key={w.id}
                className="mq-card p-4 flex flex-wrap justify-between gap-3 text-sm"
              >
                <div className="space-y-1 min-w-0">
                  <p className="tabular-nums font-medium">{formatMoney(w.amount)}</p>
                  <p className="text-xs text-mq-text-muted font-mono truncate">{w.id}</p>
                </div>
                <span className="mq-badge mq-badge-cyan">
                  {t(`wallet.payoutStatus.${w.status}`)}
                </span>
              </div>
            ))}
          </section>
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
