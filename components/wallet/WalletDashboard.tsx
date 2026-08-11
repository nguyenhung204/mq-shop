"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { formatMoney } from "@/lib/api/utils";
import type { WalletTransaction, WalletTxReason } from "@/lib/api/wallet";
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
import { translateStatus } from "@/lib/i18n/status";
import { Container, PageHero } from "@/components/ui/shared";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { WalletSkeleton } from "@/components/ui/Skeleton";
import { WalletRankProgress } from "@/components/wallet/WalletRankProgress";
import { buildReferralRegisterUrl } from "@/lib/mlm/referralLink";
import { mlmRankLabel } from "@/lib/i18n/mlm-rank";
import { getErrorMessage } from "@/lib/queries/utils";

const TX_REASONS: Array<WalletTxReason | ""> = [
  "",
  "P2P",
  "WITHDRAW_FREEZE",
  "WITHDRAW_RELEASE",
  "WITHDRAW_COMPLETE",
  "REFERRAL",
  "TEAM",
  "GLOBAL",
  "LOYALTY",
  "ADJUST",
  "SELLER_PAYOUT",
];

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
  if (reason === "SELLER_PAYOUT") return "mq-badge mq-badge-green";
  if (reason === "REFERRAL" || reason === "TEAM" || reason === "GLOBAL" || reason === "LOYALTY") {
    return "mq-badge mq-badge-muted";
  }
  return "mq-badge mq-badge-muted";
}

type PinFlowMode = "set" | "change" | "forgot";

