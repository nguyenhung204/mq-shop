"use client";

import { FormEvent, Fragment, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Pencil } from "lucide-react";
import { adminApi } from "@/lib/api";
import type { AuthUser } from "@/lib/api/types";
import { formatMoney, formatPercent, parsePage } from "@/lib/api/utils";
import type {
  GlobalFundOverview,
  GlobalFundTierStatus,
  MlmRankConfig,
  MonthlyCommissionOverviewRow,
  MonthlyCommissionSuggestedAction,
} from "@/lib/api/mlm";
import {
  useMlmRanks,
  useMonthlyCommissionOverview,
  useFullTree,
  useReconcileMlmRanks,
  useRunMonthlyCommissions,
  useSetMlmRank,
  useSetMlmReferrer,
  useUpdateRankConfig,
} from "@/lib/queries/wallet";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { mlmRankLabel } from "@/lib/i18n/mlm-rank";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/ui/SearchableSelect";
import { AdminCardListSkeleton } from "@/components/ui/Skeleton";
import { getErrorMessage } from "@/lib/queries/utils";
import { MlmCreateRankSection, MlmPromotionRulesSection } from "@/components/admin/MlmPromotionRules";
import { NetworkTreeFlow } from "@/components/wallet/network-tree/NetworkTreeFlow";
import {
  MLM_GLOBAL_TIER_MAX,
  MLM_GLOBAL_TIER_MIN,
  MLM_REFERRAL_PERCENT_MAX,
  MLM_REFERRAL_PERCENT_MIN,
  MLM_TEAM_PERCENT_MAX,
  MLM_TEAM_PERCENT_MIN,
  validateRankConfigInput,
} from "@/lib/mlm/rank-bounds";
import { toast } from "sonner";

function userLabel(u: AuthUser): string {
  const name = u.fullName?.trim();
  if (name) return `${name} · ${u.email}`;
  return u.email;
}

function suggestedBadge(action: MonthlyCommissionSuggestedAction): string {
  if (action === "RUN") return "mq-badge mq-badge-teal";
  if (action === "RE_RUN_IDEMPOTENT") return "mq-badge mq-badge-muted";
  return "mq-badge mq-badge-orange";
}

function tierStatusBadge(status: GlobalFundTierStatus): string {
  if (status === "PAID") return "mq-badge mq-badge-teal";
  if (status === "PENDING") return "mq-badge mq-badge-muted";
  if (status === "NOT_RUN") return "mq-badge mq-badge-muted";
  return "mq-badge mq-badge-orange";
}

function poolPerTier(row: MonthlyCommissionOverviewRow): string {
  return row.globalFund?.poolPerTier ?? row.globalFundEstimate ?? "0";
}

function creditedSummary(
  row: MonthlyCommissionOverviewRow,
  t: (key: string, vars?: Record<string, string>) => string,
): string {
  const parts: string[] = [];
  if (row.credited.teamCount > 0) {
    parts.push(
      `${t("admin.mlm.creditedTeam")} ${formatMoney(row.credited.teamPayoutTotal)}×${row.credited.teamCount}`,
    );
  }
  if (row.credited.globalCount > 0) {
    parts.push(
      `${t("admin.mlm.creditedGlobal")} ${formatMoney(row.credited.globalPayoutTotal)}×${row.credited.globalCount}`,
    );
  }
  if (row.credited.loyaltyCount > 0) {
    parts.push(
      `${t("admin.mlm.creditedLoyalty")} ${formatMoney(row.credited.loyaltyPayoutTotal)}×${row.credited.loyaltyCount}`,
    );
  }
  return parts.length ? parts.join(" · ") : "—";
}

function beneficiaryLabel(b: {
  email: string;
  fullName?: string | null;
  mlmRank: number;
  payoutAmount: string;
}): string {
  const name = b.fullName?.trim() || b.email || "—";
  return `${name} (R${b.mlmRank}) ${formatMoney(b.payoutAmount)}`;
}

