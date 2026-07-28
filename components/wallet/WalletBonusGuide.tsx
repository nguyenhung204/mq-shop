"use client";

import { useLanguage } from "@/components/providers/LanguageProvider";
import { mlmRankLabel } from "@/lib/i18n/mlm-rank";

const REFERRAL_RATE_ROWS: Array<{ rankKey: string; rate: string }> = [
  { rankKey: "0", rate: "5%" },
  { rankKey: "1", rate: "5%" },
  { rankKey: "2", rate: "5%" },
  { rankKey: "3", rate: "7%" },
  { rankKey: "4", rate: "8%" },
  { rankKey: "5", rate: "9%" },
  { rankKey: "6plus", rate: "10%" },
];

const GLOBAL_TIERS: Array<{ rankKey: string }> = [
  { rankKey: "5" },
  { rankKey: "6" },
  { rankKey: "7" },
  { rankKey: "10" },
];

type Pillar = {
  type: "REFERRAL" | "TEAM" | "LOYALTY" | "GLOBAL";
  bodyKey: string;
  timingKey: string;
};

const PILLARS: Pillar[] = [
  {
    type: "REFERRAL",
    bodyKey: "wallet.bonusGuide.referralBody",
    timingKey: "wallet.bonusGuide.timingRealtime",
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

  return (
    <section
      className={`rounded-[var(--mq-radius-md)] border border-mq-border bg-mq-surface p-4 md:p-6 space-y-5 ${className}`}
    >
      <div>
        <h3 className="text-base md:text-lg font-semibold text-mq-text">
          {t("wallet.bonusGuide.title")}
        </h3>
        <p className="text-sm text-mq-text-muted mt-1.5 leading-relaxed">
          {t("wallet.bonusGuide.intro")}
        </p>
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

            {pillar.type === "REFERRAL" ? (
              <div className="pt-1 space-y-2">
                <p className="text-sm font-medium text-mq-text-muted">
                  {t("wallet.bonusGuide.referralRatesTitle")}
                </p>
                <ul className="grid gap-1.5 sm:grid-cols-2 text-sm text-mq-text-secondary">
                  {REFERRAL_RATE_ROWS.map((row) => (
                    <li
                      key={row.rankKey}
                      className="flex items-center justify-between gap-2 rounded-md bg-mq-surface px-2.5 py-2"
                    >
                      <span>
                        {row.rankKey === "6plus"
                          ? t("wallet.bonusGuide.ranks.6plus")
                          : mlmRankLabel(t, Number(row.rankKey))}
                      </span>
                      <span className="tabular-nums font-semibold text-mq-text">
                        {row.rate}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-mq-text-muted leading-relaxed">
                  {t("wallet.bonusGuide.referralNote")}
                </p>
              </div>
            ) : null}

            {pillar.type === "GLOBAL" ? (
              <div className="pt-1 space-y-2">
                <p className="text-sm font-medium text-mq-text-muted">
                  {t("wallet.bonusGuide.globalTiersTitle")}
                </p>
                <ul className="flex flex-wrap gap-2">
                  {GLOBAL_TIERS.map((tier) => (
                    <li
                      key={tier.rankKey}
                      className="rounded-full border border-mq-border bg-mq-surface px-3 py-1.5 text-sm text-mq-text"
                    >
                      {t(`wallet.bonusGuide.globalTiers.${tier.rankKey}`)}
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