function PinSetupCard({
  mode,
  onDone,
  onCancel,
}: {
  mode: PinFlowMode;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const { t, locale } = useLanguage();
  const requestOtp = useRequestWalletPinOtp();
  const confirmPin = useConfirmWalletPin();
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [localError, setLocalError] = useState("");

  const titleKey =
    mode === "change"
      ? "wallet.changePinTitle"
      : mode === "forgot"
        ? "wallet.forgotPinTitle"
        : "wallet.setPinTitle";
  const hintKey =
    mode === "change"
      ? "wallet.changePinHint"
      : mode === "forgot"
        ? "wallet.forgotPinHint"
        : "wallet.setPinHint";
  const saveKey =
    mode === "set" ? "wallet.savePin" : "wallet.updatePin";

  const onRequest = async () => {
    setLocalError("");
    try {
      await requestOtp.mutateAsync();
      setOtpSent(true);
    } catch (err) {
      setLocalError(getErrorMessage(err, t("toast.walletPinOtpFailed"), locale));
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
    } catch (err) {
      setLocalError(getErrorMessage(err, t("toast.walletPinConfirmFailed"), locale));
    }
  };

  return (
    <div className="mq-card p-5 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1 min-w-0">
          <h2 className="text-lg">{t(titleKey)}</h2>
          <p className="text-sm text-mq-text-muted">{t(hintKey)}</p>
        </div>
        {onCancel ? (
          <button
            type="button"
            className="mq-btn mq-btn-outline text-xs shrink-0"
            onClick={onCancel}
          >
            {t("wallet.back")}
          </button>
        ) : null}
      </div>
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
            <span className="text-xs text-mq-text-muted">{t("wallet.newPin")}</span>
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
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              className="mq-btn mq-btn-primary"
              disabled={confirmPin.isPending}
            >
              {confirmPin.isPending ? t("wallet.savingPin") : t(saveKey)}
            </button>
            <button
              type="button"
              className="mq-btn mq-btn-outline"
              disabled={requestOtp.isPending}
              onClick={() => void onRequest()}
            >
              {requestOtp.isPending ? t("wallet.sendingOtp") : t("wallet.resendPinOtp")}
            </button>
          </div>
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
          <span className="mq-badge mq-badge-muted">
            {translateStatus(t, "walletDirection", row.direction)}
          </span>
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

function WalletInner({ embedded = false }: { embedded?: boolean }) {
  const { t } = useLanguage();
  const { user, refreshUser, hasRole } = useAuth();
  const { data: balance, isLoading, isError, error } = useWallet();
  const { data: referral } = useReferralLink();
  const [txPage, setTxPage] = useState(1);
  const [txReason, setTxReason] = useState<WalletTxReason | "">("");
  const { data: txPageData, isLoading: txLoading } = useWalletTransactions({
    page: txPage,
    pageSize: 10,
    reason: txReason || undefined,
  });
  const [copied, setCopied] = useState(false);
  const [pinFlow, setPinFlow] = useState<PinFlowMode | null>(null);

  const link = buildReferralRegisterUrl(
    referral?.referralCode || user?.referralCode,
  );

  const copyLink = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success(t("toast.affiliateCopied"));
    setTimeout(() => setCopied(false), 2000);
  };

  const onPinDone = async () => {
    setPinFlow(null);
    await refreshUser();
  };

  const needsPin = user ? user.hasWalletPin === false : false;
  const txItems = txPageData?.items ?? [];
  const txMeta = txPageData?.meta;
  const activePinFlow: PinFlowMode | null = needsPin ? "set" : pinFlow;

  const body = (
    <div className="space-y-6">
      {isLoading && <WalletSkeleton />}
      {isError && (
        <div className="mq-alert mq-alert-error">
          {getErrorMessage(error, t("wallet.loadFailed"))}
        </div>
      )}
      {!isLoading && (
        <>
          {activePinFlow ? (
            <PinSetupCard
              key={activePinFlow}
              mode={activePinFlow}
              onDone={() => void onPinDone()}
              onCancel={
                activePinFlow === "set" ? undefined : () => setPinFlow(null)
              }
            />
          ) : null}

          <div className="flex flex-wrap gap-2 text-xs items-center">
            {(referral?.referralCode || user?.referralCode) && (
              <span className="mq-badge mq-badge-muted">
                {t("wallet.code")}: {referral?.referralCode || user?.referralCode}
              </span>
            )}
            {hasRole("SELLER") && user?.mlmRank != null ? (
              <span className="mq-badge mq-badge-cyan">
                {user.mlmRank >= 1
                  ? t("wallet.rankLabel", {
                      rank: String(user.mlmRank),
                      name: mlmRankLabel(t, user.mlmRank),
                    })
                  : t("wallet.rankSeller")}
              </span>
            ) : null}
            {user?.referralRateOverride != null &&
            user.referralRateOverride !== "" ? (
              <span className="mq-badge mq-badge-muted">
                {t("wallet.referralRateOverride")}: {user.referralRateOverride}%{" "}
                ({t("admin.mlm.rateOverrideIgnored")})
              </span>
            ) : null}
            {user?.hasWalletPin ? (
              <span className="mq-badge mq-badge-muted">{t("wallet.pinSet")}</span>
            ) : null}
          </div>

          <WalletRankProgress />

          {user?.hasWalletPin && !activePinFlow ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="mq-btn mq-btn-outline text-xs"
                onClick={() => setPinFlow("change")}
              >
                {t("wallet.changePin")}
              </button>
              <button
                type="button"
                className="mq-btn mq-btn-outline text-xs"
                onClick={() => setPinFlow("forgot")}
              >
                {t("wallet.forgotPin")}
              </button>
            </div>
          ) : null}

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

          {hasRole("SELLER") ? (
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
          ) : (
            <div className="mq-card p-5 space-y-3">
              <h2 className="text-lg">{t("wallet.referralBuyerGate")}</h2>
              <p className="text-sm text-mq-text-secondary">{t("wallet.referralBuyerGateHint")}</p>
              <Link href="/seller/shop" className="mq-btn mq-btn-primary text-xs inline-block">
                {t("wallet.referralBuyerGateCta")}
              </Link>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Link
              href={embedded ? "/seller/wallet/transfer" : "/wallet/p2p"}
              className={`mq-btn mq-btn-primary ${needsPin ? "pointer-events-none opacity-50" : ""}`}
            >
              {t("wallet.p2p")}
            </Link>
            <Link
              href={embedded ? "/seller/wallet/withdraw" : "/wallet/withdraw"}
              className={`mq-btn mq-btn-outline ${needsPin ? "pointer-events-none opacity-50" : ""}`}
            >
              {t("wallet.withdraw")}
            </Link>
            <Link
              href={embedded ? "/seller/wallet/network" : "/mlm/network"}
              className="mq-btn mq-btn-outline"
            >
              {t("wallet.network")}
            </Link>
            <Link
              href={embedded ? "/seller/wallet/commissions" : "/wallet/commissions"}
              className="mq-btn mq-btn-outline"
            >
              {t("wallet.commissions")}
            </Link>
          </div>

          <section className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-lg">{t("wallet.txTitle")}</h2>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-mq-text-muted">{t("wallet.txReason")}</span>
                <select
                  className="mq-input !w-[12rem] max-w-full"
                  value={txReason}
                  onChange={(e) => {
                    setTxReason(e.target.value as WalletTxReason | "");
                    setTxPage(1);
                  }}
                >
                  <option value="">{t("wallet.txReasonAll")}</option>
                  {TX_REASONS.filter(Boolean).map((r) => (
                    <option key={r} value={r}>
                      {t(`wallet.reasons.${r}`)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
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
    </div>
  );

  if (embedded) return body;

  return (
    <>
      <PageHero
        title={t("wallet.title")}
        breadcrumb={[{ label: t("wallet.title") }]}
      />
      <Container className="py-10 md:py-14 max-w-3xl mx-auto">{body}</Container>
    </>
  );
}

export function WalletDashboard({ embedded = false }: { embedded?: boolean }) {
  return (
    <AuthGuard
      roles={["BUYER", "SELLER", "SUPER_ADMIN"]}
      permissions={["VIEW_WALLET"]}
    >
      <WalletInner embedded={embedded} />
    </AuthGuard>
  );
}
