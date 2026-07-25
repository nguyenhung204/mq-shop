"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { formatMoney } from "@/lib/api/utils";
import type { WalletTransaction } from "@/lib/api/wallet";
import {
  useConfirmWalletPin,
  useRequestWalletPinOtp,
  useWallet,
  useWalletTransactions,
  useReferralLink,
} from "@/lib/queries/wallet";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { Container, PageHero } from "@/components/ui/shared";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { WalletSkeleton } from "@/components/ui/Skeleton";

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function reasonBadgeClass(reason: string): string {
  if (reason.startsWith("WITHDRAW")) return "mq-badge mq-badge-orange";
  if (reason === "P2P") return "mq-badge mq-badge-cyan";
  if (reason === "REFERRAL" || reason === "TEAM" || reason === "GLOBAL" || reason === "LOYALTY") {
    return "mq-badge mq-badge-muted";
  }
  return "mq-badge mq-badge-muted";
}

function PinSetupCard({ onDone }: { onDone: () => void }) {
  const { t } = useLanguage();
  const requestOtp = useRequestWalletPinOtp();
  const confirmPin = useConfirmWalletPin();
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [localError, setLocalError] = useState("");

  const onRequest = async () => {
    setLocalError("");
    try {
      await requestOtp.mutateAsync();
      setOtpSent(true);
    } catch {
      /* toast from hook */
    }
  };

  const onConfirm = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError("");
    if (!/^\d{6}$/.test(pin) || pin !== confirm) {
      setLocalError(t("wallet.pinMismatch"));
      return;
    }
    if (!/^\d{6}$/.test(otp)) {
      setLocalError(t("wallet.otpInvalid"));
      return;
    }
    try {
      await confirmPin.mutateAsync({ otp, pin, confirmPin: confirm });
      onDone();
    } catch {
      /* toast from hook */
    }
  };

  return (
    <div className="mq-card p-5 space-y-3">
      <h2 className="text-lg">{t("wallet.setPinTitle")}</h2>
      <p className="text-sm text-mq-text-muted">{t("wallet.setPinHint")}</p>
      {localError ? <div className="mq-alert mq-alert-error">{localError}</div> : null}
      {!otpSent ? (
        <button
          type="button"
          className="mq-btn mq-btn-primary"
          disabled={requestOtp.isPending}
          onClick={() => void onRequest()}
        >
          {requestOtp.isPending ? t("wallet.sendingOtp") : t("wallet.sendPinOtp")}
        </button>
      ) : (
        <form className="space-y-3" onSubmit={(e) => void onConfirm(e)}>
          <label className="block text-sm">
            <span className="text-xs text-mq-text-muted">{t("wallet.otp")}</span>
            <input
              className="mq-input mt-1"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              required
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
            />
          </label>
          <label className="block text-sm">
            <span className="text-xs text-mq-text-muted">{t("wallet.confirmPin")}</span>
            <input
              className="mq-input mt-1"
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value.replace(/\D/g, "").slice(0, 6))}
              required
            />
          </label>
          <button
            type="submit"
            className="mq-btn mq-btn-primary"
            disabled={confirmPin.isPending}
          >
            {confirmPin.isPending ? t("wallet.savingPin") : t("wallet.savePin")}
          </button>
        </form>
      )}
    </div>
  );
}

function TxRow({ row }: { row: WalletTransaction }) {
  const { t } = useLanguage();
  const signed =
    row.direction === "OUT"
      ? `−${formatMoney(row.amount)}`
      : `+${formatMoney(row.amount)}`;
  return (
    <div className="mq-card p-4 flex flex-wrap justify-between gap-3 text-sm">
      <div className="space-y-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className={reasonBadgeClass(String(row.reason))}>
            {t(`wallet.reasons.${row.reason}`)}
          </span>
          <span className="mq-badge mq-badge-muted">{row.direction}</span>
        </div>
        <p className="text-xs text-mq-text-muted">{formatWhen(row.createdAt)}</p>
      </div>
      <span
        className={`tabular-nums font-medium ${
          row.direction === "OUT" ? "text-red-600" : "text-emerald-700"
        }`}
      >
        {signed}
      </span>
    </div>
  );
}

