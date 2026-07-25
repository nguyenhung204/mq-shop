"use client";

import { FormEvent, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/lib/api";
import type { AuthUser } from "@/lib/api/types";
import { formatPercent, parsePage } from "@/lib/api/utils";
import type { NetworkNode } from "@/lib/api/mlm";
import { useMlmRanks, useNetworkTree, useSetMlmRank } from "@/lib/queries/wallet";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/ui/SearchableSelect";
import { AdminCardListSkeleton } from "@/components/ui/Skeleton";

function userLabel(u: AuthUser): string {
  const name = u.fullName?.trim();
  if (name) return `${name} · ${u.email}`;
  return u.email;
}

function MlmAdminInner() {
  const { t } = useLanguage();
  const { hasRole } = useAuth();

  /**
   * CONFIG_MLM matrix: Admin=NONE, Accountant=APPROVE, Super Admin=ALL.
   * Do not use hasPermission("CONFIG_MLM") alone — AuthProvider treats ADMIN as all-perms.
   */
  const canSetRank = hasRole("SUPER_ADMIN") || hasRole("ACCOUNTANT");
  const canViewTree =
    hasRole("SUPER_ADMIN") ||
    hasRole("ACCOUNTANT") ||
    hasRole("ADMIN");

  const { data: ranks, isLoading, isError, error } = useMlmRanks({
    enabled: canSetRank,
  });
  const setRank = useSetMlmRank();

  const { data: usersPage } = useQuery({
    queryKey: ["admin", "users", "ACTIVE", "mlm-picker"],
    queryFn: async () =>
      parsePage<AuthUser>(
        await adminApi.users({ status: "ACTIVE", page: 1, pageSize: 100 }),
      ),
  });
  const users = useMemo(() => {
    const list = usersPage?.items ?? [];
    return [...list].sort((a, b) =>
      userLabel(a).localeCompare(userLabel(b), undefined, { sensitivity: "base" }),
    );
  }, [usersPage?.items]);

  const userOptions = useMemo<SearchableSelectOption[]>(
    () =>
      users.map((u) => ({
        value: u.id,
        label: `${userLabel(u)} · ${u.id}`,
        keywords: `${u.fullName ?? ""} ${u.email} ${u.id}`,
      })),
    [users],
  );

  const [selectedUserId, setSelectedUserId] = useState("");
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
    { enabled: Boolean(treeQuery) && canViewTree },
  );

  const selectedUser = users.find((u) => u.id === selectedUserId);
  const treeUser = users.find((u) => u.id === treeUserId);

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
    if (!selectedUserId) {
      setFormError(t("admin.mlm.userRequired"));
      return;
    }
    const n = Number(rank);
    if (!Number.isInteger(n) || n < 1 || n > 10) {
      setFormError(t("admin.mlm.rankInvalid"));
      return;
    }
    try {
      const res = await setRank.mutateAsync({
        userId: selectedUserId,
        body: { rank: n },
      });
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
    if (!treeUserId.trim()) return;
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

        {canSetRank ? (
          <>
            <section className="space-y-2">
              <h2 className="text-base font-medium">{t("admin.mlm.ranksTitle")}</h2>
              {isLoading ? <AdminCardListSkeleton count={2} /> : null}
              {isError ? (
                <div className="mq-alert mq-alert-error">
                  {error instanceof Error ? error.message : t("admin.common.failed")}
                </div>
              ) : null}
              {(ranks ?? []).length > 0 ? (
                <div className="mq-table-wrap overflow-x-auto">
                  <table className="w-full text-xs tabular-nums">
                    <thead>
                      <tr className="border-b border-mq-border bg-mq-surface-subtle text-left text-mq-text-muted">
                        <th className="px-2.5 py-1.5 font-medium w-10">#</th>
                        <th className="px-2.5 py-1.5 font-medium">{t("admin.mlm.rankName")}</th>
                        <th className="px-2.5 py-1.5 font-medium text-right whitespace-nowrap">
                          {t("admin.mlm.team")}
                        </th>
                        <th className="px-2.5 py-1.5 font-medium text-right whitespace-nowrap">
                          {t("admin.mlm.referral")}
                        </th>
                        <th className="px-2.5 py-1.5 font-medium text-right whitespace-nowrap">
                          {t("admin.mlm.globalTier")}
                        </th>
                        <th className="px-2.5 py-1.5 font-medium text-center w-16">
                          {t("admin.common.status")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(ranks ?? []).map((r) => (
                        <tr
                          key={r.rank}
                          className="border-b border-mq-border last:border-0 hover:bg-mq-surface-subtle/60"
                        >
                          <td className="px-2.5 py-1 font-semibold text-mq-text">{r.rank}</td>
                          <td className="px-2.5 py-1 text-mq-text">{r.name}</td>
                          <td className="px-2.5 py-1 text-right text-mq-text-muted">
                            {formatPercent(r.teamPercent)}
                          </td>
                          <td className="px-2.5 py-1 text-right text-mq-text-muted">
                            {formatPercent(r.referralPercent)}
                          </td>
                          <td className="px-2.5 py-1 text-right text-mq-text-muted">
                            {r.globalFundTier != null ? `≥${r.globalFundTier}` : "—"}
                          </td>
                          <td className="px-2.5 py-1 text-center">
                            <span
                              className={
                                r.isActive
                                  ? "mq-badge mq-badge-cyan !text-[10px] !px-1.5 !py-0"
                                  : "mq-badge mq-badge-muted !text-[10px] !px-1.5 !py-0"
                              }
                            >
                              {r.isActive
                                ? t("admin.common.active")
                                : t("admin.common.hidden")}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </section>

            <section className="mq-card p-5 space-y-3">
              <h2 className="text-lg">{t("admin.mlm.setRankTitle")}</h2>
              <p className="text-sm text-mq-text-muted">{t("admin.mlm.setRankHint")}</p>
              {formError ? <div className="mq-alert mq-alert-error">{formError}</div> : null}
              {okMsg ? <div className="mq-alert mq-alert-success">{okMsg}</div> : null}
              <form className="space-y-3" onSubmit={(e) => void onSubmit(e)}>
                <label className="block text-sm">
                  <span className="text-xs text-mq-text-muted">{t("admin.mlm.searchUser")}</span>
                  <div className="mt-1">
                    <SearchableSelect
                      options={userOptions}
                      value={selectedUserId}
                      required
                      aria-label={t("admin.mlm.searchUser")}
                      placeholder={t("admin.mlm.searchUserPh")}
                      searchPlaceholder={t("admin.mlm.searchUserPh")}
                      onChange={setSelectedUserId}
                    />
                  </div>
                </label>
                {selectedUser ? (
                  <p className="text-xs text-mq-text-muted break-all">
                    {selectedUser.fullName || "—"} · {selectedUser.email} ·{" "}
                    <span className="font-mono">{selectedUser.id}</span>
                    {selectedUser.mlmRank != null
                      ? ` · ${t("wallet.rank")} ${selectedUser.mlmRank}`
                      : ""}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-3 items-end">
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
                    disabled={setRank.isPending || !selectedUserId}
                  >
                    {setRank.isPending ? t("admin.common.saving") : t("admin.mlm.setRank")}
                  </button>
                </div>
              </form>
            </section>
          </>
        ) : (
          <div className="mq-alert mq-alert-error text-sm">
            {t("admin.mlm.noConfigPerm")}
          </div>
        )}

        {canViewTree ? (
          <section className="mq-card p-5 space-y-3">
            <h2 className="text-lg">{t("admin.mlm.treeTitle")}</h2>
            <p className="text-sm text-mq-text-muted">{t("admin.mlm.treeHint")}</p>
            <form className="space-y-3" onSubmit={onLoadTree}>
              <label className="block text-sm">
                <span className="text-xs text-mq-text-muted">{t("admin.mlm.searchUser")}</span>
                <div className="mt-1">
                  <SearchableSelect
                    options={userOptions}
                    value={treeUserId}
                    required
                    aria-label={t("admin.mlm.searchUser")}
                    placeholder={t("admin.mlm.searchUserPh")}
                    searchPlaceholder={t("admin.mlm.searchUserPh")}
                    onChange={setTreeUserId}
                  />
                </div>
              </label>
              {treeUser ? (
                <p className="text-xs text-mq-text-muted break-all">
                  {treeUser.fullName || "—"} · {treeUser.email} ·{" "}
                  <span className="font-mono">{treeUser.id}</span>
                </p>
              ) : null}
              <button
                type="submit"
                className="mq-btn mq-btn-outline"
                disabled={!treeUserId}
              >
                {t("admin.mlm.loadTree")}
              </button>
            </form>
            {treeLoading ? (
              <p className="text-sm text-mq-text-muted">{t("wallet.loading")}</p>
            ) : null}
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
        ) : null}
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
