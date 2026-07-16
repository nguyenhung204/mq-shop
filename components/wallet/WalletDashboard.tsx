"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { walletApi } from "@/lib/api";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { Container, PageHero } from "@/components/ui/shared";

function WalletInner() {
  const [balance, setBalance] = useState<{ available: string | number; frozen: string | number; pointUsdRate?: string | number } | null>(null);
  const [affiliate, setAffiliate] = useState<{ code: string; link?: string } | null>(null);
  const [network, setNetwork] = useState<unknown>(null);
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const [b, a, n, s] = await Promise.all([
          walletApi.balance(),
          walletApi.affiliateLink(),
          walletApi.networkTree(),
          walletApi.commissionStats(),
        ]);
        setBalance(b);
        setAffiliate(a);
        setNetwork(n);
        setStats(s as Record<string, unknown>);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load wallet");
      }
    })();
  }, []);

  const link =
    affiliate?.link ||
    (typeof window !== "undefined" && affiliate?.code
      ? `${window.location.origin}/my-account?ref=${affiliate.code}`
      : affiliate?.code || "");

  return (
    <>
      <PageHero title="Wallet & MLM" breadcrumb={[{ label: "Wallet" }]} />
      <Container className="py-10 md:py-14 space-y-6 max-w-3xl mx-auto">
        {error && <div className="mq-alert mq-alert-error">{error}</div>}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="mq-card p-5">
            <p className="text-xs uppercase tracking-wider text-mq-text-muted">Available points</p>
            <p className="text-2xl mt-2">{balance?.available ?? "—"}</p>
          </div>
          <div className="mq-card p-5">
            <p className="text-xs uppercase tracking-wider text-mq-text-muted">Frozen points</p>
            <p className="text-2xl mt-2">{balance?.frozen ?? "—"}</p>
          </div>
        </div>
        {balance?.pointUsdRate != null && (
          <p className="text-sm text-mq-text-muted">Point ↔ USD rate: {String(balance.pointUsdRate)}</p>
        )}

        <div className="mq-card p-5 space-y-3">
          <h2 className="text-lg">Affiliate link</h2>
          <p className="text-sm break-all text-mq-text-secondary">{link || "—"}</p>
          <button
            type="button"
            className="mq-btn mq-btn-outline text-xs"
            onClick={async () => {
              if (!link) return;
              await navigator.clipboard.writeText(link);
              setCopied(true);
            }}
          >
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>

        <div className="mq-card p-5 space-y-2">
          <div className="flex items-center gap-2">
            <h2 className="text-lg">Commission stats</h2>
            <span className="mq-badge mq-badge-orange">Rates placeholder</span>
          </div>
          <pre className="text-xs text-mq-text-secondary overflow-auto whitespace-pre-wrap">
            {stats ? JSON.stringify(stats, null, 2) : "—"}
          </pre>
        </div>

        <div className="mq-card p-5 space-y-2">
          <h2 className="text-lg">Network (F1 only)</h2>
          <pre className="text-xs text-mq-text-secondary overflow-auto whitespace-pre-wrap">
            {network ? JSON.stringify(network, null, 2) : "—"}
          </pre>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href="/wallet/p2p" className="mq-btn mq-btn-primary">P2P transfer</Link>
          <Link href="/wallet/withdraw" className="mq-btn mq-btn-outline">Withdraw</Link>
        </div>
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
