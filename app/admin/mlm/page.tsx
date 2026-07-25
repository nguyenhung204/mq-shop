"use client";

import { FormEvent, useMemo, useState } from "react";
import { formatPercent } from "@/lib/api/utils";
import type { NetworkNode } from "@/lib/api/mlm";
import { useMlmRanks, useNetworkTree, useSetMlmRank } from "@/lib/queries/wallet";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { AdminCardListSkeleton } from "@/components/ui/Skeleton";

function MlmAdminInner() {
  const { t } = useLanguage();
  const { hasRole, hasPermission } = useAuth();
  const canConfigRank =
    hasRole("SUPER_ADMIN") || hasPermission("CONFIG_MLM");

  const { data: ranks, isLoading, isError, error } = useMlmRanks({
    enabled: canConfigRank,
  });
  const setRank = useSetMlmRank();

  const [userId, setUserId] = useState("");
  const [rank, setRankValue] = useState("5");
  const [formError, setFormError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const [treeUserId, setTreeUserId] = useState("");
  const [treeQuery, setTreeQuery] = useState("");
  const {
    data: tree,
    isLoading: treeLoading,
    isError: treeError,
    error: treeErr,
  } = useNetworkTree(
    treeQuery ? { userId: treeQuery, maxDepth: 20, limit: 500 } : {},
    { enabled: Boolean(treeQuery) },
  );

  const treeByDepth = useMemo(() => {
    const map = new Map<number, NetworkNode[]>();
    for (const node of tree?.nodes ?? []) {
      const list = map.get(node.depth) ?? [];
      list.push(node);
      map.set(node.depth, list);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [tree?.nodes]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError("");
    setOkMsg("");
    const id = userId.trim();
    const n = Number(rank);
    if (!id) {
      setFormError(t("admin.mlm.userIdRequired"));
      return;
    }
    if (!Number.isInteger(n) || n < 1 || n > 10) {
      setFormError(t("admin.mlm.rankInvalid"));
      return;
    }
    try {
      const res = await setRank.mutateAsync({ userId: id, body: { rank: n } });
      setOkMsg(
        t("admin.mlm.rankUpdated", {
          email: res.email,
          rank: String(res.mlmRank),
          name: res.rankName,
        }),
      );
    } catch {
      /* toast from hook */
    }
  };

  const onLoadTree = (e: FormEvent) => {
    e.preventDefault();
    setTreeQuery(treeUserId.trim());
  };

  return (
    <>
      <AdminPageHeader
        title={t("admin.mlm.title")}
        description={t("admin.mlm.description")}
      />

      <div className="space-y-6 max-w-3xl">
        <p className="text-sm text-mq-text-muted">{t("admin.mlm.hint")}</p>

        {canConfigRank ? (
          <>
            <section className="space-y-3">
              <h2 className="text-lg">{t("admin.mlm.ranksTitle")}</h2>
              {isLoading ? <AdminCardListSkeleton count={5} /> : null}
              {isError ? (
                <div className="mq-alert mq-alert-error">
                  {error instanceof Error ? error.message : t("admin.common.failed")}
                </div>
              ) : null}
              {(ranks ?? []).map((r) => (
                <div
                  key={r.rank}
                  className="mq-card p-4 flex flex-wrap justify-between gap-3 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {t("wallet.rank")} {r.rank} · {r.name}
                    </p>
                    <p className="text-xs text-mq-text-muted mt-1">
                      {t("admin.mlm.team")}: {formatPercent(r.teamPercent)} ·{" "}
                      {t("admin.mlm.referral")}: {formatPercent(r.referralPercent)}
                      {r.globalFundTier != null
                        ? ` · ${t("admin.mlm.globalTier")}: ≥${r.globalFundTier}`
                        : ""}
                    </p>
                  </div>
                  <span
                    className={
                      r.isActive ? "mq-badge mq-badge-cyan" : "mq-badge mq-badge-muted"
                    }
                  >
                    {r.isActive ? t("admin.common.active") : t("admin.common.hidden")}
                  </span>
                </div>
              ))}
            </section>

            <section className="mq-card p-5 space-y-3">
              <h2 className="text-lg">{t("admin.mlm.setRankTitle")}</h2>
              <p className="text-sm text-mq-text-muted">{t("admin.mlm.setRankHint")}</p>
              {formError ? <div className="mq-alert mq-alert-error">{formError}</div> : null}
              {okMsg ? <div className="mq-alert mq-alert-success">{okMsg}</div> : null}
              <form
                className="flex flex-wrap gap-3 items-end"
                onSubmit={(e) => void onSubmit(e)}
              >
                <label className="block text-sm">
                  <span className="text-xs text-mq-text-muted">{t("admin.mlm.userId")}</span>
                  <input
                    className="mq-input mt-1 min-w-[16rem]"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    placeholder="uuid"
                    required
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-xs text-mq-text-muted">{t("wallet.rank")}</span>
                  <select
                    className="mq-input mt-1 !w-[6rem]"
                    value={rank}
                    onChange={(e) => setRankValue(e.target.value)}
                  >
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="submit"
                  className="mq-btn mq-btn-primary"
                  disabled={setRank.isPending}
                >
                  {setRank.isPending ? t("admin.common.saving") : t("admin.mlm.setRank")}
                </button>
              </form>
            </section>
          </>
        ) : null}

        <section className="mq-card p-5 space-y-3">
          <h2 className="text-lg">{t("admin.mlm.treeTitle")}</h2>
          <p className="text-sm text-mq-text-muted">{t("admin.mlm.treeHint")}</p>
          <form className="flex flex-wrap gap-3 items-end" onSubmit={onLoadTree}>
            <label className="block text-sm">
              <span className="text-xs text-mq-text-muted">{t("admin.mlm.userId")}</span>
              <input
                className="mq-input mt-1 min-w-[16rem]"
                value={treeUserId}
                onChange={(e) => setTreeUserId(e.target.value)}
                placeholder="uuid"
                required
              />
            </label>
            <button type="submit" className="mq-btn mq-btn-outline">
              {t("admin.mlm.loadTree")}
            </button>
          </form>
          {treeLoading ? <p className="text-sm text-mq-text-muted">{t("wallet.loading")}</p> : null}
          {treeError ? (
            <div className="mq-alert mq-alert-error">
              {treeErr instanceof Error ? treeErr.message : t("admin.common.failed")}
            </div>
          ) : null}
          {tree ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="mq-badge mq-badge-muted">
                  {t("wallet.networkTotal")}: {tree.totalDownline}
                </span>
                {tree.truncated ? (
                  <span className="mq-badge mq-badge-orange">
                    {t("wallet.networkTruncated")}
                  </span>
                ) : null}
              </div>
              {treeByDepth.map(([depth, nodes]) => (
                <div key={depth} className="space-y-1">
                  <p className="text-xs uppercase tracking-wider text-mq-text-muted">
                    F{depth} · {nodes.length}
                  </p>
                  {nodes.slice(0, 20).map((n) => (
                    <div
                      key={n.userId}
                      className="text-sm flex flex-wrap justify-between gap-2 border-b border-mq-border py-1"
                    >
                      <span className="truncate">
                        {n.fullName || n.email || n.userId.slice(0, 8)}
                      </span>
                      {n.mlmRank != null ? (
                        <span className="text-xs text-mq-text-muted">
                          {t("wallet.rank")} {n.mlmRank}
                        </span>
                      ) : null}
                    </div>
                  ))}
                  {nodes.length > 20 ? (
                    <p className="text-xs text-mq-text-muted">
                      +{nodes.length - 20} more
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </>
  );
}

export default function AdminMlmPage() {
  return (
    <AuthGuard
      roles={["SUPER_ADMIN", "ACCOUNTANT", "ADMIN"]}
      permissions={["CONFIG_MLM", "VIEW_MLM_TREE"]}
    >
      <MlmAdminInner />
    </AuthGuard>
  );
}
