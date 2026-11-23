"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { fxApi, type FxRatesResponse } from "@/lib/api/fx";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { useActiveFinanceConfig } from "@/lib/queries/finance";
import { getErrorMessage } from "@/lib/queries/utils";
import { formatPointUsdValue } from "@/lib/points";
import {
  formatPrefillDecimal,
  getMoneyInputErrorMessage,
  parseLocaleMoneyInput,
} from "@/lib/money";

const QUOTES = ["MYR", "VND", "SGD", "USD"] as const;

function formatFxWhen(iso: string, locale: string | null): string {
  const loc = locale === "zh-TW" ? "zh-TW" : locale === "vi" ? "vi-VN" : "en-GB";
  try {
    return new Date(iso).toLocaleString(loc, {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function fxSourceLabel(
  t: (key: string) => string,
  source: string | null | undefined,
): string {
  const raw = (source ?? "").trim().toLowerCase();
  if (raw === "manual") return t("admin.fx.sourceManual");
  if (raw === "seed") return t("admin.fx.sourceSeed");
  return source?.trim() || "—";
}

/** Super-admin FX display rates (CONFIG_SYS). Ledger stays TWD. */
export function AdminFxRatesPanel() {
  const { t, locale } = useLanguage();
  const { hasRole } = useAuth();
  // GET admin/finance/configs/active needs CONFIG_FEE, which the server withholds from ADMIN (who still
  // edits rates via CONFIG_SYS): do not call it, and do not show a made-up default point value.
  const canReadFeeConfig = hasRole("SUPER_ADMIN") || hasRole("ACCOUNTANT");
  const { data: activeFee } = useActiveFinanceConfig({ enabled: canReadFeeConfig });
  const [latest, setLatest] = useState<FxRatesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rates, setRates] = useState<Record<string, string>>({});
  const [rateErrors, setRateErrors] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");

  const editedRef = useRef(false);

  // Prefill from the latest rates in the active language (locale may resolve after the first
  // render); stop re-prefilling once the admin has typed.
  useEffect(() => {
    if (!latest || editedRef.current) return;
    setRates(
      Object.fromEntries(
        QUOTES.map((q) => [q, formatPrefillDecimal(latest.rates[q], locale ?? "en")]),
      ),
    );
  }, [latest, locale]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fxApi.adminGetRates();
      setLatest(res.latest);
      editedRef.current = false;
    } catch (err) {
      toast.error(getErrorMessage(err, t("admin.fx.loadFailed"), locale));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};
    const parsedRates: Record<string, number> = {};
    for (const q of QUOTES) {
      const maxRate = q === "VND" ? 100000 : 10;
      const res = parseLocaleMoneyInput(rates[q] ?? "", {
        locale,
        maxDecimals: 8,
        allowZero: false,
        allowNegative: false,
        max: maxRate,
      });
      if (!res.ok) {
        nextErrors[q] = getMoneyInputErrorMessage(res.error, t, {
          locale,
          maxDecimals: 8,
          max: maxRate,
        });
      } else {
        parsedRates[q] = res.value;
      }
    }
    setRateErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    try {
      const body = {
        rates: {
          MYR: parsedRates.MYR!,
          VND: parsedRates.VND!,
          SGD: parsedRates.SGD!,
          USD: parsedRates.USD!,
        },
        note: note.trim() || undefined,
      };
      const updated = await fxApi.adminUpdateRates(body);
      setLatest(updated);
      toast.success(t("admin.fx.saved"));
      setNote("");
    } catch (err) {
      toast.error(getErrorMessage(err, t("admin.fx.saveFailed"), locale));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mq-card p-5 space-y-4">
      <div>
        <h3 className="font-semibold text-mq-text">{t("admin.fx.title")}</h3>
        <p className="text-sm text-mq-text-muted mt-1">{t("admin.fx.subtitle")}</p>
        <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">
          {t("admin.fx.ledgerNote")}
        </p>
        {canReadFeeConfig ? (
          <p className="text-sm text-mq-text mt-2">
            {t("common.onePointUsd", {
              usd: formatPointUsdValue(activeFee?.pointUsdValue),
            })}
          </p>
        ) : null}
      </div>

      {loading ? (
        <div className="h-28 animate-pulse rounded-lg bg-mq-surface-subtle" />
      ) : (
        <>
          {latest ? (
            <div className="text-sm border border-mq-border rounded-lg p-4 space-y-2">
              <p className="text-mq-text">
                <span className="text-mq-text-muted">{t("admin.fx.asOf")}: </span>
                {latest.asOf ? formatFxWhen(latest.asOf, locale) : "—"}
              </p>
            </div>
          ) : null}

          <form onSubmit={(e) => void onSave(e)} className="space-y-4">
            <p className="text-sm font-medium">{t("admin.fx.formTitle")}</p>
            <p className="text-xs text-mq-text-muted">{t("admin.fx.formHint")}</p>
            <div className="grid sm:grid-cols-2 gap-4">
              {QUOTES.map((q) => (
                <label key={q} className="block text-sm">
                  <span className="mb-1 block">
                    {t("admin.fx.quoteLabel", { code: q })}
                  </span>
                  <input
                    className={`mq-input w-full ${rateErrors[q] ? "border-red-500" : ""}`}
                    type="text"
                    inputMode="decimal"
                    required
                    value={rates[q] ?? ""}
                    aria-invalid={Boolean(rateErrors[q])}
                    onChange={(e) => {
                      editedRef.current = true;
                      setRates({ ...rates, [q]: e.target.value });
                      if (rateErrors[q]) {
                        setRateErrors((prev) => ({ ...prev, [q]: "" }));
                      }
                    }}
                  />
                  {rateErrors[q] ? (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
                      {rateErrors[q]}
                    </p>
                  ) : null}
                </label>
              ))}
            </div>
            <label className="block text-sm">
              <span className="mb-1 block">{t("admin.fx.note")}</span>
              <input
                className="mq-input w-full"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
              />
            </label>
            <button
              type="submit"
              className="mq-btn mq-btn-primary"
              disabled={saving}
            >
              {saving ? t("admin.common.working") : t("admin.fx.save")}
            </button>
          </form>
        </>
      )}
    </section>
  );
}
