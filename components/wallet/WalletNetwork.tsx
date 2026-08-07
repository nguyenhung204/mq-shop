"use client";

import { useMemo, useState } from "react";
import type { NetworkNode } from "@/lib/api/mlm";
import { useNetworkTree } from "@/lib/queries/wallet";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { Container, PageHero } from "@/components/ui/shared";
import { AdminCardListSkeleton } from "@/components/ui/Skeleton";
import { getErrorMessage } from "@/lib/queries/utils";
import { NetworkTreeFlow } from "./network-tree/NetworkTreeFlow";

const PAGE_SIZE = 20;

type ViewMode = "tree" | "list";

function depthLabel(depth: number, t: (k: string) => string): string {
  if (depth <= 0) return t("wallet.networkRoot");
  return t("wallet.networkFx").replace("{n}", String(depth));
}

function NetworkPanel({ embedded = false }: { embedded?: boolean }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>("tree");
  const { data, isLoading, isError, error } = useNetworkTree({
    maxDepth: 20,
    limit: 500,
  });

  const sortedNodes = useMemo(() => {
    const nodes = [...(data?.nodes ?? [])];
    nodes.sort((a, b) => {
      if (a.depth !== b.depth) return a.depth - b.depth;
      const la = (a.fullName || a.email || a.userId).toLowerCase();
      const lb = (b.fullName || b.email || b.userId).toLowerCase();
      return la.localeCompare(lb);
    });
    return nodes;
  }, [data?.nodes]);

  const total = sortedNodes.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageNodes = sortedNodes.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  const pageByDepth = useMemo(() => {
    const map = new Map<number, NetworkNode[]>();
    for (const node of pageNodes) {
      const list = map.get(node.depth) ?? [];
      list.push(node);
      map.set(node.depth, list);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [pageNodes]);

  const meta = total > 0
    ? {
        page: safePage,
        pageSize: PAGE_SIZE,
        total,
        totalPages,
      }
    : null;

  const onPageChange = (next: number) => {
    setPage(next);
  };

  const body = (
    <div className="space-y-5">
      <p className="text-sm text-mq-text-muted">{t("wallet.networkIntro")}</p>

      {isLoading ? <AdminCardListSkeleton count={4} /> : null}
      {isError ? (
        <div className="mq-alert mq-alert-error">
          {getErrorMessage(error, t("wallet.loadFailed"))}
        </div>
      ) : null}

      {data ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="mq-badge mq-badge-muted">
            {t("wallet.networkTotal")}: {data.totalDownline}
          </span>
          <span className="mq-badge mq-badge-cyan">
            {t("wallet.networkMaxDepth")}: {data.maxDepth}
          </span>
          {data.truncated ? (
            <span className="mq-badge mq-badge-orange">{t("wallet.networkTruncated")}</span>
          ) : null}

          {/* View mode toggle */}
          <div className="ml-auto flex items-center gap-1 rounded-full border border-mq-border p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("tree")}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                viewMode === "tree"
                  ? "bg-mq-gold text-black"
                  : "text-mq-text-muted hover:text-mq-text"
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline-block mr-1 -mt-0.5">
                <path d="M12 3v6m0 0H8m4 0h4M8 9v6m8-6v6M5 15h6m2 0h6M5 15v3a1 1 0 001 1h2a1 1 0 001-1v-3m4 0v3a1 1 0 001 1h2a1 1 0 001-1v-3" />
              </svg>
              {t("wallet.networkViewTree")}
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                viewMode === "list"
                  ? "bg-mq-gold text-black"
                  : "text-mq-text-muted hover:text-mq-text"
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline-block mr-1 -mt-0.5">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
              {t("wallet.networkViewList")}
            </button>
          </div>
        </div>
      ) : null}

      {!isLoading && total === 0 && !isError ? (
        <p className="text-sm text-mq-text-muted text-center py-6">
          {t("wallet.networkEmpty")}
        </p>
      ) : null}

      {/* Tree View */}
      {viewMode === "tree" && data && total > 0 ? (
        <NetworkTreeFlow
          nodes={data.nodes}
          rootUserId={data.rootUserId}
          totalDownline={data.totalDownline}
          rootUser={user ? {
            fullName: user.fullName,
            email: user.email,
            mlmRank: user.mlmRank,
            avatarUrl: user.avatarUrl,
          } : undefined}
        />
      ) : null}

      {/* List View */}
      {viewMode === "list" && (
        <>
          {pageByDepth.map(([depth, nodes]) => (
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

          {meta ? (
            <PaginationBar page={safePage} meta={meta} onPageChange={onPageChange} />
          ) : null}
        </>
      )}
    </div>
  );

  if (embedded) return body;

  return (
    <>
      <PageHero
        title={t("wallet.network")}
        breadcrumb={[
          { label: t("wallet.title"), href: "/wallet" },
          { label: t("wallet.network") },
        ]}
      />
      <Container className="py-10 md:py-14 max-w-5xl mx-auto">{body}</Container>
    </>
  );
}

export function WalletNetwork({ embedded = false }: { embedded?: boolean }) {
  return (
    <AuthGuard
      roles={["BUYER", "SELLER", "ACCOUNTANT", "ADMIN", "SUPER_ADMIN"]}
      permissions={["VIEW_MLM_TREE"]}
    >
      <NetworkPanel embedded={embedded} />
    </AuthGuard>
  );
}
