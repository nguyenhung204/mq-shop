"use client";

import { FormEvent, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/lib/api";
import type { AuthUser } from "@/lib/api/types";
import { formatPoints, parsePage } from "@/lib/api/utils";
import { useAdjustWalletBalance } from "@/lib/queries/wallet";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { useLanguage } from "@/components/providers/LanguageProvider";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/ui/SearchableSelect";
import { LedgerTwdNote } from "@/components/finance/LedgerTwdNote";
import { getMoneyInputErrorMessage, parseLocaleMoneyInput } from "@/lib/money";

function userLabel(u: AuthUser): string {
  const name = u.fullName?.trim();
  if (name) return `${name} · ${u.email}`;
  return u.email;
}

function WalletAdjustInner() {
  const { t, locale } = useLanguage();
  const adjust = useAdjustWalletBalance();

  const { data: usersPage } = useQuery({
    queryKey: ["admin", "users", "ACTIVE", "wallet-adjust-picker"],
    queryFn: async () =>
      parsePage<AuthUser>(
        await adminApi.users({ status: "ACTIVE", page: 1, pageSize: 100 }),
      ),
  });
  const users = useMemo(() => {
    const list = usersPage?.items ?? [];
    return [...list].sort((a, b) =>
      userLabel(a).localeCompare(userLabel(b), undefined, { sensitivity: "base" }),
    );
  }, [usersPage?.items]);

  const userOptions = useMemo<SearchableSelectOption[]>(
    () =>
      users.map((u) => ({
        value: u.id,
        label: userLabel(u),
        keywords: `${u.fullName ?? ""} ${u.email} ${u.id}`,
      })),
    [users],
  );

  const [userId, setUserId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [localError, setLocalError] = useState("");
  const [amountError, setAmountError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const selected = users.find((u) => u.id === userId);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError("");
    setAmountError("");
    setOkMsg("");
    if (!userId) {
      setLocalError(t("admin.walletAdjust.userRequired"));
      return;
    }
    const parsedAmount = parseLocaleMoneyInput(amount, {
      locale,
      maxDecimals: 2,
      allowZero: false,
      allowNegative: true,
      min: -1000000,
      max: 1000000,
    });
    if (!parsedAmount.ok) {
      setAmountError(
        getMoneyInputErrorMessage(parsedAmount.error, t, {
          locale,
          maxDecimals: 2,
          min: -1000000,
          max: 1000000,
        }),
      );
      return;
    }
    try {
      await adjust.mutateAsync({
        userId,
        amount: parsedAmount.value,
        note: note.trim() || undefined,
      });
      setOkMsg(
        t("admin.walletAdjust.success", {
          amount: formatPoints(parsedAmount.value, t("common.pointUnit")),
          email: selected?.email ?? "—",
        }),
      );
      setAmount("");
      setNote("");
    } catch {
      /* toast from hook */
    }
  };

  return (
    <>
      <AdminPageHeader
        title={t("admin.walletAdjust.title")}
        description={t("admin.walletAdjust.description")}
      />

      <LedgerTwdNote className="mb-2" />

      <div className="space-y-4 max-w-lg">
        <p className="text-sm text-mq-text-muted">{t("admin.walletAdjust.hint")}</p>

        {localError ? (
          <div className="mq-alert mq-alert-error break-words">{localError}</div>
        ) : null}
        {okMsg ? (
          <div className="mq-alert mq-alert-success break-words">{okMsg}</div>
        ) : null}

        <form className="mq-card p-5 space-y-3" onSubmit={(e) => void onSubmit(e)}>
          <label className="block text-sm min-w-0">
            <span className="text-xs text-mq-text-muted">{t("admin.walletAdjust.user")}</span>
            <div className="mt-1 min-w-0">
              <SearchableSelect
                options={userOptions}
                value={userId}
                required
                aria-label={t("admin.walletAdjust.user")}
                placeholder={t("admin.walletAdjust.userPh")}
                searchPlaceholder={t("admin.walletAdjust.userPh")}
                onChange={setUserId}
              />
            </div>
          </label>
          {selected ? (
            <div className="rounded-md border border-mq-border bg-mq-surface-subtle px-3 py-2 text-xs space-y-0.5">
              <p className="truncate font-medium">{selected.fullName || selected.email}</p>
              {selected.fullName ? (
                <p className="truncate text-mq-text-muted">{selected.email}</p>
              ) : null}
            </div>
          ) : null}
          <label className="block text-sm">
            <span className="text-xs text-mq-text-muted">{t("admin.walletAdjust.amount")}</span>
            <input
              className={`mq-input mt-1 ${amountError ? "border-red-500" : ""}`}
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                if (amountError) setAmountError("");
              }}
              aria-invalid={Boolean(amountError)}
              required
              placeholder={t("admin.walletAdjust.amountPh")}
            />
            {amountError ? (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
                {amountError}
              </p>
            ) : null}
          </label>
          <label className="block text-sm">
            <span className="text-xs text-mq-text-muted">{t("admin.walletAdjust.note")}</span>
            <textarea
              className="mq-input mt-1 min-h-[4.5rem] resize-y"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              placeholder={t("admin.walletAdjust.notePh")}
            />
          </label>
          <button
            type="submit"
            className="mq-btn mq-btn-primary w-full"
            disabled={adjust.isPending || !userId}
          >
            {adjust.isPending
              ? t("admin.common.saving")
              : t("admin.walletAdjust.submit")}
          </button>
        </form>
      </div>
    </>
  );
}

export default function AdminWalletAdjustPage() {
  return (
    <AuthGuard
      roles={["SUPER_ADMIN", "ADMIN"]}
      permissions={["ADJUST_POINTS"]}
    >
      <WalletAdjustInner />
    </AuthGuard>
  );
}