function WalletInner() {
  const { t } = useLanguage();
  const { user, refreshUser } = useAuth();
  const { data: balance, isLoading, isError, error } = useWallet();
  const { data: referral } = useReferralLink();
  const [txPage, setTxPage] = useState(1);
  const { data: txPageData, isLoading: txLoading } = useWalletTransactions({
    page: txPage,
    pageSize: 10,
  });
  const [copied, setCopied] = useState(false);

  const link =
    referral?.referralLink ||
    (typeof window !== "undefined" && (referral?.referralCode || user?.referralCode)
      ? `${window.location.origin}/my-account/register?ref=${referral?.referralCode || user?.referralCode}`
      : "");

  const copyLink = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success(t("toast.affiliateCopied"));
    setTimeout(() => setCopied(false), 2000);
  };

  const onPinDone = async () => {
    await refreshUser();
  };

  const needsPin = user ? user.hasWalletPin === false : false;
  const txItems = txPageData?.items ?? [];
  const txMeta = txPageData?.meta;

  return (
    <>
      <PageHero
        title={t("wallet.title")}
        breadcrumb={[{ label: t("wallet.title") }]}
      />
      <Container className="py-10 md:py-14 space-y-6 max-w-3xl mx-auto">
        {isLoading && <WalletSkeleton />}
        {isError && (
          <div className="mq-alert mq-alert-error">
            {error instanceof Error ? error.message : t("wallet.loadFailed")}
          </div>
        )}
        {!isLoading && (
          <>
            {needsPin ? <PinSetupCard onDone={() => void onPinDone()} /> : null}

            <div className="flex flex-wrap gap-2 text-xs">
              {(referral?.referralCode || user?.referralCode) && (
                <span className="mq-badge mq-badge-muted">
                  {t("wallet.code")}: {referral?.referralCode || user?.referralCode}
                </span>
              )}
              {user?.mlmRank != null ? (
                <span className="mq-badge mq-badge-cyan">
                  {t("wallet.rank")} {user.mlmRank}
                </span>
              ) : null}
              {user?.hasWalletPin ? (
                <span className="mq-badge mq-badge-muted">{t("wallet.pinSet")}</span>
              ) : null}
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="mq-card p-5">
                <p className="text-xs uppercase tracking-wider text-mq-text-muted">
                  {t("wallet.available")}
                </p>
                <p className="text-2xl mt-2 tabular-nums">
                  {formatMoney(balance?.availableBalance)}
                </p>
              </div>
              <div className="mq-card p-5">
                <p className="text-xs uppercase tracking-wider text-mq-text-muted">
                  {t("wallet.frozen")}
                </p>
                <p className="text-2xl mt-2 tabular-nums">
                  {formatMoney(balance?.frozenBalance)}
                </p>
                <p className="text-xs text-mq-text-muted mt-1">{t("wallet.frozenHint")}</p>
              </div>
            </div>

            <div className="mq-card p-5 space-y-3">
              <h2 className="text-lg">{t("wallet.referralTitle")}</h2>
              <p className="text-sm break-all text-mq-text-secondary">{link || "—"}</p>
              <button
                type="button"
                className="mq-btn mq-btn-outline text-xs"
                disabled={!link}
                onClick={() => void copyLink()}
              >
                {copied ? t("wallet.copied") : t("wallet.copyLink")}
              </button>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/wallet/p2p"
                className={`mq-btn mq-btn-primary ${needsPin ? "pointer-events-none opacity-50" : ""}`}
              >
                {t("wallet.p2p")}
              </Link>
              <Link
                href="/wallet/withdraw"
                className={`mq-btn mq-btn-outline ${needsPin ? "pointer-events-none opacity-50" : ""}`}
              >
                {t("wallet.withdraw")}
              </Link>
              <Link href="/mlm/network" className="mq-btn mq-btn-outline">
                {t("wallet.network")}
              </Link>
              <Link href="/wallet/commissions" className="mq-btn mq-btn-outline">
                {t("wallet.commissions")}
              </Link>
            </div>

            <section className="space-y-3">
              <h2 className="text-lg">{t("wallet.txTitle")}</h2>
              {txLoading && txItems.length === 0 ? (
                <p className="text-sm text-mq-text-muted">{t("wallet.loading")}</p>
              ) : null}
              {!txLoading && txItems.length === 0 ? (
                <p className="text-sm text-mq-text-muted text-center py-4">
                  {t("wallet.txEmpty")}
                </p>
              ) : null}
              {txItems.map((row) => (
                <TxRow key={row.id} row={row} />
              ))}
              {txMeta ? (
                <PaginationBar page={txPage} meta={txMeta} onPageChange={setTxPage} />
              ) : null}
            </section>
          </>
        )}
      </Container>
    </>
  );
}

export function WalletDashboard() {
  return (
    <AuthGuard>
      <WalletInner />
    </AuthGuard>
  );
}
