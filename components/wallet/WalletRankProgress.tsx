"use client";

import { useRankProgress } from "@/lib/queries/wallet";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { mlmRankLabel } from "@/lib/i18n/mlm-rank";

export function WalletRankProgress({ className = "" }: { className?: string }) {
  const { t } = useLanguage();
  const { hasRole } = useAuth();
  const { data, isLoading, isError } = useRankProgress();

  // Only SELLER users participate in the MLM rank ladder
  if (!hasRole("SELLER")) return null;

  if (isLoading) {
    return (
      <div
        className={`rounded-[var(--mq-radius-md)] border border-mq-border bg-mq-surface p-4 animate-pulse h-28 ${className}`}
      />
    );
  }

  if (isError || !data) return null;

  // Admin-only accounts without the BUYER role cannot participate in the MLM
  // ladder (edge case). The API signals this via eligibleAsSeller=false at rank 0.
  const notEligible =
    data.eligibleAsSeller === false && (data.mlmRank ?? 0) === 0;

  if (notEligible) {
    return (
      <section
        className={`rounded-[var(--mq-radius-md)] border border-mq-border bg-mq-surface p-4 md:p-6 space-y-4 ${className}`}
      >
        <div>
          <h3 className="text-base md:text-lg font-semibold text-mq-text">
            {t("wallet.rankProgressTitle")}
          </h3>
          <p className="text-sm text-mq-text-muted mt-1.5 leading-relaxed">
            {t("wallet.rankProgressBuyerGate")}
          </p>
        </div>
        <p className="text-sm text-mq-text-secondary leading-relaxed">
          {t("wallet.rankProgressBuyerGateHint")}
        </p>
      </section>
    );
  }

  const current = data.currentCount ?? 0;
  const required = data.requiredCount ?? 0;
  const remaining = Math.max(0, required - current);
  const pct =
    required > 0 ? Math.min(100, Math.round((current / required) * 100)) : 0;
  const atMax = data.nextRank == null;
  const done = !atMax && required > 0 && current >= required;

  const currentName = mlmRankLabel(t, data.mlmRank, data.rankName);
  const nextName = mlmRankLabel(t, data.nextRank, data.nextRankName ?? undefined);
  const requiredF1Name = mlmRankLabel(
    t,
    data.requiredF1Rank,
    data.nextRankName ?? undefined,
  );

  const howHint =
    data.mode === "qualify_orders"
      ? t("wallet.rankProgressHowOrders")
      : t("wallet.rankProgressHowF1", {
          rank: String(data.requiredF1Rank ?? 0),
          rankName: requiredF1Name,
        });

  return (
    <section
      className={`rounded-[var(--mq-radius-md)] border border-mq-border bg-mq-surface p-4 md:p-6 space-y-5 ${className}`}
    >
      <div>
        <h3 className="text-base md:text-lg font-semibold text-mq-text">
          {t("wallet.rankProgressTitle")}
        </h3>
        <p className="text-sm text-mq-text-muted mt-1.5 leading-relaxed">
          {t("wallet.rankProgressIntro")}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-[var(--mq-radius-sm)] bg-mq-surface-subtle px-3.5 py-3">
          <p className="text-xs uppercase tracking-wide text-mq-text-muted">
            {t("wallet.rankProgressYouAre")}
          </p>
          <p className="text-base font-medium text-mq-text mt-1">
            {currentName}
          </p>
        </div>
        <div className="rounded-[var(--mq-radius-sm)] bg-mq-surface-subtle px-3.5 py-3">
          <p className="text-xs uppercase tracking-wide text-mq-text-muted">
            {t("wallet.rankProgressGoal")}
          </p>
          {atMax ? (
            <p className="text-base font-medium text-mq-text mt-1">
              {t("wallet.rankProgressMaxShort")}
            </p>
          ) : (
            <p className="text-base font-medium text-mq-text mt-1">
              {nextName}
            </p>
          )}
        </div>
      </div>

      {atMax ? (
        <p className="text-sm text-mq-text-secondary leading-relaxed">
          {t("wallet.rankProgressMax")}
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-mq-text-secondary leading-relaxed">
            {t("wallet.rankProgressNeedPeople", {
              count: String(required),
            })}{" "}
            {howHint}
          </p>

          <div className="space-y-2">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <p className="text-sm text-mq-text">
                {done
                  ? t("wallet.rankProgressDone")
                  : t("wallet.rankProgressHave", {
                      current: String(current),
                      required: String(required),
                    })}
              </p>
              {!done ? (
                <p className="text-sm font-medium text-mq-text">
                  {t("wallet.rankProgressRemaining", {
                    count: String(remaining),
                  })}
                </p>
              ) : null}
            </div>

            <div
              className="h-2.5 rounded-full bg-mq-surface-subtle overflow-hidden"
              role="progressbar"
              aria-valuenow={current}
              aria-valuemin={0}
              aria-valuemax={required || 1}
              aria-label={t("wallet.rankProgressTitle")}
            >
              <div
                className="h-full rounded-full bg-mq-text transition-[width] duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>

            <p className="text-sm text-mq-text-muted tabular-nums">
              {current}/{required} · {pct}%
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
