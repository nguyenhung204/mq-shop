"use client";

import { useSellerMlmRankConfigs } from "@/lib/queries/wallet";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { formatPercent } from "@/lib/api/utils";
import { usePointsDisplayFx } from "@/lib/hooks/usePointsDisplayFx";

type Pillar = {
  type: "REFERRAL" | "TEAM" | "LOYALTY" | "GLOBAL";
  bodyKey: string;
  timingKey: string;
};

const PILLARS: Pillar[] = [
  {
    type: "REFERRAL",
    bodyKey: "wallet.bonusGuide.referralBody",
    timingKey: "wallet.bonusGuide.timingJoining",
  },
  {
    type: "TEAM",
    bodyKey: "wallet.bonusGuide.teamBody",
    timingKey: "wallet.bonusGuide.timingMonthEnd",
  },
  {
    type: "LOYALTY",
    bodyKey: "wallet.bonusGuide.loyaltyBody",
    timingKey: "wallet.bonusGuide.timingMonthEnd",
  },
  {
    type: "GLOBAL",
    bodyKey: "wallet.bonusGuide.globalBody",
    timingKey: "wallet.bonusGuide.timingMonthEnd",
  },
];

export function WalletBonusGuide({ className = "" }: { className?: string }) {
  const { t } = useLanguage();
  const { hasRole } = useAuth();
  const { data: ranks } = useSellerMlmRankConfigs({ enabled: hasRole("SELLER") });
  const { onePointDisplay, formatRegion } = usePointsDisplayFx();

  // Only show to SELLER
  if (!hasRole("SELLER")) return null;

  const activeRanks = (ranks ?? []).filter((r) => r.isActive);
  const globalTiers = activeRanks.filter((r) => r.globalFundTier != null);

  return (
    <section
      className={`rounded-[var(--mq-radius-md)] border border-mq-border bg-mq-surface p-4 md:p-6 space-y-5 ${className}`}
    >
      <div className="space-y-2">
        <h3 className="text-base md:text-lg font-semibold text-mq-text">
          {t("wallet.bonusGuide.title")}
        </h3>
        <p className="text-sm text-mq-text-muted leading-relaxed">
          {t("wallet.bonusGuide.intro")}
        </p>
        <div className="rounded-md border border-mq-border/70 bg-mq-surface-subtle px-3 py-2.5 text-sm space-y-1">
          <p className="text-mq-text-secondary">{t("wallet.bonusGuide.pointsFlow")}</p>
          {onePointDisplay != null ? (
            <p className="text-xs text-mq-text-muted">
              {t("wallet.bonusGuide.pointsRateToday", {
                amount: formatRegion(onePointDisplay) ?? "",
              })}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4">
        {PILLARS.map((pillar) => (
          <article
            key={pillar.type}
            className="rounded-[var(--mq-radius-sm)] border border-mq-border/80 bg-mq-surface-subtle px-3.5 py-3.5 md:px-4 md:py-4 space-y-2.5"
          >
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-base font-medium text-mq-text">
                {t(`wallet.commissionTypes.${pillar.type}`)}
              </h4>
              <span className="mq-badge mq-badge-muted text-xs">
                {t(pillar.timingKey)}
              </span>
            </div>
            <p className="text-sm text-mq-text-secondary leading-relaxed">
              {t(pillar.bodyKey)}
            </p>

            {pillar.type === "REFERRAL" && activeRanks.length > 0 ? (
              <div className="pt-1 space-y-2">
                <p className="text-sm font-medium text-mq-text-muted">
                  {t("wallet.bonusGuide.referralRatesTitle")}
                </p>
                <ul className="grid gap-1.5 sm:grid-cols-2 text-sm text-mq-text-secondary">
                  {activeRanks.map((r) => (
                    <li
                      key={r.rank}
                      className="flex items-center justify-between gap-2 rounded-md bg-mq-surface px-2.5 py-2"
                    >
                      <span>
                        {r.name} <span className="text-mq-text-muted">(R{r.rank})</span>
                      </span>
                      <span className="tabular-nums font-semibold text-mq-text">
                        {formatPercent(r.referralPercent)}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-mq-text-muted leading-relaxed">
                  {t("wallet.bonusGuide.referralNote")}
                </p>
              </div>
            ) : null}

            {pillar.type === "TEAM" && activeRanks.length > 0 ? (
              <div className="pt-1 space-y-2">
                <p className="text-sm font-medium text-mq-text-muted">
                  {t("wallet.bonusGuide.teamRatesTitle")}
                </p>
                <ul className="grid gap-1.5 sm:grid-cols-2 text-sm text-mq-text-secondary">
                  {activeRanks
                    .filter((r) => Number(r.teamPercent) > 0)
                    .map((r) => (
                      <li
                        key={r.rank}
                        className="flex items-center justify-between gap-2 rounded-md bg-mq-surface px-2.5 py-2"
                      >
                        <span>
                          {r.name} <span className="text-mq-text-muted">(R{r.rank})</span>
                        </span>
                        <span className="tabular-nums font-semibold text-mq-text">
                          {formatPercent(r.teamPercent)}
                        </span>
                      </li>
                    ))}
                </ul>
                <p className="text-sm text-mq-text-muted leading-relaxed">
                  {t("wallet.bonusGuide.teamNote")}
                </p>
              </div>
            ) : null}

            {pillar.type === "GLOBAL" && globalTiers.length > 0 ? (
              <div className="pt-1 space-y-2">
                <p className="text-sm font-medium text-mq-text-muted">
                  {t("wallet.bonusGuide.globalTiersTitle")}
                </p>
                <ul className="flex flex-wrap gap-2">
                  {globalTiers.map((r) => (
                    <li
                      key={r.rank}
                      className="rounded-full border border-mq-border bg-mq-surface px-3 py-1.5 text-sm text-mq-text"
                    >
                      ≥ R{r.globalFundTier} · {r.name}
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-mq-text-muted leading-relaxed">
                  {t("wallet.bonusGuide.globalNote")}
                </p>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