function GlobalFundDetail({
  fund,
  t,
}: {
  fund: GlobalFundOverview;
  t: (key: string, vars?: Record<string, string>) => string;
}) {
  return (
    <div className="space-y-3 px-3 py-3 bg-mq-surface-subtle/50">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-mq-text-muted">
        <span>
          {t("admin.mlm.poolPerTier")}:{" "}
          <strong className="text-mq-text">{formatMoney(fund.poolPerTier)}</strong>
          {fund.percent != null ? ` (${fund.percent}%)` : null}
        </span>
        <span>
          {t("admin.mlm.totalPaidToUsers")}:{" "}
          <strong className="text-mq-text">{formatMoney(fund.totalPaidToUsers)}</strong>
        </span>
        <span>
          {t("admin.mlm.totalCompanyKept")}:{" "}
          <strong className="text-mq-text">{formatMoney(fund.totalCompanyKept)}</strong>
        </span>
      </div>

      <div className="mq-table-wrap overflow-x-auto border border-mq-border rounded-[var(--mq-radius-sm)] bg-mq-surface">
        <table className="w-full text-[11px] tabular-nums">
          <thead>
            <tr className="border-b border-mq-border bg-mq-surface-subtle text-left text-mq-text-muted">
              <th className="px-2 py-1.5 font-medium">{t("admin.mlm.tier")}</th>
              <th className="px-2 py-1.5 font-medium">{t("admin.common.status")}</th>
              <th className="px-2 py-1.5 font-medium text-right">
                {t("admin.mlm.paidToUsers")}
              </th>
              <th className="px-2 py-1.5 font-medium text-right">
                {t("admin.mlm.companyKept")}
              </th>
              <th className="px-2 py-1.5 font-medium">
                {t("admin.mlm.beneficiaries")}
              </th>
            </tr>
          </thead>
          <tbody>
            {fund.tiers.map((tier) => (
              <tr
                key={tier.tier}
                className="border-b border-mq-border last:border-0 align-top"
              >
                <td className="px-2 py-1.5 font-semibold text-mq-text whitespace-nowrap">
                  ≥{tier.tier}
                  <span className="ml-1 font-normal text-mq-text-muted">
                    ({tier.eligibleCount})
                  </span>
                </td>
                <td className="px-2 py-1.5">
                  <span className={tierStatusBadge(tier.status)}>
                    {t(`admin.mlm.tierStatus.${tier.status}`)}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-right text-mq-text">
                  {formatMoney(tier.paidTotal)}
                </td>
                <td className="px-2 py-1.5 text-right text-mq-text-muted">
                  {formatMoney(tier.companyKept)}
                </td>
                <td className="px-2 py-1.5 text-mq-text-muted">
                  {tier.beneficiaries.length === 0 ? (
                    "—"
                  ) : (
                    <ul className="space-y-0.5">
                      {tier.beneficiaries.map((b) => (
                        <li key={`${tier.tier}-${b.userId}`} className="truncate max-w-[28rem]" title={b.email}>
                          {beneficiaryLabel(b)}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {Number(fund.unscopedPaid?.paidTotal ?? 0) > 0 ||
      (fund.unscopedPaid?.beneficiaries?.length ?? 0) > 0 ? (
        <div className="text-[11px] space-y-1">
          <p className="font-medium text-mq-text">
            {t("admin.mlm.unscopedPaid")}:{" "}
            {formatMoney(fund.unscopedPaid.paidTotal)}
          </p>
          <ul className="text-mq-text-muted space-y-0.5 pl-3 list-disc">
            {fund.unscopedPaid.beneficiaries.map((b) => (
              <li key={`unscoped-${b.userId}`} className="truncate max-w-[28rem]">
                {beneficiaryLabel(b)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {fund.note ? (
        <p className="text-[11px] text-mq-text-muted">{fund.note}</p>
      ) : null}
    </div>
  );
}

function MlmAdminInner() {
  const { t, locale } = useLanguage();
  const { hasRole } = useAuth();

  /**
   * CONFIG_MLM: Super Admin=ALL (mutate). Accountant=APPROVE (read/approve only — BE 403 on PATCH).
   * APPROVE_MLM: Accountant + Super Admin can run monthly / flush.
   */
  const canMutateConfig = hasRole("SUPER_ADMIN");
  const canApproveSettlement =
    hasRole("SUPER_ADMIN") || hasRole("ACCOUNTANT");
  const canViewTree =
    hasRole("SUPER_ADMIN") ||
    hasRole("ACCOUNTANT") ||
    hasRole("ADMIN");

  const { data: ranks, isLoading, isError, error } = useMlmRanks({
    enabled: canMutateConfig || canApproveSettlement,
  });
  const setRank = useSetMlmRank();
  const setReferrer = useSetMlmReferrer();
  const runMonthly = useRunMonthlyCommissions();
  const reconcileRanks = useReconcileMlmRanks();
  const updateRankConfig = useUpdateRankConfig();
  const {
    data: monthlyOverview,
    isLoading: monthlyLoading,
    isError: monthlyIsError,
    error: monthlyErr,
  } = useMonthlyCommissionOverview(12, { enabled: canApproveSettlement });
  const months = monthlyOverview?.months ?? [];

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

  const [legacyRateUserId, setLegacyRateUserId] = useState("");

  const [reconcileUserId, setReconcileUserId] = useState("");
  const [reconcileLimit, setReconcileLimit] = useState("100");
  const [reconcileError, setReconcileError] = useState("");
  const [reconcileOk, setReconcileOk] = useState("");

  const [treeUserId, setTreeUserId] = useState("");
  const [treeQuery, setTreeQuery] = useState("");
  const [treeModalOpen, setTreeModalOpen] = useState(false);
  const [yearMonth, setYearMonth] = useState("");
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [monthlyOk, setMonthlyOk] = useState("");
  const [monthlyError, setMonthlyError] = useState("");
  const [editingRank, setEditingRank] = useState<MlmRankConfig | null>(null);
  const [editForm, setEditForm] = useState({ name: "", nameVi: "", nameEn: "", nameZhTw: "", teamPercent: "", referralPercent: "", globalFundTier: "", isActive: true });

  useEffect(() => {
    if (yearMonth || months.length === 0) return;
    const preferred =
      months.find((m) => m.suggestedAction === "RUN") ??
      months.find((m) => Number(m.gmv) > 0) ??
      months[0];
    if (preferred?.yearMonth) setYearMonth(preferred.yearMonth);
  }, [months, yearMonth]);

  const selectedMonth = months.find((m) => m.yearMonth === yearMonth);
  const canRunSelected =
    Boolean(yearMonth) &&
    selectedMonth?.suggestedAction !== "NO_VOLUME" &&
    Number(selectedMonth?.gmv ?? 0) > 0;

  const {
    data: tree,
    isLoading: treeLoading,
    isError: treeError,
    error: treeErr,
  } = useFullTree(
    { userId: treeQuery, maxDepth: 20, limit: 500 },
    { enabled: Boolean(treeQuery) && canViewTree },
  );

  const selectedUser = users.find((u) => u.id === selectedUserId);
  const referrerTarget = users.find((u) => u.id === referrerUserId);
  const legacyRateTarget = users.find((u) => u.id === legacyRateUserId);
  const treeUser = users.find((u) => u.id === treeUserId);

  const referrerOptions = useMemo(
    () => userOptions.filter((o) => o.value !== referrerUserId),
    [userOptions, referrerUserId],
  );

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError("");
    setOkMsg("");
    if (!selectedUserId) {
      setFormError(t("admin.mlm.userRequired"));
      return;
    }
    const n = Number(rank);
    if (!Number.isInteger(n) || n < 0 || n > 10) {
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

  const onReconcileUser = async (e: FormEvent) => {
    e.preventDefault();
    setReconcileError("");
    setReconcileOk("");
    if (!reconcileUserId) {
      setReconcileError(t("admin.mlm.userRequired"));
      return;
    }
    try {
      const res = await reconcileRanks.mutateAsync({ userId: reconcileUserId });
      if (res && "promoted" in res) {
        setReconcileOk(
          res.promoted
            ? t("admin.mlm.reconcilePromoted", {
                from: String(res.fromRank),
                to: String(res.toRank),
              })
            : t("admin.mlm.reconcileNoChange"),
        );
      }
    } catch {
      /* toast */
    }
  };

  const onReconcileBatch = async () => {
    setReconcileError("");
    setReconcileOk("");
    const limit = Number(reconcileLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
      setReconcileError(t("admin.mlm.reconcileLimitInvalid"));
      return;
    }
    try {
      const res = await reconcileRanks.mutateAsync({ limit });
      if (res && "checked" in res) {
        setReconcileOk(
          t("admin.mlm.reconcileBatchDone", {
            checked: String(res.checked),
            promoted: String(res.promotedUsers?.length ?? 0),
          }),
        );
      }
    } catch {
      /* toast */
    }
  };

  const onLoadTree = (e: FormEvent) => {
    e.preventDefault();
    if (!treeUserId.trim()) return;
    setTreeQuery(treeUserId.trim());
    setTreeModalOpen(true);
  };

  const onRunMonthly = async (e: FormEvent) => {
    e.preventDefault();
    setMonthlyOk("");
    setMonthlyError("");
    if (!yearMonth) {
      setMonthlyError(t("admin.mlm.yearMonthRequired"));
      return;
    }
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(yearMonth)) {
      setMonthlyError(t("admin.mlm.yearMonthInvalid"));
      return;
    }
    if (!canRunSelected) {
      setMonthlyError(t("admin.mlm.yearMonthNoVolume"));
      return;
    }
    try {
      const res = await runMonthly.mutateAsync({ yearMonth });
      const periodStart = res.periodStart
        ? new Date(res.periodStart).toISOString().slice(0, 10)
        : "";
      const periodEnd = res.periodEnd
        ? new Date(res.periodEnd).toISOString().slice(0, 10)
        : "";
      setMonthlyOk(
        t("admin.mlm.runMonthlyDone", {
          yearMonth: res.yearMonth || yearMonth,
          timezone: res.timezone || "GMT+8",
          periodStart,
          periodEnd,
          batchId: res.batchId || "—",
          status: res.status || "",
        }),
      );
    } catch {
      /* toast from hook */
    }
  };

  return (
    <>
      <AdminPageHeader
        title={t("admin.mlm.title")}
        description={t("admin.mlm.description")}
      />

      <div className="space-y-6 w-full">
        <p className="text-sm text-mq-text-muted">{t("admin.mlm.hint")}</p>

        {canMutateConfig ? (
          <>
          <section className="space-y-2">
            <h2 className="text-base font-medium">{t("admin.mlm.ranksTitle")}</h2>
            {isLoading ? <AdminCardListSkeleton count={2} /> : null}
            {isError ? (
              <div className="mq-alert mq-alert-error">
                {getErrorMessage(error, t("admin.common.failed"))}
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
                      <th className="px-3 py-2 font-medium w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {(ranks ?? []).map((r) => (
                      <tr
                        key={r.rank}
                        className="border-b border-mq-border last:border-0 hover:bg-mq-surface-subtle/60"
                      >
                        <td className="px-3 py-1.5 font-semibold text-mq-text">{r.rank}</td>
                        <td className="px-3 py-1.5 text-mq-text">{mlmRankLabel(t, r.rank, r.name, { nameI18n: r.nameI18n, locale })}</td>
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
                              ? t("admin.mlm.rankActive")
                              : t("admin.mlm.rankInactive")}
                          </span>
                        </td>
                        <td className="px-3 py-1.5">
                          <button
                            type="button"
                            className="text-mq-text-muted hover:text-mq-text cursor-pointer"
                            title={t("admin.common.edit")}
                            onClick={() => {
                              setEditingRank(r);
                              setEditForm({
                                name: r.name,
                                nameVi: r.nameI18n?.vi ?? "",
                                nameEn: r.nameI18n?.en ?? "",
                                nameZhTw: r.nameI18n?.["zh-TW"] ?? "",
                                teamPercent: String(r.teamPercent),
                                referralPercent: String(r.referralPercent),
                                globalFundTier: r.globalFundTier != null ? String(r.globalFundTier) : "",
                                isActive: r.isActive,
                              });
                            }}
                          >
                            <Pencil size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {editingRank ? (
              <div className="mq-card p-4 border-l-4 border-[#e7ba0a] space-y-3">
                <h3 className="text-sm font-medium">
                  {t("admin.common.edit")} Rank {editingRank.rank}: {editingRank.name}
                </h3>
                <form
                  className="grid sm:grid-cols-2 gap-3"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const body: Record<string, unknown> = {};
                    if (editForm.name !== editingRank.name) body.name = editForm.name;
                    // Build nameI18n from individual locale fields
                    const newI18n: Record<string, string> = {};
                    if (editForm.nameVi.trim()) newI18n.vi = editForm.nameVi.trim();
                    if (editForm.nameEn.trim()) newI18n.en = editForm.nameEn.trim();
                    if (editForm.nameZhTw.trim()) newI18n["zh-TW"] = editForm.nameZhTw.trim();
                    const oldI18n = editingRank.nameI18n ?? {};
                    if (JSON.stringify(newI18n) !== JSON.stringify(oldI18n)) body.nameI18n = newI18n;
                    const tp = Number(editForm.teamPercent);
                    if (Number.isFinite(tp) && String(tp) !== String(editingRank.teamPercent)) body.teamPercent = tp;
                    const rp = Number(editForm.referralPercent);
                    if (Number.isFinite(rp) && String(rp) !== String(editingRank.referralPercent)) body.referralPercent = rp;
                    const gf = editForm.globalFundTier.trim() === "" ? null : Number(editForm.globalFundTier);
                    if (gf !== editingRank.globalFundTier) body.globalFundTier = gf;
                    if (editForm.isActive !== editingRank.isActive) body.isActive = editForm.isActive;
                    if (Object.keys(body).length === 0) { setEditingRank(null); return; }
                    const boundErr = validateRankConfigInput({
                      teamPercent: body.teamPercent !== undefined ? Number(body.teamPercent) : undefined,
                      referralPercent:
                        body.referralPercent !== undefined ? Number(body.referralPercent) : undefined,
                      globalFundTier:
                        body.globalFundTier !== undefined
                          ? (body.globalFundTier as number | null)
                          : undefined,
                    });
                    if (boundErr) {
                      if (boundErr === "teamPercent") toast.error(t("admin.mlm.teamPercentInvalid"));
                      else if (boundErr === "referralPercent") toast.error(t("admin.mlm.referralPercentInvalid"));
                      else toast.error(t("admin.mlm.globalTierInvalid"));
                      return;
                    }
                    await updateRankConfig.mutateAsync({ rank: editingRank.rank, body });
                    setEditingRank(null);
                  }}
                >
                  <label className="block text-xs space-y-1">
                    <span className="text-mq-text-muted">{t("admin.mlm.rankName")}</span>
                    <input
                      className="mq-input"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    />
                  </label>
                  <label className="block text-xs space-y-1">
                    <span className="text-mq-text-muted">🇻🇳 Tiếng Việt</span>
                    <input
                      className="mq-input"
                      value={editForm.nameVi}
                      onChange={(e) => setEditForm({ ...editForm, nameVi: e.target.value })}
                      placeholder={editForm.name}
                    />
                  </label>
                  <label className="block text-xs space-y-1">
                    <span className="text-mq-text-muted">🇬🇧 English</span>
                    <input
                      className="mq-input"
                      value={editForm.nameEn}
                      onChange={(e) => setEditForm({ ...editForm, nameEn: e.target.value })}
                    />
                  </label>
                  <label className="block text-xs space-y-1">
                    <span className="text-mq-text-muted">🇹🇼 繁體中文</span>
                    <input
                      className="mq-input"
                      value={editForm.nameZhTw}
                      onChange={(e) => setEditForm({ ...editForm, nameZhTw: e.target.value })}
                    />
                  </label>
                  <label className="block text-xs space-y-1">
                    <span className="text-mq-text-muted">{t("admin.mlm.team")} %</span>
                    <input
                      className="mq-input"
                      type="number"
                      step="0.01"
                      min={MLM_TEAM_PERCENT_MIN}
                      max={MLM_TEAM_PERCENT_MAX}
                      value={editForm.teamPercent}
                      onChange={(e) => setEditForm({ ...editForm, teamPercent: e.target.value })}
                    />
                  </label>
                  <label className="block text-xs space-y-1">
                    <span className="text-mq-text-muted">{t("admin.mlm.referral")} %</span>
                    <input
                      className="mq-input"
                      type="number"
                      step="0.01"
                      min={MLM_REFERRAL_PERCENT_MIN}
                      max={MLM_REFERRAL_PERCENT_MAX}
                      value={editForm.referralPercent}
                      onChange={(e) => setEditForm({ ...editForm, referralPercent: e.target.value })}
                    />
                  </label>
                  <label className="block text-xs space-y-1">
                    <span className="text-mq-text-muted">{t("admin.mlm.globalTier")}</span>
                    <input
                      className="mq-input"
                      type="number"
                      step="1"
                      min={MLM_GLOBAL_TIER_MIN}
                      max={MLM_GLOBAL_TIER_MAX}
                      value={editForm.globalFundTier}
                      onChange={(e) => setEditForm({ ...editForm, globalFundTier: e.target.value })}
                      placeholder="—"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-xs sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={editForm.isActive}
                      onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                      className="accent-[#e7ba0a]"
                    />
                    <span>{t("admin.mlm.rankActive")}</span>
                  </label>
                  <div className="sm:col-span-2 flex gap-2">
                    <button
                      type="submit"
                      className="mq-btn mq-btn-primary text-xs"
                      disabled={updateRankConfig.isPending}
                    >
                      {updateRankConfig.isPending ? t("admin.common.saving") : t("admin.common.save")}
                    </button>
                    <button
                      type="button"
                      className="mq-btn mq-btn-outline text-xs"
                      onClick={() => setEditingRank(null)}
                    >
                      {t("admin.common.cancel")}
                    </button>
                  </div>
                </form>
              </div>
            ) : null}
            <MlmCreateRankSection />
          </section>

          <MlmPromotionRulesSection />
          </>
        ) : (
          <div className="mq-alert mq-alert-error text-sm">
            {t("admin.mlm.noConfigPerm")}
          </div>
        )}

        {canApproveSettlement ? (
          <section className="mq-card p-5 space-y-4">
            <div className="mq-alert mq-alert-warning text-sm">
              {t("admin.mlm.payoutHoldBanner")}
            </div>
            <div>
              <h2 className="text-base font-medium">{t("admin.mlm.runMonthlyTitle")}</h2>
              <p className="text-sm text-mq-text-muted mt-1">
                {t("admin.mlm.runMonthlyHint")}
              </p>
            </div>

            {monthlyIsError ? (
              <div className="mq-alert mq-alert-error">
                {getErrorMessage(monthlyErr, t("admin.common.failed"))}
              </div>
            ) : null}
            {monthlyError ? (
              <div className="mq-alert mq-alert-error">{monthlyError}</div>
            ) : null}
            {monthlyOk ? (
              <div className="mq-alert mq-alert-success">{monthlyOk}</div>
            ) : null}

            {monthlyLoading ? (
              <AdminCardListSkeleton count={3} />
            ) : months.length === 0 ? (
              <p className="text-sm text-mq-text-muted">
                {t("admin.mlm.overviewEmpty")}
              </p>
            ) : (
              <div className="mq-table-wrap overflow-x-auto">
                <table className="w-full text-xs tabular-nums">
                  <thead>
                    <tr className="border-b border-mq-border bg-mq-surface-subtle text-left text-mq-text-muted">
                      <th className="px-3 py-2 font-medium w-10" />
                      <th className="px-3 py-2 font-medium">
                        {t("admin.mlm.yearMonth")}
                      </th>
                      <th className="px-3 py-2 font-medium text-right">
                        {t("admin.mlm.gmv")}
                      </th>
                      <th className="px-3 py-2 font-medium text-right">
                        {t("admin.mlm.orders")}
                      </th>
                      <th className="px-3 py-2 font-medium text-right">
                        {t("admin.mlm.globalFund")}
                      </th>
                      <th className="px-3 py-2 font-medium">
                        {t("admin.mlm.credited")}
                      </th>
                      <th className="px-3 py-2 font-medium">
                        {t("admin.mlm.suggestedAction")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {months.map((m) => {
                      const disabled = m.suggestedAction === "NO_VOLUME";
                      const expanded = expandedMonth === m.yearMonth;
                      const fund = m.globalFund;
                      return (
                        <Fragment key={m.yearMonth}>
                          <tr
                            className={`border-b border-mq-border ${
                              yearMonth === m.yearMonth
                                ? "bg-mq-surface-subtle/80"
                                : "hover:bg-mq-surface-subtle/60"
                            } ${disabled ? "opacity-50" : "cursor-pointer"}`}
                            onClick={() => {
                              if (!disabled) setYearMonth(m.yearMonth);
                            }}
                          >
                            <td className="px-3 py-2">
                              <input
                                type="radio"
                                name="monthly-yearMonth"
                                className="accent-mq-text"
                                checked={yearMonth === m.yearMonth}
                                disabled={disabled}
                                onChange={() => setYearMonth(m.yearMonth)}
                                aria-label={m.yearMonth}
                              />
                            </td>
                            <td className="px-3 py-2 font-semibold text-mq-text">
                              <span className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  className="mq-icon-btn !p-0.5"
                                  aria-expanded={expanded}
                                  aria-label={t("admin.mlm.toggleGlobalFund")}
                                  disabled={!fund}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedMonth((cur) =>
                                      cur === m.yearMonth ? null : m.yearMonth,
                                    );
                                  }}
                                >
                                  {expanded ? (
                                    <ChevronDown size={14} strokeWidth={1.5} />
                                  ) : (
                                    <ChevronRight size={14} strokeWidth={1.5} />
                                  )}
                                </button>
                                {m.yearMonth}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right text-mq-text">
                              {formatMoney(m.gmv)}
                            </td>
                            <td className="px-3 py-2 text-right text-mq-text-muted">
                              {m.deliveredOrderCount}
                            </td>
                            <td className="px-3 py-2 text-right text-mq-text-muted">
                              <span className="block">{formatMoney(poolPerTier(m))}</span>
                              {fund ? (
                                <span className="block text-[10px] text-mq-text-muted">
                                  {t("admin.mlm.paidKeptShort", {
                                    paid: formatMoney(fund.totalPaidToUsers),
                                    kept: formatMoney(fund.totalCompanyKept),
                                  })}
                                </span>
                              ) : null}
                            </td>
                            <td className="px-3 py-2 text-mq-text-muted whitespace-nowrap">
                              {creditedSummary(m, t)}
                            </td>
                            <td className="px-3 py-2">
                              <span className={suggestedBadge(m.suggestedAction)}>
                                {t(`admin.mlm.action.${m.suggestedAction}`)}
                              </span>
                            </td>
                          </tr>
                          {expanded && fund ? (
                            <tr className="border-b border-mq-border">
                              <td colSpan={7} className="p-0">
                                <GlobalFundDetail fund={fund} t={t} />
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <form
              className="flex flex-wrap gap-3 items-center justify-between border-t border-mq-border pt-4"
              onSubmit={(e) => void onRunMonthly(e)}
            >
              <p className="text-sm text-mq-text-muted">
                {yearMonth
                  ? t("admin.mlm.selectedMonth", { yearMonth })
                  : t("admin.mlm.selectMonth")}
                {selectedMonth?.suggestedAction === "RE_RUN_IDEMPOTENT"
                  ? ` · ${t("admin.mlm.reRunSafe")}`
                  : null}
              </p>
              <button
                type="submit"
                className="mq-btn mq-btn-primary text-sm"
                disabled={runMonthly.isPending || !canRunSelected}
              >
                {runMonthly.isPending
                  ? t("admin.common.saving")
                  : t("admin.mlm.runMonthly")}
              </button>
            </form>
          </section>
        ) : null}

        {canMutateConfig ? (
          <section className="mq-card p-5 space-y-4">
            <div>
              <h2 className="text-base font-medium">{t("admin.mlm.reconcileTitle")}</h2>
              <p className="text-sm text-mq-text-muted mt-1">
                {t("admin.mlm.reconcileHint")}
              </p>
            </div>
            {reconcileError ? (
              <div className="mq-alert mq-alert-error">{reconcileError}</div>
            ) : null}
            {reconcileOk ? (
              <div className="mq-alert mq-alert-success">{reconcileOk}</div>
            ) : null}

            <form
              className="flex flex-wrap gap-3 items-end"
              onSubmit={(e) => void onReconcileUser(e)}
            >
              <label className="flex flex-col gap-1 text-sm min-w-0 flex-1 max-w-md">
                <span className="text-xs text-mq-text-muted">
                  {t("admin.mlm.reconcileOneUser")}
                </span>
                <SearchableSelect
                  options={userOptions}
                  value={reconcileUserId}
                  aria-label={t("admin.mlm.searchUser")}
                  placeholder={t("admin.mlm.searchUserPh")}
                  searchPlaceholder={t("admin.mlm.searchUserPh")}
                  onChange={setReconcileUserId}
                />
              </label>
              <button
                type="submit"
                className="mq-btn mq-btn-primary text-sm"
                disabled={reconcileRanks.isPending || !reconcileUserId}
              >
                {reconcileRanks.isPending
                  ? t("admin.common.saving")
                  : t("admin.mlm.reconcileUser")}
              </button>
            </form>

            <div className="flex flex-wrap gap-3 items-end border-t border-mq-border pt-4">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-mq-text-muted">
                  {t("admin.mlm.reconcileBatchLimit")}
                </span>
                <input
                  className="mq-input !w-[6rem]"
                  value={reconcileLimit}
                  onChange={(e) => setReconcileLimit(e.target.value)}
                  inputMode="numeric"
                />
              </label>
              <button
                type="button"
                className="mq-btn mq-btn-outline text-sm"
                disabled={reconcileRanks.isPending}
                onClick={() => void onReconcileBatch()}
              >
                {reconcileRanks.isPending
                  ? t("admin.common.saving")
                  : t("admin.mlm.reconcileBatch")}
              </button>
            </div>
          </section>
        ) : null}

        <div
          className={`grid gap-4 items-start ${
            canMutateConfig && canViewTree ? "lg:grid-cols-2" : "grid-cols-1"
          }`}
        >
          {canMutateConfig ? (
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
                        <span className="mq-badge mq-badge-muted mr-1">
                          {t("admin.mlm.rateOverrideDeprecated")}
                        </span>
                        {t("wallet.referralRateOverride")}:{" "}
                        {selectedUser.referralRateOverride}%{" "}
                        ({t("admin.mlm.rateOverrideIgnored")})
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-3 items-end">
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-xs text-mq-text-muted">{t("wallet.rank")}</span>
                    <select
                      className="mq-input !w-[10rem] max-w-full"
                      value={rank}
                      onChange={(e) => setRankValue(e.target.value)}
                    >
                      {Array.from({ length: 11 }, (_, i) => i).map((n) => (
                        <option key={n} value={n}>
                          {n === 0 ? `0 (${t("wallet.rankSeller")})` : n}
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
                  {getErrorMessage(treeErr, t("admin.common.failed"))}
                </div>
              ) : null}
            </section>
          ) : null}
        </div>

        {/* Tree Modal */}
        {treeModalOpen && (
          <div className="mq-admin-modal-root" role="presentation">
            <button
              type="button"
              className="mq-admin-modal-backdrop"
              aria-label="Close"
              onClick={() => setTreeModalOpen(false)}
            />
            <div
              className="relative z-[1] w-[95vw] max-w-[1400px] h-[90vh] rounded-2xl border border-mq-border bg-mq-surface shadow-lg flex flex-col overflow-hidden"
              role="dialog"
              aria-modal="true"
            >
              {/* Modal header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-mq-border bg-mq-surface-elevated shrink-0">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-mq-text truncate">
                    {t("admin.mlm.treeTitle")} — {treeUser?.fullName || treeUser?.email || treeQuery}
                  </h2>
                  {tree ? (
                    <div className="flex flex-wrap gap-2 text-xs mt-1">
                      <span className="mq-badge mq-badge-muted">
                        Upline: {tree.totalUpline}
                      </span>
                      <span className="mq-badge mq-badge-muted">
                        {t("wallet.networkTotal")}: {tree.totalDownline}
                      </span>
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="shrink-0 p-2 rounded-lg hover:bg-mq-surface-subtle text-mq-text-muted hover:text-mq-text transition-colors"
                  onClick={() => setTreeModalOpen(false)}
                  aria-label="Close"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Modal body */}
              <div className="flex-1 min-h-0 p-4">
                {treeLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-sm text-mq-text-muted">{t("wallet.loading")}</p>
                  </div>
                ) : treeError ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="mq-alert mq-alert-error break-words">
                      {getErrorMessage(treeErr, t("admin.common.failed"))}
                    </div>
                  </div>
                ) : tree ? (
                  <div className="w-full h-full">
                    <NetworkTreeFlow
                      nodes={tree.nodes}
                      rootUserId={tree.focusUserId}
                      expandAll
                      className="w-full h-full rounded-xl overflow-hidden bg-mq-surface-subtle"
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {canMutateConfig ? (
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
              <div className="space-y-3">
                <label className="block text-sm min-w-0">
                  <span className="text-xs text-mq-text-muted">{t("admin.mlm.searchUser")}</span>
                  <div className="mt-1">
                    <SearchableSelect
                      options={userOptions}
                      value={legacyRateUserId}
                      aria-label={t("admin.mlm.searchUser")}
                      placeholder={t("admin.mlm.searchUserPh")}
                      searchPlaceholder={t("admin.mlm.searchUserPh")}
                      onChange={setLegacyRateUserId}
                    />
                  </div>
                </label>
                {legacyRateTarget ? (
                  <div className="rounded-md border border-mq-border bg-mq-surface-subtle px-3 py-2 text-xs space-y-1">
                    <p className="truncate font-medium">
                      {legacyRateTarget.fullName || legacyRateTarget.email}
                    </p>
                    <p className="text-mq-text-muted">
                      {t("wallet.referralRateOverride")}:{" "}
                      {legacyRateTarget.referralRateOverride != null &&
                      legacyRateTarget.referralRateOverride !== ""
                        ? `${legacyRateTarget.referralRateOverride}%`
                        : t("admin.mlm.rateDefault")}
                    </p>
                    <p>
                      <span className="mq-badge mq-badge-muted">
                        {t("admin.mlm.rateOverrideDeprecated")}
                      </span>{" "}
                      <span className="text-mq-text-muted">
                        {t("admin.mlm.rateOverrideIgnored")}
                      </span>
                    </p>
                  </div>
                ) : null}
              </div>
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
