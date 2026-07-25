"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { formatMoney } from "@/lib/api/utils";
import type { TransferPreviewResult } from "@/lib/api/wallet";
import {
  useNetworkTree,
  useTransferPreview,
  useWallet,
  useWalletTransfer,
} from "@/lib/queries/wallet";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/ui/SearchableSelect";
import { Container, PageHero } from "@/components/ui/shared";

const AMOUNT_PRESETS = [10, 20, 50, 100, 200, 500] as const;

function formatPreset(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return String(Number(n.toFixed(2)));
}

function P2pPanel({
  embedded = false,
  walletHref = "/wallet",
}: {
  embedded?: boolean;
  walletHref?: string;
}) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: balance } = useWallet();
  const previewMut = useTransferPreview();
  const transferMut = useWalletTransfer();
  const { data: tree } = useNetworkTree(
    { maxDepth: 20, limit: 500 },
    { enabled: Boolean(user) && user.hasWalletPin !== false },
  );

  const [recipientKey, setRecipientKey] = useState("");
  const [amount, setAmount] = useState("");
  const [pin, setPin] = useState("");
  const [preview, setPreview] = useState<TransferPreviewResult | null>(null);
  const [localError, setLocalError] = useState("");
  const [done, setDone] = useState(false);

  const needsPin = user ? user.hasWalletPin === false : false;
  const busy = previewMut.isPending || transferMut.isPending;

  const available = useMemo(() => {
    const n = Number(balance?.availableBalance);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [balance?.availableBalance]);

  const amountSuggestions = useMemo(() => {
    const presets = AMOUNT_PRESETS.filter((n) => n <= available);
    const chips: { key: string; label: string; value: string }[] = presets.map((n) => ({
      key: `p-${n}`,
      label: formatPreset(n),
      value: formatPreset(n),
    }));
    if (available > 0) {
      const maxLabel = formatPreset(Math.round(available * 100) / 100);
      if (!chips.some((c) => c.value === maxLabel)) {
        chips.push({
          key: "all",
          label: t("wallet.p2pAmountAll"),
          value: maxLabel,
        });
      }
    }
    return chips;
  }, [available, t]);

  const recipientOptions = useMemo<SearchableSelectOption[]>(() => {
    const nodes = tree?.nodes ?? [];
    const byKey = new Map<string, SearchableSelectOption>();
    for (const n of nodes) {
      if (!n.userId || n.userId === user?.id) continue;
      const email = n.email?.trim() || "";
      const name = n.fullName?.trim() || "";
      const label = name && email ? `${name} · ${email}` : name || email || n.userId;
      byKey.set(n.userId, {
        value: n.userId,
        label,
        keywords: `${name} ${email} ${n.userId}`,
      });
    }
    return [...byKey.values()].sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
    );
  }, [tree?.nodes, user?.id]);

  const onPreview = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError("");
    setDone(false);
    const key = recipientKey.trim();
    if (!key) {
      setLocalError(t("wallet.p2pRecipientRequired"));
      return;
    }
    try {
      const fromList = recipientOptions.some((o) => o.value === key);
      const res = await previewMut.mutateAsync(
        fromList ? { userId: key } : { email: key },
      );
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
        ...(preview.userId
          ? { userId: preview.userId }
          : { email: preview.email }),
        amount: n,
        pin,
      });
      setDone(true);
      setPreview(null);
      setPin("");
      setAmount("");
      setRecipientKey("");
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
            <label className="block text-sm min-w-0">
              <span className="text-xs text-mq-text-muted">{t("wallet.p2pEmail")}</span>
              <div className="mt-1 min-w-0">
                <SearchableSelect
                  options={recipientOptions}
                  value={recipientKey}
                  required
                  allowCustom
                  aria-label={t("wallet.p2pEmail")}
                  placeholder={t("wallet.p2pSearchPh")}
                  searchPlaceholder={t("wallet.p2pSearchPh")}
                  emptyText={t("wallet.p2pSearchEmpty")}
                  customOptionLabel={(q) => t("wallet.p2pUseEmail", { email: q })}
                  onChange={setRecipientKey}
                />
              </div>
            </label>
            <button
              className="mq-btn mq-btn-primary w-full"
              disabled={busy || !recipientKey.trim()}
            >
              {busy ? t("wallet.loading") : t("wallet.p2pLookup")}
            </button>
          </form>
        ) : (
          <form className="space-y-3" onSubmit={(e) => void onTransfer(e)}>
            <p className="text-sm">
              {t("wallet.p2pTo")}:{" "}
              <strong>{preview.fullName || preview.email}</strong> ({preview.email})
            </p>
            <div className="space-y-2">
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
              {available > 0 ? (
                <p className="text-xs text-mq-text-muted">
                  {t("wallet.available")}:{" "}
                  <span className="tabular-nums font-medium text-mq-text">
                    {formatMoney(balance?.availableBalance)}
                  </span>
                </p>
              ) : null}
              {amountSuggestions.length > 0 ? (
                <div
                  className="flex flex-wrap gap-2"
                  role="group"
                  aria-label={t("wallet.p2pAmountSuggestions")}
                >
                  {amountSuggestions.map((chip) => {
                    const active = amount === chip.value;
                    return (
                      <button
                        key={chip.key}
                        type="button"
                        className={`mq-btn text-xs !px-3 !py-1.5 ${
                          active ? "mq-btn-primary" : "mq-btn-outline"
                        }`}
                        onClick={() => setAmount(chip.value)}
                      >
                        {chip.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
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
