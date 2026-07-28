"use client";

import Link from "next/link";
import { useState } from "react";
import { formatMoney, formatPercent } from "@/lib/api/utils";
import type { CommissionType } from "@/lib/api/mlm";
import { useCommissions } from "@/lib/queries/wallet";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { Container, PageHero } from "@/components/ui/shared";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { AdminCardListSkeleton } from "@/components/ui/Skeleton";
import { WalletRankProgress } from "@/components/wallet/WalletRankProgress";
import { WalletBonusGuide } from "@/components/wallet/WalletBonusGuide";
import { mlmRankLabel } from "@/lib/i18n/mlm-rank";


const TYPES: Array<CommissionType | "ALL"> = [
  "ALL",
  "REFERRAL",
  "TEAM",
  "GLOBAL",
  "LOYALTY",
];

function statusBadge(status: string): string {
  if (status === "CREDITED") return "mq-badge mq-badge-cyan";
  if (status === "VOID") return "mq-badge mq-badge-orange";
  return "mq-badge mq-badge-muted";
}

function CommissionsPanel({ embedded = false }: { embedded?: boolean }) {
  const { t } = useLanguage();
  const { user, hasRole } = useAuth();
  const [type, setType] = useState<CommissionType | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error, isFetching } = useCommissions({
    type: type === "ALL" ? undefined : type,
    page,
    pageSize: 20,
  });
  const items = data?.items ?? [];
  const meta = data?.meta;
  const showRank = hasRole("SELLER") && user?.mlmRank != null;

  const body = (
    <div className="space-y-5">
      <WalletBonusGuide />

      <WalletRankProgress />

      {showRank ? (
        <p className="text-sm text-mq-text-muted">
          {t("wallet.rankLabel", {
            rank: String(user.mlmRank),
            name: mlmRankLabel(t, user.mlmRank),
          })}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2" role="tablist" aria-label={t("wallet.commissions")}>
        {TYPES.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={type === tab}
            className={`mq-btn text-xs ${
              type === tab ? "mq-btn-primary" : "mq-btn-outline"
            }`}
            onClick={() => {
              setType(tab);
              setPage(1);
            }}
          >
            {t(`wallet.commissionTypes.${tab}`)}
          </button>
        ))}
      </div>

      {isError ? (
        <div className="mq-alert mq-alert-error">
          {error instanceof Error ? error.message : t("wallet.loadFailed")}
        </div>
      ) : null}

      {(isLoading || isFetching) && items.length === 0 ? (
        <AdminCardListSkeleton count={5} />
      ) : null}

      {!isLoading && items.length === 0 && !isError ? (
        <p className="text-sm text-mq-text-muted text-center py-6">
          {t("wallet.commissionsEmpty")}
        </p>
      ) : null}

      {items.map((row) => (
        <div
          key={row.id}
          className="mq-card p-4 flex flex-wrap justify-between gap-3 text-sm"
        >
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mq-badge mq-badge-muted">
                {t(`wallet.commissionTypes.${row.type}`)}
              </span>
              <span className={statusBadge(row.status)}>
                {t(`wallet.commissionStatus.${row.status}`)}
              </span>
              {row.periodYearMonth ? (
                <span className="text-xs text-mq-text-muted">{row.periodYearMonth}</span>
              ) : null}
            </div>
            <p className="text-xs text-mq-text-muted">
              {t("wallet.commissionRate")}: {formatPercent(row.ratePercent)} ·{" "}
              {t("wallet.commissionBase")}: {formatMoney(row.baseAmount)}
              {row.sourceOrderId ? (
                <>
                  {" · "}
                  <Link
                    href={`/orders/${row.sourceOrderId}`}
                    className="font-mono hover:underline"
                  >
                    {row.sourceOrderId.slice(0, 8)}…
                  </Link>
                </>
              ) : null}
            </p>
          </div>
          <span className="tabular-nums font-medium">
            {formatMoney(row.payoutAmount)}
          </span>
        </div>
      ))}

      {meta ? <PaginationBar page={page} meta={meta} onPageChange={setPage} /> : null}
    </div>
  );

  if (embedded) return body;

  return (
    <>
      <PageHero
        title={t("wallet.commissions")}
        breadcrumb={[
          { label: t("wallet.title"), href: "/wallet" },
          { label: t("wallet.commissions") },
        ]}
      />
      <Container className="py-10 md:py-14 max-w-3xl mx-auto">{body}</Container>
    </>
  );
}

export function WalletCommissions({ embedded = false }: { embedded?: boolean }) {
  return (
    <AuthGuard
      roles={["BUYER", "SELLER", "SUPER_ADMIN"]}
      permissions={["VIEW_MLM_COMSN"]}
    >
      <CommissionsPanel embedded={embedded} />
    </AuthGuard>
  );
}
