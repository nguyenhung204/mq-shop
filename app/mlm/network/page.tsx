"use client";

import { useMemo } from "react";
import type { NetworkNode } from "@/lib/api/mlm";
import { useNetworkTree } from "@/lib/queries/wallet";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { Container, PageHero } from "@/components/ui/shared";
import { AdminCardListSkeleton } from "@/components/ui/Skeleton";

function depthLabel(depth: number, t: (k: string) => string): string {
  if (depth <= 0) return t("wallet.networkRoot");
  return t("wallet.networkFx").replace("{n}", String(depth));
}

function NetworkInner() {
  const { t } = useLanguage();
  const { data, isLoading, isError, error } = useNetworkTree({ maxDepth: 20, limit: 500 });

  const byDepth = useMemo(() => {
    const map = new Map<number, NetworkNode[]>();
    for (const node of data?.nodes ?? []) {
      const list = map.get(node.depth) ?? [];
      list.push(node);
      map.set(node.depth, list);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [data?.nodes]);

  return (
    <>
      <PageHero
        title={t("wallet.network")}
        breadcrumb={[
          { label: t("wallet.title"), href: "/wallet" },
          { label: t("wallet.network") },
        ]}
      />
      <Container className="py-10 md:py-14 space-y-5 max-w-3xl mx-auto">
        <p className="text-sm text-mq-text-muted">{t("wallet.networkIntro")}</p>

        {isLoading ? <AdminCardListSkeleton count={4} /> : null}
        {isError ? (
          <div className="mq-alert mq-alert-error">
            {error instanceof Error ? error.message : t("wallet.loadFailed")}
          </div>
        ) : null}

        {data ? (
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="mq-badge mq-badge-muted">
              {t("wallet.networkTotal")}: {data.totalDownline}
            </span>
            <span className="mq-badge mq-badge-cyan">
              {t("wallet.networkMaxDepth")}: {data.maxDepth}
            </span>
            {data.truncated ? (
              <span className="mq-badge mq-badge-orange">{t("wallet.networkTruncated")}</span>
            ) : null}
          </div>
        ) : null}

        {!isLoading && byDepth.length === 0 && !isError ? (
          <p className="text-sm text-mq-text-muted text-center py-6">
            {t("wallet.networkEmpty")}
          </p>
        ) : null}

        {byDepth.map(([depth, nodes]) => (
          <section key={depth} className="space-y-2">
            <h2 className="text-sm font-medium uppercase tracking-wider text-mq-text-muted">
              {depthLabel(depth, t)} · {nodes.length}
            </h2>
            <div className="space-y-2">
              {nodes.map((n) => (
                <div
                  key={n.userId}
                  className="mq-card p-4 flex flex-wrap justify-between gap-3 text-sm"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium truncate">
                      {n.fullName || n.email || n.userId.slice(0, 8)}
                    </p>
                    {n.email ? (
                      <p className="text-xs text-mq-text-muted truncate">{n.email}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="mq-badge mq-badge-cyan">{depthLabel(depth, t)}</span>
                    {n.mlmRank != null ? (
                      <span className="mq-badge mq-badge-muted">
                        {t("wallet.rank")} {n.mlmRank}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </Container>
    </>
  );
}

export default function MlmNetworkPage() {
  return (
    <AuthGuard>
      <NetworkInner />
    </AuthGuard>
  );
}
