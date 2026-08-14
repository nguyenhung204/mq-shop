"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import type { PayoutRequestStatus } from "@/lib/api/wallet";
import { formatPoints } from "@/lib/api/utils";
import {
  useWalletWithdraw,
  useWalletWithdrawals,
} from "@/lib/queries/wallet";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { Container, PageHero } from "@/components/ui/shared";
import { AdminCardListSkeleton } from "@/components/ui/Skeleton";
import { getErrorMessage } from "@/lib/queries/utils";
import {
  formatWalletPayoutWhen,
  walletPayoutStatusBadgeClass,
} from "@/components/wallet/walletPayoutUi";
import { usePointsDisplayFx } from "@/lib/hooks/usePointsDisplayFx";

const STATUSES: Array<PayoutRequestStatus | ""> = [
  "",
  "PENDING",
  "APPROVED",
  "COMPLETED",
  "REJECTED",
  "PAY_FAILED",
];

function WithdrawPanel({
  embedded = false,
  walletHref = "/wallet",
  detailHrefBase = "/wallet/withdrawals",
}: {
  embedded?: boolean;
  walletHref?: string;
  detailHrefBase?: string;
}) {
  const { t, locale } = useLanguage();
  const { user } = useAuth();
  const withdraw = useWalletWithdraw();
  const {
    displayCurrency,
    onePointDisplay,
    onePointTwd,
    pointUsdLabel,
    isRegionTwd,
    estimateWithdraw,
    formatRegion,
    formatTwd,
    formatTwdAsRegion,
  } = usePointsDisplayFx();

  const [amount, setAmount] = useState("");
  const [pin, setPin] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [localError, setLocalError] = useState("");
  const [status, setStatus] = useState<PayoutRequestStatus | "">("");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error, isFetching } = useWalletWithdrawals({
    status: status || undefined,
    page,
    pageSize: 10,
  });
  const items = data?.items ?? [];
  const meta = data?.meta;

  const needsPin = user ? user.hasWalletPin === false : false;

  const amountNum = Number(amount);
  const fiatEstimate = useMemo(
    () => estimateWithdraw(amountNum),
    [amountNum, estimateWithdraw],
  );

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
      await withdraw.mutateAsync({
        amount: n,
        pin,
        bankInfo: { bankName, accountNumber, accountName },
      });
      setAmount("");
      setPin("");
      setPage(1);
    } catch (err) {
      setLocalError(getErrorMessage(err, t("toast.walletWithdrawFailed"), locale));
    }
  };

  const body = (
    <div className="space-y-6">
      {needsPin ? (
        <div className="mq-alert mq-alert-error">
          {t("wallet.pinRequiredBanner")}{" "}
          <Link href={walletHref} className="underline">
            {t("wallet.title")}
          </Link>
        </div>
      ) : null}
      {localError ? <div className="mq-alert mq-alert-error">{localError}</div> : null}
      <div className="rounded-md border border-mq-border/70 bg-mq-surface/40 px-4 py-3 text-sm space-y-1">
        <p className="text-mq-text-secondary">
          {t("wallet.pointsExplainer", { usd: pointUsdLabel })}
        </p>
        {onePointDisplay != null ? (
          <p className="text-xs text-mq-text-muted">
            {t("wallet.pointsRateToday", {
              amount: formatRegion(onePointDisplay) ?? "",
            })}
          </p>
        ) : null}
        {!isRegionTwd && onePointTwd != null ? (
          <p className="text-xs text-mq-text-muted">
            {t("wallet.pointsRateTwd", {
              amount: formatTwd(onePointTwd) ?? "",
            })}
          </p>
        ) : null}
        <p className="text-xs text-mq-text-muted">{t("wallet.withdrawHint")}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 items-start">
        <form className="mq-card p-6 space-y-3" onSubmit={(e) => void onSubmit(e)}>
          <h2 className="text-lg">{t("wallet.withdraw")}</h2>
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
          {fiatEstimate.twd != null ? (
            <div className="text-sm text-mq-text-secondary -mt-1 space-y-0.5">
              <p>
                {t("wallet.withdrawFiatEstimate", {
                  amount: formatTwd(fiatEstimate.twd) ?? "",
                })}
              </p>
              {!isRegionTwd && fiatEstimate.display != null ? (
                <p className="text-xs text-mq-text-muted">
                  {t("wallet.withdrawRegionApprox", {
                    amount: formatRegion(fiatEstimate.display) ?? "",
                    currency: displayCurrency,
                  })}
                </p>
              ) : null}
            </div>
          ) : null}
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
          {!needsPin ? (
            <p className="text-xs text-mq-text-muted -mt-1">
              <Link href={walletHref} className="underline">
                {t("wallet.forgotPin")}
              </Link>
            </p>
          ) : null}
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

        <section className="mq-card p-6 space-y-3 min-w-0">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-lg">{t("wallet.withdrawRequests")}</h2>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs text-mq-text-muted">
                {t("wallet.withdrawFilterStatus")}
              </span>
              <select
                className="mq-input !w-[11rem] max-w-full"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as PayoutRequestStatus | "");
                  setPage(1);
                }}
              >
                <option value="">{t("wallet.withdrawFilterAll")}</option>
                {STATUSES.filter(Boolean).map((s) => (
                  <option key={s} value={s}>
                    {t(`wallet.payoutStatus.${s}`)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {isError ? (
            <div className="mq-alert mq-alert-error">
              {getErrorMessage(error, t("wallet.loadFailed"))}
            </div>
          ) : null}

          {(isLoading || isFetching) && items.length === 0 ? (
            <AdminCardListSkeleton count={3} />
          ) : null}

          {!isLoading && items.length === 0 && !isError ? (
            <p className="text-sm text-mq-text-muted py-4 text-center">
              {t("wallet.withdrawEmpty")}
            </p>
          ) : null}

          <div className="space-y-2 max-h-[32rem] overflow-y-auto pr-1">
            {items.map((w) => (
              <Link
                key={w.id}
                href={`${detailHrefBase}/${w.id}`}
                className="rounded-md border border-mq-border p-3 flex items-center justify-between gap-3 text-sm hover:border-mq-accent transition-colors block"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <p className="tabular-nums font-medium">{formatPoints(w.amount)}</p>
                  {w.fiatAmount ? (
                    <div className="text-xs text-mq-text-muted space-y-0.5">
                      <p>
                        {t("wallet.fiatApprox", {
                          amount: formatTwd(w.fiatAmount) ?? "",
                        })}
                      </p>
                      {!isRegionTwd ? (
                        <p>
                          {t("wallet.fiatApproxRegion", {
                            amount: formatTwdAsRegion(w.fiatAmount) ?? "",
                            currency: displayCurrency,
                          })}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  <p className="text-xs text-mq-text-muted">
                    {formatWalletPayoutWhen(w.createdAt)}
                  </p>
                </div>
                <span className={`${walletPayoutStatusBadgeClass(w.status)} shrink-0`}>
                  {t(`wallet.payoutStatus.${w.status}`)}
                </span>
              </Link>
            ))}
          </div>

          {meta ? (
            <PaginationBar page={page} meta={meta} onPageChange={setPage} />
          ) : null}
        </section>
      </div>
    </div>
  );

  if (embedded) return body;

  return (
    <>
      <PageHero
        title={t("wallet.withdraw")}
        breadcrumb={[
          { label: t("wallet.title"), href: "/wallet" },
          { label: t("wallet.withdraw") },
        ]}
      />
      <Container className="py-10 max-w-5xl mx-auto">{body}</Container>
    </>
  );
}

export function WalletWithdraw({
  embedded = false,
  walletHref = "/wallet",
  detailHrefBase = "/wallet/withdrawals",
}: {
  embedded?: boolean;
  walletHref?: string;
  detailHrefBase?: string;
}) {
  return (
    <AuthGuard
      roles={["BUYER", "SELLER", "SUPER_ADMIN"]}
      permissions={["CREATE_PAYOUT"]}
    >
      <WithdrawPanel
        embedded={embedded}
        walletHref={walletHref}
        detailHrefBase={detailHrefBase}
      />
    </AuthGuard>
  );
}
