"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { formatMoney } from "@/lib/api/utils";
import { useWalletDashboard } from "@/lib/queries/wallet";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { Container, PageHero } from "@/components/ui/shared";
import { WalletSkeleton } from "@/components/ui/Skeleton";

function WalletInner() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data, isLoading, isError, error } = useWalletDashboard();
  const [copied, setCopied] = useState(false);

  const balance = data?.balance ?? null;
  const referral = data?.referral ?? null;
  const network = data?.network ?? null;

  const link =
    referral?.referralLink ||
    (typeof window !== "undefined" && referral?.referralCode
      ? `${window.location.origin}/my-account/register?ref=${referral.referralCode}`
      : referral?.referralCode || "");

  const copyLink = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success(t("toast.affiliateCopied"));
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <PageHero title="Wallet & MLM" breadcrumb={[{ label: "Wallet" }]} />
      <Container className="py-10 md:py-14 space-y-6 max-w-3xl mx-auto">
        {isLoading && <WalletSkeleton />}
        {isError && (
          <div className="mq-alert mq-alert-error">
            {error instanceof Error ? error.message : "Failed to load wallet"}
          </div>
        )}
        {!isLoading && (
          <>
            {user && !user.hasWalletPin ? (
              <div className="mq-alert mq-alert-error">
                Set a wallet PIN before P2P transfer or withdraw. (PIN UI in next phase)
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2 text-xs text-mq-text-muted">
              {user?.referralCode ? (
                <span className="mq-badge mq-badge-muted">Code: {user.referralCode}</span>
              ) : null}
              {user?.mlmRank != null ? (
                <span className="mq-badge mq-badge-cyan">Rank {user.mlmRank}</span>
              ) : null}
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="mq-card p-5">
                <p className="text-xs uppercase tracking-wider text-mq-text-muted">
                  Available
                </p>
                <p className="text-2xl mt-2 tabular-nums">
                  {formatMoney(balance?.availableBalance)}
                </p>
              </div>
              <div className="mq-card p-5">
                <p className="text-xs uppercase tracking-wider text-mq-text-muted">
                  Frozen
                </p>
                <p className="text-2xl mt-2 tabular-nums">
                  {formatMoney(balance?.frozenBalance)}
                </p>
              </div>
            </div>

            <div className="mq-card p-5 space-y-3">
              <h2 className="text-lg">Referral link</h2>
              <p className="text-sm break-all text-mq-text-secondary">{link || "—"}</p>
              <button
                type="button"
                className="mq-btn mq-btn-outline text-xs"
                onClick={() => void copyLink()}
              >
                {copied ? "Copied" : "Copy link"}
              </button>
            </div>

            <div className="mq-card p-5 space-y-2">
              <h2 className="text-lg">
                Network{" "}
                {network ? (
                  <span className="text-sm font-normal text-mq-text-muted">
                    ({network.totalDownline} downline
                    {network.truncated ? ", truncated" : ""})
                  </span>
                ) : null}
              </h2>
              <pre className="text-xs text-mq-text-secondary overflow-auto whitespace-pre-wrap">
                {network ? JSON.stringify(network.nodes, null, 2) : "—"}
              </pre>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/wallet/p2p" className="mq-btn mq-btn-primary">
                P2P transfer
              </Link>
              <Link href="/wallet/withdraw" className="mq-btn mq-btn-outline">
                Withdraw
              </Link>
            </div>
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
