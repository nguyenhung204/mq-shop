"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import type { TransferPreviewResult } from "@/lib/api/wallet";
import { useTransferPreview, useWalletTransfer } from "@/lib/queries/wallet";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { Container, PageHero } from "@/components/ui/shared";

function P2pPanel({
  embedded = false,
  walletHref = "/wallet",
}: {
  embedded?: boolean;
  walletHref?: string;
}) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const previewMut = useTransferPreview();
  const transferMut = useWalletTransfer();

  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [pin, setPin] = useState("");
  const [preview, setPreview] = useState<TransferPreviewResult | null>(null);
  const [localError, setLocalError] = useState("");
  const [done, setDone] = useState(false);

  const needsPin = user ? user.hasWalletPin === false : false;
  const busy = previewMut.isPending || transferMut.isPending;

  const onPreview = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError("");
    setDone(false);
    try {
      const res = await previewMut.mutateAsync({ email: email.trim() });
      setPreview(res);
    } catch {
      /* toast from hook */
    }
  };

  const onTransfer = async (e: FormEvent) => {
    e.preventDefault();
    if (!preview) return;
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
      await transferMut.mutateAsync({
        email: preview.email,
        amount: n,
        pin,
      });
      setDone(true);
      setPreview(null);
      setPin("");
      setAmount("");
      setEmail("");
    } catch {
      /* toast from hook */
    }
  };

  const body = (
    <div className={embedded ? "space-y-4 max-w-md" : "space-y-4"}>
      {needsPin ? (
        <div className="mq-alert mq-alert-error">
          {t("wallet.pinRequiredBanner")}{" "}
          <Link href={walletHref} className="underline">
            {t("wallet.title")}
          </Link>
        </div>
      ) : null}
      {localError ? <div className="mq-alert mq-alert-error">{localError}</div> : null}
      {done ? <div className="mq-alert mq-alert-success">{t("wallet.p2pSuccess")}</div> : null}

      <div className="mq-card p-6 space-y-4">
        {needsPin ? (
          <p className="text-sm text-mq-text-muted">{t("wallet.pinRequiredBanner")}</p>
        ) : !preview ? (
          <form className="space-y-3" onSubmit={(e) => void onPreview(e)}>
            <label className="block text-sm">
              <span className="text-xs text-mq-text-muted">{t("wallet.p2pEmail")}</span>
              <input
                className="mq-input mt-1"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <button className="mq-btn mq-btn-primary w-full" disabled={busy}>
              {busy ? t("wallet.loading") : t("wallet.p2pLookup")}
            </button>
          </form>
        ) : (
          <form className="space-y-3" onSubmit={(e) => void onTransfer(e)}>
            <p className="text-sm">
              {t("wallet.p2pTo")}:{" "}
              <strong>{preview.fullName || preview.email}</strong> ({preview.email})
            </p>
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
            <button
              type="button"
              className="mq-btn mq-btn-outline w-full"
              onClick={() => setPreview(null)}
            >
              {t("wallet.back")}
            </button>
            <button className="mq-btn mq-btn-primary w-full" disabled={busy}>
              {busy ? t("wallet.loading") : t("wallet.p2pConfirm")}
            </button>
          </form>
        )}
      </div>
    </div>
  );

  if (embedded) return body;

  return (
    <>
      <PageHero
        title={t("wallet.p2p")}
        breadcrumb={[
          { label: t("wallet.title"), href: "/wallet" },
          { label: t("wallet.p2p") },
        ]}
      />
      <Container className="py-10 max-w-md mx-auto">{body}</Container>
    </>
  );
}

export function WalletP2p({
  embedded = false,
  walletHref = "/wallet",
}: {
  embedded?: boolean;
  walletHref?: string;
}) {
  return (
    <AuthGuard
      roles={["BUYER", "SELLER", "SUPER_ADMIN"]}
      permissions={["TRANSFER_P2P"]}
    >
      <P2pPanel embedded={embedded} walletHref={walletHref} />
    </AuthGuard>
  );
}
