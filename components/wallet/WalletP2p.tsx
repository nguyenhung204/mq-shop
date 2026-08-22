"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { formatPoints } from "@/lib/api/utils";
import type { TransferPreviewResult } from "@/lib/api/wallet";
import {
  useTransferPreview,
  useTransferRecipients,
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
import { getErrorMessage } from "@/lib/queries/utils";

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
  const { t, locale } = useLanguage();
  const { user } = useAuth();
  const { data: balance } = useWallet();
  const previewMut = useTransferPreview();
  const transferMut = useWalletTransfer();

  const [email, setEmail] = useState("");
  const [pickedUserId, setPickedUserId] = useState("");
  const [networkQuery, setNetworkQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [amount, setAmount] = useState("");
  const [pin, setPin] = useState("");
  const [preview, setPreview] = useState<TransferPreviewResult | null>(null);
  const [localError, setLocalError] = useState("");
  const [done, setDone] = useState(false);

  const needsPin = user ? user.hasWalletPin === false : false;
  const busy = previewMut.isPending || transferMut.isPending;

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQ(networkQuery.trim()), 300);
    return () => window.clearTimeout(id);
  }, [networkQuery]);

  const { data: recipients = [], isFetching: recipientsFetching } =
    useTransferRecipients(
      { q: debouncedQ || undefined, maxDepth: 20, limit: 50 },
      {
        enabled:
          Boolean(user) && user !== null && user.hasWalletPin !== false,
      },
    );

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

  const recipientById = useMemo(() => {
    const map = new Map<string, { email: string; label: string }>();
    for (const n of recipients) {
      if (!n.userId || n.userId === user?.id) continue;
      const em = n.email?.trim() || "";
      const name = n.fullName?.trim() || "";
      const depth =
        typeof n.depth === "number" && n.depth > 0 ? `F${n.depth}` : "";
      const base = name && em ? `${name} · ${em}` : name || em || n.userId;
      map.set(n.userId, {
        email: em,
        label: depth ? `${base} · ${depth}` : base,
      });
    }
    return map;
  }, [recipients, user?.id]);

  const networkOptions = useMemo<SearchableSelectOption[]>(
    () =>
      [...recipientById.entries()].map(([id, row]) => ({
        value: id,
        label: row.label,
        keywords: `${row.label} ${row.email} ${id}`,
      })),
    [recipientById],
  );

  const onPickNetwork = (userId: string) => {
    setPickedUserId(userId);
    const row = recipientById.get(userId);
    if (row?.email) setEmail(row.email);
  };

  const onEmailChange = (value: string) => {
    setEmail(value);
    if (pickedUserId) {
      const row = recipientById.get(pickedUserId);
      if (!row || row.email !== value.trim()) setPickedUserId("");
    }
  };

  const onPreview = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError("");
    setDone(false);
    const em = email.trim();
    if (!pickedUserId && !em) {
      setLocalError(t("wallet.p2pRecipientRequired"));
      return;
    }
    if (!pickedUserId && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      setLocalError(t("wallet.p2pEmailInvalid"));
      return;
    }
    try {
      const res = await previewMut.mutateAsync(
        pickedUserId ? { userId: pickedUserId } : { email: em },
      );
      setPreview(res);
    } catch (err) {
      setLocalError(getErrorMessage(err, t("toast.walletTransferPreviewFailed"), locale));
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
        ...(pickedUserId
          ? { userId: pickedUserId }
          : { email: preview.email }),
        amount: n,
        pin,
      });
      setDone(true);
      setPreview(null);
      setPin("");
      setAmount("");
      setEmail("");
      setPickedUserId("");
    } catch (err) {
      setLocalError(getErrorMessage(err, t("toast.walletTransferFailed"), locale));
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
            <p className="text-sm text-mq-text-muted">{t("wallet.p2pAnyoneHint")}</p>
            <label className="block text-sm min-w-0">
              <span className="text-xs text-mq-text-muted">{t("wallet.p2pEmail")}</span>
              <input
                className="mq-input mt-1"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
                placeholder={t("wallet.p2pEmailPh")}
                required={!pickedUserId}
                disabled={needsPin}
              />
            </label>
            <label className="block text-sm min-w-0">
              <span className="text-xs text-mq-text-muted">
                {t("wallet.p2pFromNetwork")}
                {recipientsFetching ? (
                  <span className="ml-2 text-mq-text-muted">…</span>
                ) : null}
              </span>
              <div className="mt-1 min-w-0">
                <SearchableSelect
                  options={networkOptions}
                  value={pickedUserId}
                  filterLocally={false}
                  aria-label={t("wallet.p2pFromNetwork")}
                  placeholder={t("wallet.p2pNetworkPh")}
                  searchPlaceholder={t("wallet.p2pNetworkPh")}
                  emptyText={t("wallet.p2pNetworkEmpty")}
                  onQueryChange={setNetworkQuery}
                  onChange={onPickNetwork}
                />
              </div>
            </label>
            <button
              className="mq-btn mq-btn-primary w-full"
              disabled={busy || (!pickedUserId && !email.trim())}
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
                    {formatPoints(balance?.availableBalance, t("common.pointUnit"))}
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
            <p className="text-xs text-mq-text-muted">
              <Link href={walletHref} className="underline">
                {t("wallet.forgotPin")}
              </Link>
            </p>
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
