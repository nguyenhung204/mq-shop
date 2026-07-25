"use client";

import { FormEvent, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/lib/api";
import type { AuthUser } from "@/lib/api/types";
import { formatPercent, parsePage } from "@/lib/api/utils";
import type { NetworkNode } from "@/lib/api/mlm";
import { useMlmRanks, useNetworkTree, useSetMlmRank, useSetMlmReferralRate, useSetMlmReferrer } from "@/lib/queries/wallet";
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
  const setReferrer = useSetMlmReferrer();
  const setReferralRate = useSetMlmReferralRate();

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
        label: userLabel(u),
        keywords: `${u.fullName ?? ""} ${u.email} ${u.id}`,
      })),
    [users],
  );

  const [selectedUserId, setSelectedUserId] = useState("");
  const [rank, setRankValue] = useState("5");
  const [formError, setFormError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const [referrerUserId, setReferrerUserId] = useState("");
  const [newReferrerId, setNewReferrerId] = useState("");
  const [referrerError, setReferrerError] = useState("");
  const [referrerOk, setReferrerOk] = useState("");

  const [rateUserId, setRateUserId] = useState("");
  const [ratePercent, setRatePercent] = useState("");
  const [rateError, setRateError] = useState("");
  const [rateOk, setRateOk] = useState("");

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
  const referrerTarget = users.find((u) => u.id === referrerUserId);
  const rateTarget = users.find((u) => u.id === rateUserId);
  const treeUser = users.find((u) => u.id === treeUserId);

  const referrerOptions = useMemo(
    () => userOptions.filter((o) => o.value !== referrerUserId),
    [userOptions, referrerUserId],
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

  const onSetReferrer = async (e: FormEvent) => {
    e.preventDefault();
    setReferrerError("");
    setReferrerOk("");
    if (!referrerUserId) {
      setReferrerError(t("admin.mlm.userRequired"));
      return;
    }
    if (!newReferrerId) {
      setReferrerError(t("admin.mlm.referrerRequired"));
      return;
    }
    if (newReferrerId === referrerUserId) {
      setReferrerError(t("admin.mlm.referrerSelf"));
      return;
    }
    try {
      await setReferrer.mutateAsync({
        userId: referrerUserId,
        body: { referrerId: newReferrerId },
      });
      setReferrerOk(t("admin.mlm.referrerUpdated"));
    } catch {
      /* toast */
    }
  };

  const onClearReferrer = async () => {
    setReferrerError("");
    setReferrerOk("");
    if (!referrerUserId) {
      setReferrerError(t("admin.mlm.userRequired"));
      return;
    }
    try {
      await setReferrer.mutateAsync({
        userId: referrerUserId,
        body: { referrerId: null },
      });
      setNewReferrerId("");
      setReferrerOk(t("admin.mlm.referrerCleared"));
    } catch {
      /* toast */
    }
  };

  const onSetRate = async (e: FormEvent) => {
    e.preventDefault();
    setRateError("");
    setRateOk("");
    if (!rateUserId) {
      setRateError(t("admin.mlm.userRequired"));
      return;
    }
    const n = Number(ratePercent);
    if (!Number.isFinite(n) || n < 0 || n > 10) {
      setRateError(t("admin.mlm.rateInvalid"));
      return;
    }
    try {
      await setReferralRate.mutateAsync({
        userId: rateUserId,
        body: { ratePercent: n },
      });
      setRateOk(t("admin.mlm.rateUpdated", { rate: String(n) }));
    } catch {
      /* toast */
    }
  };

  const onClearRate = async () => {
    setRateError("");
    setRateOk("");
    if (!rateUserId) {
      setRateError(t("admin.mlm.userRequired"));
      return;
    }
    try {
      await setReferralRate.mutateAsync({
        userId: rateUserId,
        body: { ratePercent: null },
      });
      setRatePercent("");
      setRateOk(t("admin.mlm.rateCleared"));
    } catch {
      /* toast */
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

      <div className="space-y-6 w-full">
        <p className="text-sm text-mq-text-muted">{t("admin.mlm.hint")}</p>

        {canSetRank ? (
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
                      <th className="px-3 py-2 font-medium w-12">#</th>
                      <th className="px-3 py-2 font-medium">{t("admin.mlm.rankName")}</th>
                      <th className="px-3 py-2 font-medium text-right whitespace-nowrap">
                        {t("admin.mlm.team")}
                      </th>
                      <th className="px-3 py-2 font-medium text-right whitespace-nowrap">
                        {t("admin.mlm.referral")}
                      </th>
                      <th className="px-3 py-2 font-medium text-right whitespace-nowrap">
                        {t("admin.mlm.globalTier")}
                      </th>
                      <th className="px-3 py-2 font-medium text-center w-20">
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
                        <td className="px-3 py-1.5 font-semibold text-mq-text">{r.rank}</td>
                        <td className="px-3 py-1.5 text-mq-text">{r.name}</td>
                        <td className="px-3 py-1.5 text-right text-mq-text-muted">
                          {formatPercent(r.teamPercent)}
                        </td>
                        <td className="px-3 py-1.5 text-right text-mq-text-muted">
                          {formatPercent(r.referralPercent)}
                        </td>
                        <td className="px-3 py-1.5 text-right text-mq-text-muted">
                          {r.globalFundTier != null ? `≥${r.globalFundTier}` : "—"}
                        </td>
                        <td className="px-3 py-1.5 text-center">
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
        ) : (
          <div className="mq-alert mq-alert-error text-sm">
            {t("admin.mlm.noConfigPerm")}
          </div>
        )}

        <div
          className={`grid gap-4 items-start ${
            canSetRank && canViewTree ? "lg:grid-cols-2" : "grid-cols-1"
          }`}
        >
          {canSetRank ? (
            <section className="mq-card p-5 space-y-3 min-w-0">
              <h2 className="text-base font-medium">{t("admin.mlm.setRankTitle")}</h2>
              <p className="text-sm text-mq-text-muted">{t("admin.mlm.setRankHint")}</p>
              {formError ? (
                <div className="mq-alert mq-alert-error break-words">{formError}</div>
              ) : null}
              {okMsg ? (
                <div className="mq-alert mq-alert-success break-words">{okMsg}</div>
              ) : null}
              <form className="space-y-3 min-w-0" onSubmit={(e) => void onSubmit(e)}>
                <label className="block text-sm min-w-0">
                  <span className="text-xs text-mq-text-muted">{t("admin.mlm.searchUser")}</span>
                  <div className="mt-1 min-w-0">
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
                  <div className="rounded-md border border-mq-border bg-mq-surface-subtle px-3 py-2 text-xs min-w-0 overflow-hidden space-y-0.5">
                    <p className="truncate font-medium text-mq-text">
                      {selectedUser.fullName || selectedUser.email}
                    </p>
                    {selectedUser.fullName ? (
                      <p className="truncate text-mq-text-muted">{selectedUser.email}</p>
                    ) : null}
                    <p
                      className="truncate font-mono text-mq-text-muted"
                      title={selectedUser.id}
                    >
                      {selectedUser.id}
                    </p>
                    {selectedUser.mlmRank != null ? (
                      <p className="text-mq-text-muted">
                        {t("wallet.rank")} {selectedUser.mlmRank}
                      </p>
                    ) : null}
                    {selectedUser.referralRateOverride != null &&
                    selectedUser.referralRateOverride !== "" ? (
                      <p className="text-mq-text-muted">
                        {t("wallet.referralRateOverride")}:{" "}
                        {selectedUser.referralRateOverride}%
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-3 items-end">
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-xs text-mq-text-muted">{t("wallet.rank")}</span>
                    <select
                      className="mq-input !w-[6rem] max-w-full"
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
          ) : null}

          {canViewTree ? (
            <section className="mq-card p-5 space-y-3 min-w-0">
              <h2 className="text-base font-medium">{t("admin.mlm.treeTitle")}</h2>
              <p className="text-sm text-mq-text-muted">{t("admin.mlm.treeHint")}</p>
              <form className="space-y-3 min-w-0" onSubmit={onLoadTree}>
                <label className="block text-sm min-w-0">
                  <span className="text-xs text-mq-text-muted">{t("admin.mlm.searchUser")}</span>
                  <div className="mt-1 min-w-0">
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
                  <div className="rounded-md border border-mq-border bg-mq-surface-subtle px-3 py-2 text-xs min-w-0 overflow-hidden space-y-0.5">
                    <p className="truncate font-medium text-mq-text">
                      {treeUser.fullName || treeUser.email}
                    </p>
                    {treeUser.fullName ? (
                      <p className="truncate text-mq-text-muted">{treeUser.email}</p>
                    ) : null}
                    <p
                      className="truncate font-mono text-mq-text-muted"
                      title={treeUser.id}
                    >
                      {treeUser.id}
                    </p>
                  </div>
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
                <div className="mq-alert mq-alert-error break-words">
                  {treeErr instanceof Error ? treeErr.message : t("admin.common.failed")}
                </div>
              ) : null}
              {tree ? (
                <div className="space-y-3 max-h-[28rem] overflow-y-auto overflow-x-hidden pr-1 min-w-0">
                  <div className="flex flex-wrap gap-2 text-xs sticky top-0 bg-mq-surface-elevated py-1 z-10">
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
                    <div key={depth} className="space-y-1 min-w-0">
                      <p className="text-xs uppercase tracking-wider text-mq-text-muted">
                        F{depth} · {nodes.length}
                      </p>
                      {nodes.slice(0, 20).map((n) => (
                        <div
                          key={n.userId}
                          className="text-sm flex items-center justify-between gap-2 border-b border-mq-border py-1 min-w-0"
                        >
                          <span className="truncate min-w-0">
                            {n.fullName || n.email || n.userId.slice(0, 8)}
                          </span>
                          {n.mlmRank != null ? (
                            <span className="text-xs text-mq-text-muted shrink-0">
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

        {canSetRank ? (
          <div className="grid gap-4 items-start lg:grid-cols-2">
            <section className="mq-card p-5 space-y-3 min-w-0">
              <h2 className="text-base font-medium">{t("admin.mlm.setReferrerTitle")}</h2>
              <p className="text-sm text-mq-text-muted">{t("admin.mlm.setReferrerHint")}</p>
              {referrerError ? (
                <div className="mq-alert mq-alert-error break-words">{referrerError}</div>
              ) : null}
              {referrerOk ? (
                <div className="mq-alert mq-alert-success break-words">{referrerOk}</div>
              ) : null}
              <form className="space-y-3" onSubmit={(e) => void onSetReferrer(e)}>
                <label className="block text-sm min-w-0">
                  <span className="text-xs text-mq-text-muted">{t("admin.mlm.searchUser")}</span>
                  <div className="mt-1">
                    <SearchableSelect
                      options={userOptions}
                      value={referrerUserId}
                      required
                      aria-label={t("admin.mlm.searchUser")}
                      placeholder={t("admin.mlm.searchUserPh")}
                      searchPlaceholder={t("admin.mlm.searchUserPh")}
                      onChange={(id) => {
                        setReferrerUserId(id);
                        if (newReferrerId === id) setNewReferrerId("");
                      }}
                    />
                  </div>
                </label>
                {referrerTarget ? (
                  <div className="rounded-md border border-mq-border bg-mq-surface-subtle px-3 py-2 text-xs space-y-0.5">
                    <p className="truncate font-medium">
                      {referrerTarget.fullName || referrerTarget.email}
                    </p>
                    <p className="truncate font-mono text-mq-text-muted" title={referrerTarget.id}>
                      {referrerTarget.id}
                    </p>
                    <p className="text-mq-text-muted">
                      {t("admin.mlm.currentReferrer")}:{" "}
                      {referrerTarget.referrerId
                        ? users.find((u) => u.id === referrerTarget.referrerId)
                            ?.email ?? referrerTarget.referrerId.slice(0, 8)
                        : "—"}
                    </p>
                  </div>
                ) : null}
                <label className="block text-sm min-w-0">
                  <span className="text-xs text-mq-text-muted">{t("admin.mlm.newReferrer")}</span>
                  <div className="mt-1">
                    <SearchableSelect
                      options={referrerOptions}
                      value={newReferrerId}
                      aria-label={t("admin.mlm.newReferrer")}
                      placeholder={t("admin.mlm.newReferrerPh")}
                      searchPlaceholder={t("admin.mlm.searchUserPh")}
                      onChange={setNewReferrerId}
                    />
                  </div>
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    className="mq-btn mq-btn-primary"
                    disabled={setReferrer.isPending || !referrerUserId || !newReferrerId}
                  >
                    {setReferrer.isPending
                      ? t("admin.common.saving")
                      : t("admin.mlm.setReferrer")}
                  </button>
                  <button
                    type="button"
                    className="mq-btn mq-btn-outline"
                    disabled={setReferrer.isPending || !referrerUserId}
                    onClick={() => void onClearReferrer()}
                  >
                    {t("admin.mlm.clearReferrer")}
                  </button>
                </div>
              </form>
            </section>

            <section className="mq-card p-5 space-y-3 min-w-0">
              <h2 className="text-base font-medium">{t("admin.mlm.setRateTitle")}</h2>
              <p className="text-sm text-mq-text-muted">{t("admin.mlm.setRateHint")}</p>
              {rateError ? (
                <div className="mq-alert mq-alert-error break-words">{rateError}</div>
              ) : null}
              {rateOk ? (
                <div className="mq-alert mq-alert-success break-words">{rateOk}</div>
              ) : null}
              <form className="space-y-3" onSubmit={(e) => void onSetRate(e)}>
                <label className="block text-sm min-w-0">
                  <span className="text-xs text-mq-text-muted">{t("admin.mlm.searchUser")}</span>
                  <div className="mt-1">
                    <SearchableSelect
                      options={userOptions}
                      value={rateUserId}
                      required
                      aria-label={t("admin.mlm.searchUser")}
                      placeholder={t("admin.mlm.searchUserPh")}
                      searchPlaceholder={t("admin.mlm.searchUserPh")}
                      onChange={setRateUserId}
                    />
                  </div>
                </label>
                {rateTarget ? (
                  <div className="rounded-md border border-mq-border bg-mq-surface-subtle px-3 py-2 text-xs space-y-0.5">
                    <p className="truncate font-medium">
                      {rateTarget.fullName || rateTarget.email}
                    </p>
                    <p className="text-mq-text-muted">
                      {t("wallet.referralRateOverride")}:{" "}
                      {rateTarget.referralRateOverride != null &&
                      rateTarget.referralRateOverride !== ""
                        ? `${rateTarget.referralRateOverride}%`
                        : t("admin.mlm.rateDefault")}
                    </p>
                  </div>
                ) : null}
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-xs text-mq-text-muted">{t("admin.mlm.ratePercent")}</span>
                  <input
                    className="mq-input !w-[8rem] max-w-full"
                    type="number"
                    min={0}
                    max={10}
                    step={0.01}
                    value={ratePercent}
                    onChange={(e) => setRatePercent(e.target.value)}
                    placeholder="0–10"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    className="mq-btn mq-btn-primary"
                    disabled={setReferralRate.isPending || !rateUserId}
                  >
                    {setReferralRate.isPending
                      ? t("admin.common.saving")
                      : t("admin.mlm.setRate")}
                  </button>
                  <button
                    type="button"
                    className="mq-btn mq-btn-outline"
                    disabled={setReferralRate.isPending || !rateUserId}
                    onClick={() => void onClearRate()}
                  >
                    {t("admin.mlm.clearRate")}
                  </button>
                </div>
              </form>
            </section>
          </div>
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
