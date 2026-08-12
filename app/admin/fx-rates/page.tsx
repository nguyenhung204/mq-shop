"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { fxApi, type FxRatesResponse } from "@/lib/api/fx";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { getErrorMessage } from "@/lib/queries/utils";

const QUOTES = ["MYR", "VND", "SGD", "USD"] as const;

export default function AdminFxRatesPage() {
  const { t, locale } = useLanguage();
  const { user } = useAuth();
  const [latest, setLatest] = useState<FxRatesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rates, setRates] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await fxApi.adminGetRates();
      setLatest(res.latest);
      setRates(
        Object.fromEntries(
          QUOTES.map((q) => [q, String(res.latest.rates[q] ?? "")]),
        ),
      );
    } catch (err) {
      toast.error(getErrorMessage(err, t("admin.fx.loadFailed"), locale));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        rates: {
          MYR: Number(rates.MYR),
          VND: Number(rates.VND),
          SGD: Number(rates.SGD),
          USD: Number(rates.USD),
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
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold text-mq-text">{t("admin.fx.title")}</h1>
        <p className="text-sm text-mq-text-muted mt-1">{t("admin.fx.subtitle")}</p>
        <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">{t("admin.fx.ledgerNote")}</p>
      </div>

      {loading ? (
        <div className="h-32 animate-pulse rounded-lg bg-mq-surface-subtle" />
      ) : (
        <>
          {latest ? (
            <div className="text-sm text-mq-text-muted border border-mq-border rounded-lg p-4 space-y-1">
              <p>
                {t("admin.fx.asOf")}: {latest.asOf ? new Date(latest.asOf).toLocaleString() : "—"}
              </p>
              <p>
                {t("admin.fx.source")}: {latest.source}
              </p>
              <p>{t("admin.fx.baseCurrency")}</p>
            </div>
          ) : null}

          <form onSubmit={onSave} className="space-y-4 border border-mq-border rounded-lg p-6">
            <p className="text-sm font-medium">{t("admin.fx.formTitle")}</p>
            <p className="text-xs text-mq-text-muted">{t("admin.fx.formHint")}</p>
            <div className="grid sm:grid-cols-2 gap-4">
              {QUOTES.map((q) => (
                <label key={q} className="block text-sm">
                  <span className="mb-1 block">
                    1 TWD = … {q}
                  </span>
                  <input
                    className="mq-input w-full"
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={rates[q] ?? ""}
                    onChange={(e) => setRates({ ...rates, [q]: e.target.value })}
                  />
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
            <button type="submit" className="mq-btn mq-btn-primary" disabled={saving}>
              {saving ? t("admin.common.working") : t("admin.fx.save")}
            </button>
          </form>
        </>
      )}

      {user?.email ? (
        <p className="text-xs text-mq-text-muted">{user.email}</p>
      ) : null}
    </div>
  );
}
