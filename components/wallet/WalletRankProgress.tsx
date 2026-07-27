"use client";

import { useRankProgress } from "@/lib/queries/wallet";
import { useLanguage } from "@/components/providers/LanguageProvider";

export function WalletRankProgress({ className = "" }: { className?: string }) {
  const { t } = useLanguage();
  const { data, isLoading, isError } = useRankProgress();

  if (isLoading) {
    return (
      <div
        className={`rounded-[var(--mq-radius-md)] border border-mq-border bg-mq-surface p-4 animate-pulse h-28 ${className}`}
      />
    );
  }

  if (isError || !data) return null;

  const current = data.currentCount ?? 0;
  const required = data.requiredCount ?? 0;
  const remaining = Math.max(0, required - current);
  const pct =
    required > 0 ? Math.min(100, Math.round((current / required) * 100)) : 0;
  const atMax = data.nextRank == null;
  const done = !atMax && required > 0 && current >= required;
  const blocked = data.eligibleAsSeller === false;

  const howHint =
    data.mode === "qualify_orders"
      ? t("wallet.rankProgressHowOrders")
      : t("wallet.rankProgressHowF1", {
          rank: String(data.requiredF1Rank ?? 0),
          rankName: data.nextRankName ?? "",
        });

  return (
    <section
      className={`rounded-[var(--mq-radius-md)] border border-mq-border bg-mq-surface p-4 md:p-5 space-y-4 ${className}`}
    >
      <div>
        <h3 className="text-sm font-semibold text-mq-text">
          {t("wallet.rankProgressTitle")}
        </h3>
        <p className="text-xs text-mq-text-muted mt-1 leading-relaxed">
          {t("wallet.rankProgressIntro")}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-[var(--mq-radius-sm)] bg-mq-surface-subtle px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-wide text-mq-text-muted">
            {t("wallet.rankProgressYouAre")}
          </p>
          <p className="text-sm font-medium text-mq-text mt-0.5">
            {data.rankName}
            <span className="text-mq-text-muted font-normal">
              {" "}
              ({t("wallet.rank")} {data.mlmRank})
            </span>
          </p>
        </div>
        <div className="rounded-[var(--mq-radius-sm)] bg-mq-surface-subtle px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-wide text-mq-text-muted">
            {t("wallet.rankProgressGoal")}
          </p>
          {atMax ? (
            <p className="text-sm font-medium text-mq-text mt-0.5">
              {t("wallet.rankProgressMaxShort")}
            </p>
          ) : (
            <p className="text-sm font-medium text-mq-text mt-0.5">
              {data.nextRankName}
              <span className="text-mq-text-muted font-normal">
                {" "}
                ({t("wallet.rank")} {data.nextRank})
              </span>
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
          {blocked ? (
            <div className="mq-alert mq-alert-error text-sm">
              {t("wallet.rankProgressNeedSeller")}
            </div>
          ) : (
            <>
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
                    <p className="text-xs font-medium text-mq-text">
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

                <p className="text-[11px] text-mq-text-muted tabular-nums">
                  {current}/{required} · {pct}%
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
