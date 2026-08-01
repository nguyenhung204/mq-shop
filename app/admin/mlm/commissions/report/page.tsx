"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { useCommissionReport } from "@/lib/queries/wallet";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { AdminCardListSkeleton } from "@/components/ui/Skeleton";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { formatMoney, formatPercent } from "@/lib/api/utils";
import { mlmRankLabel } from "@/lib/i18n/mlm-rank";
import { getErrorMessage } from "@/lib/queries/utils";
import type {
  CommissionReportBatchStatus,
  CommissionTypeSummary,
  GenericCommissionEntry,
  GlobalFundTierReport,
  GlobalFundTierStatus,
  ReferralCommissionEntry,
  TeamCommissionEntry,
} from "@/lib/api/mlm";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function batchBadge(status: CommissionReportBatchStatus): string {
  if (status === "COMPLETED") return "mq-badge mq-badge-teal";
  if (status === "FAILED") return "mq-badge mq-badge-pink";
  if (status === "RUNNING") return "mq-badge mq-badge-cyan";
  return "mq-badge mq-badge-muted";
}

function tierStatusBadge(status: GlobalFundTierStatus): string {
  if (status === "PAID") return "mq-badge mq-badge-teal";
  if (status === "COMPANY_KEPT") return "mq-badge mq-badge-orange";
  return "mq-badge mq-badge-muted";
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Thin horizontal rule used in the reconciliation flow arrows */
function FlowArrow({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 text-mq-text-muted text-[11px]">
      <span className="text-mq-text font-semibold tabular-nums">{label}</span>
      <span>↓</span>
    </div>
  );
}

/** Collapsible section card */
function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mq-card overflow-hidden">
      <div className="px-4 py-3 border-b border-mq-border bg-mq-surface-subtle">
        <h2 className="text-sm font-semibold text-mq-text">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

/** Generic table wrapper */
function AdminTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="mq-table-wrap overflow-x-auto border border-mq-border rounded-[var(--mq-radius-sm)] bg-mq-surface">
      <table className="w-full text-xs tabular-nums">{children}</table>
    </div>
  );
}

function Th({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={`px-3 py-2 font-medium text-mq-text-muted whitespace-nowrap${right ? " text-right" : ""}`}
    >
      {children}
    </th>
  );
}

function Td({ children, right, muted }: { children: React.ReactNode; right?: boolean; muted?: boolean }) {
  return (
    <td
      className={`px-3 py-2 align-top${right ? " text-right" : ""}${muted ? " text-mq-text-muted" : " text-mq-text"}`}
    >
      {children}
    </td>
  );
}

// ─── Referral section ────────────────────────────────────────────────────────

function ReferralSection({
  summary,
}: {
  summary: CommissionTypeSummary<ReferralCommissionEntry>;
}) {
  const { t } = useLanguage();
  const tr = (k: string) => t(`admin.mlm.commissionReport.${k}`);
  const [expanded, setExpanded] = useState<string | null>(null);

  if (summary.users.length === 0) {
    return <p className="text-xs text-mq-text-muted">{tr("empty")}</p>;
  }

  return (
    <AdminTable>
      <thead>
        <tr className="border-b border-mq-border bg-mq-surface-subtle text-left">
          <Th>{tr("colRecipient")}</Th>
          <Th>{tr("colRank")}</Th>
          <Th right>{tr("colTotalPayout")}</Th>
          <Th />
        </tr>
      </thead>
      <tbody>
        {summary.users.map((r) => (
          <Fragment key={r.userId}>
            <tr
              className="border-b border-mq-border last:border-0 hover:bg-mq-surface-subtle/50 cursor-pointer"
              onClick={() =>
                setExpanded((prev) => (prev === r.userId ? null : r.userId))
              }
            >
              <Td>
                <span className="font-medium">{r.fullName?.trim() || r.email}</span>
                <span className="ml-1 text-mq-text-muted text-[11px]">{r.email}</span>
              </Td>
              <Td muted>{r.rankName || mlmRankLabel(t, r.mlmRank)}</Td>
              <Td right>
                <span className="font-semibold">{formatMoney(r.totalPayout)}</span>
              </Td>
              <Td>
                {expanded === r.userId ? (
                  <ChevronDown size={14} className="text-mq-text-muted" />
                ) : (
                  <ChevronRight size={14} className="text-mq-text-muted" />
                )}
              </Td>
            </tr>

            {expanded === r.userId && (
              <tr key={`${r.userId}-detail`} className="border-b border-mq-border bg-mq-surface-subtle/40">
                <td colSpan={4} className="p-3 space-y-2">
                  <div className="text-xs space-y-0.5">
                    <p className="text-mq-text-muted font-medium">{tr("referrerLabel")}</p>
                    <p className="font-semibold">{r.fullName?.trim() || r.email}</p>
                  </div>
                  <AdminTable>
                    <thead>
                      <tr className="border-b border-mq-border bg-mq-surface-subtle text-left">
                        <Th>{tr("colBuyer")}</Th>
                        <Th>{tr("colOrder")}</Th>
                        <Th right>{tr("colOrderTotal")}</Th>
                        <Th>{tr("colDeliveredAt")}</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.entries.map((e, i) => (
                        <tr
                          key={`${r.userId}-${e.orderCode}-${i}`}
                          className="border-b border-mq-border last:border-0"
                        >
                          <Td muted>{e.buyerEmail}</Td>
                          <Td>
                            <Link
                              href={`/admin/orders?q=${e.orderCode}`}
                              className="inline-flex items-center gap-1 text-mq-accent hover:underline"
                            >
                              {e.orderCode}
                              <ExternalLink size={10} />
                            </Link>
                          </Td>
                          <Td right>{formatMoney(e.orderTotal)}</Td>
                          <Td muted>{fmtDate(e.deliveredAt)}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </AdminTable>
                </td>
              </tr>
            )}
          </Fragment>
        ))}
      </tbody>
    </AdminTable>
  );
}

// ─── Team section ─────────────────────────────────────────────────────────────

function TeamSection({
  summary,
}: {
  summary: CommissionTypeSummary<TeamCommissionEntry>;
}) {
  const { t } = useLanguage();
  const tr = (k: string) => t(`admin.mlm.commissionReport.${k}`);
  const [expanded, setExpanded] = useState<string | null>(null);

  if (summary.users.length === 0) {
    return <p className="text-xs text-mq-text-muted">{tr("empty")}</p>;
  }

  return (
    <AdminTable>
      <thead>
        <tr className="border-b border-mq-border bg-mq-surface-subtle text-left">
          <Th>{tr("colRecipient")}</Th>
          <Th>{tr("colRank")}</Th>
          <Th right>{tr("colTotalPayout")}</Th>
          <Th />
        </tr>
      </thead>
      <tbody>
        {summary.users.map((r) => (
          <Fragment key={r.userId}>
            <tr
              className="border-b border-mq-border last:border-0 hover:bg-mq-surface-subtle/50 cursor-pointer"
              onClick={() =>
                setExpanded((prev) => (prev === r.userId ? null : r.userId))
              }
            >
              <Td>
                <span className="font-medium">{r.fullName?.trim() || r.email}</span>
              </Td>
              <Td muted>{r.rankName || mlmRankLabel(t, r.mlmRank)}</Td>
              <Td right>
                <span className="font-semibold">{formatMoney(r.totalPayout)}</span>
              </Td>
              <Td>
                {expanded === r.userId ? (
                  <ChevronDown size={14} className="text-mq-text-muted" />
                ) : (
                  <ChevronRight size={14} className="text-mq-text-muted" />
                )}
              </Td>
            </tr>

            {expanded === r.userId && (
              <tr key={`${r.userId}-detail`} className="border-b border-mq-border bg-mq-surface-subtle/40">
                <td colSpan={4} className="p-3 space-y-2">
                  <AdminTable>
                    <thead>
                      <tr className="border-b border-mq-border bg-mq-surface-subtle text-left">
                        <Th>{tr("colBuyer")}</Th>
                        <Th>{tr("colOrder")}</Th>
                        <Th right>{tr("colOrderTotal")}</Th>
                        <Th right>{tr("colTeamPercent")}</Th>
                        <Th right>{tr("colMaxBelow")}</Th>
                        <Th right>{tr("colPaidPercent")}</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.entries.map((e, i) => (
                        <tr
                          key={`${r.userId}-${e.orderCode}-${i}`}
                          className="border-b border-mq-border last:border-0"
                        >
                          <Td muted>{e.buyerEmail}</Td>
                          <Td>
                            <Link
                              href={`/admin/orders?q=${e.orderCode}`}
                              className="inline-flex items-center gap-1 text-mq-accent hover:underline"
                            >
                              {e.orderCode}
                              <ExternalLink size={10} />
                            </Link>
                          </Td>
                          <Td right>{formatMoney(e.orderTotal)}</Td>
                          <Td right muted>{formatPercent(e.teamPercent)}</Td>
                          <Td right muted>{formatPercent(e.maxBelow)}</Td>
                          <Td right>
                            <span className="font-semibold text-mq-accent">
                              {formatPercent(e.paidPercent)}
                            </span>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </AdminTable>
                  <p className="text-[11px] text-mq-text-muted">
                    Paid % = Team % − Max Below (differential commission)
                  </p>

                  {/* Chain audit for first expanded entry */}
                  {r.entries[0]?.chainNodes && r.entries[0].chainNodes.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-[11px] font-medium text-mq-text-muted">Chain</p>
                      <div className="flex flex-col gap-0 text-[11px]">
                        {r.entries[0].chainNodes.map((n, ni) => (
                          <div key={n.userId} className="flex items-center gap-1">
                            {ni > 0 && <span className="text-mq-text-muted">↓</span>}
                            <span className={n.userId === r.userId ? "font-bold text-mq-text" : "text-mq-text-muted"}>
                              {n.rankName} ({formatPercent(n.percent)})
                              {n.userId === r.userId ? " ← you" : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </td>
              </tr>
            )}
          </Fragment>
        ))}
      </tbody>
    </AdminTable>
  );
}

// ─── Global section ───────────────────────────────────────────────────────────

function GlobalSection({
  tiers,
}: {
  tiers: GlobalFundTierReport[];
}) {
  const { t } = useLanguage();
  const tr = (k: string) => t(`admin.mlm.commissionReport.${k}`);
  const [expandedTier, setExpandedTier] = useState<number | null>(null);

  if (tiers.length === 0) {
    return <p className="text-xs text-mq-text-muted">{tr("empty")}</p>;
  }

  return (
    <AdminTable>
      <thead>
        <tr className="border-b border-mq-border bg-mq-surface-subtle text-left">
          <Th>{tr("colTier")}</Th>
          <Th right>{tr("colPool")}</Th>
          <Th right>{tr("colEligible")}</Th>
          <Th right>{tr("colPaid")}</Th>
          <Th right>{tr("colCompanyKept")}</Th>
          <Th>{tr("colStatus")}</Th>
          <Th />
        </tr>
      </thead>
      <tbody>
        {tiers.map((tier) => (
          <Fragment key={tier.tier}>
            <tr
              className="border-b border-mq-border last:border-0 hover:bg-mq-surface-subtle/50 cursor-pointer"
              onClick={() =>
                setExpandedTier((prev) => (prev === tier.tier ? null : tier.tier))
              }
            >
              <Td><span className="font-semibold">Tier {tier.tier}</span></Td>
              <Td right>{formatMoney(tier.poolAmount)}</Td>
              <Td right muted>{tier.eligibleCount}</Td>
              <Td right>{formatMoney(tier.paidTotal)}</Td>
              <Td right muted>{formatMoney(tier.companyKept)}</Td>
              <Td>
                <span className={tierStatusBadge(tier.status)}>
                  {t(`admin.mlm.tierStatus.${tier.status}`)}
                </span>
              </Td>
              <Td>
                {expandedTier === tier.tier ? (
                  <ChevronDown size={14} className="text-mq-text-muted" />
                ) : (
                  <ChevronRight size={14} className="text-mq-text-muted" />
                )}
              </Td>
            </tr>

            {expandedTier === tier.tier && (
              <tr key={`tier-${tier.tier}-detail`} className="border-b border-mq-border bg-mq-surface-subtle/40">
                <td colSpan={7} className="p-3">
                  {tier.users.length === 0 ? (
                    <div className="space-y-1 text-xs">
                      <p className="text-mq-text-muted">{tr("tierEmpty")}</p>
                      <p>
                        <span className="text-mq-text-muted">{t("admin.mlm.companyKept")}: </span>
                        <span className="font-semibold">{formatMoney(tier.companyKept)}</span>
                      </p>
                    </div>
                  ) : (
                    <AdminTable>
                      <thead>
                        <tr className="border-b border-mq-border bg-mq-surface-subtle text-left">
                          <Th>{tr("colRecipient")}</Th>
                          <Th>{tr("colRank")}</Th>
                          <Th right>{tr("colPaid")}</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {tier.users.map((u) => (
                          <tr key={u.userId} className="border-b border-mq-border last:border-0">
                            <Td>
                              <span className="font-medium">{u.fullName?.trim() || u.email}</span>
                              <span className="ml-1 text-mq-text-muted text-[11px]">{u.email}</span>
                            </Td>
                            <Td muted>{u.rankName || mlmRankLabel(t, u.mlmRank)}</Td>
                            <Td right>
                              <span className="font-semibold">{formatMoney(u.totalPayout)}</span>
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </AdminTable>
                  )}
                </td>
              </tr>
            )}
          </Fragment>
        ))}
      </tbody>
    </AdminTable>
  );
}

// ─── Loyalty section ──────────────────────────────────────────────────────────

function LoyaltySection({
  summary,
}: {
  summary: CommissionTypeSummary<GenericCommissionEntry>;
}) {
  const { t } = useLanguage();
  const tr = (k: string) => t(`admin.mlm.commissionReport.${k}`);
  const [expanded, setExpanded] = useState<string | null>(null);

  if (summary.users.length === 0) {
    return <p className="text-xs text-mq-text-muted">{tr("empty")}</p>;
  }

  return (
    <AdminTable>
      <thead>
        <tr className="border-b border-mq-border bg-mq-surface-subtle text-left">
          <Th>{tr("colRecipient")}</Th>
          <Th>{tr("colRank")}</Th>
          <Th right>{tr("colPaid")}</Th>
          <Th />
        </tr>
      </thead>
      <tbody>
        {summary.users.map((r) => {
          const consecutiveMonths = r.entries[0]?.meta?.consecutiveMonths as
            | number
            | undefined;
          return (
            <Fragment key={r.userId}>
              <tr
                className="border-b border-mq-border last:border-0 hover:bg-mq-surface-subtle/50 cursor-pointer"
                onClick={() =>
                  setExpanded((prev) => (prev === r.userId ? null : r.userId))
                }
              >
                <Td>
                  <span className="font-medium">{r.fullName?.trim() || r.email}</span>
                  <span className="ml-1 text-mq-text-muted text-[11px]">{r.email}</span>
                </Td>
                <Td muted>{r.rankName || mlmRankLabel(t, r.mlmRank)}</Td>
                <Td right>
                  <span className="font-semibold">{formatMoney(r.totalPayout)}</span>
                </Td>
                <Td>
                  {expanded === r.userId ? (
                    <ChevronDown size={14} className="text-mq-text-muted" />
                  ) : (
                    <ChevronRight size={14} className="text-mq-text-muted" />
                  )}
                </Td>
              </tr>

              {expanded === r.userId && (
                <tr key={`loyalty-${r.userId}-detail`} className="border-b border-mq-border bg-mq-surface-subtle/40">
                  <td colSpan={4} className="p-3 space-y-2 text-xs">
                    {consecutiveMonths !== undefined && (
                      <p className="text-mq-text-muted">
                        {tr("loyaltyHistoryTitle")}:{" "}
                        <span className="font-semibold text-mq-text">{consecutiveMonths}</span>
                      </p>
                    )}
                    {r.entries.length > 0 && (
                      <AdminTable>
                        <thead>
                          <tr className="border-b border-mq-border bg-mq-surface-subtle text-left">
                            <Th>{tr("colOrder")}</Th>
                            <Th right>{tr("colOrderTotal")}</Th>
                            <Th right>{tr("colCommission")}</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {r.entries.map((e, i) => (
                            <tr key={`${r.userId}-loyalty-${i}`} className="border-b border-mq-border last:border-0">
                              <Td muted>{e.orderCode ?? "—"}</Td>
                              <Td right>{formatMoney(e.orderTotal ?? "0")}</Td>
                              <Td right>
                                <span className="font-semibold">{formatMoney(e.commissionAmount ?? "0")}</span>
                              </Td>
                            </tr>
                          ))}
                        </tbody>
                      </AdminTable>
                    )}
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </AdminTable>
  );
}

// ─── Commission type cards ────────────────────────────────────────────────────

type CommissionSection = "referral" | "team" | "global" | "loyalty";

function CommissionCards({
  referralCount,
  referralPayout,
  teamCount,
  teamPayout,
  globalCount,
  globalPayout,
  loyaltyCount,
  loyaltyPayout,
  active,
  onToggle,
  t,
}: {
  referralCount: number;
  referralPayout: string;
  teamCount: number;
  teamPayout: string;
  globalCount: number;
  globalPayout: string;
  loyaltyCount: number;
  loyaltyPayout: string;
  active: CommissionSection | null;
  onToggle: (s: CommissionSection) => void;
  t: (key: string, vars?: Record<string, string>) => string;
}) {
  const tr = (k: string) => t(`admin.mlm.commissionReport.${k}`);

  const cards: { key: CommissionSection; count: number; payout: string }[] = [
    { key: "referral", count: referralCount, payout: referralPayout },
    { key: "team", count: teamCount, payout: teamPayout },
    { key: "global", count: globalCount, payout: globalPayout },
    { key: "loyalty", count: loyaltyCount, payout: loyaltyPayout },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => onToggle(c.key)}
          className={`mq-card p-4 text-left space-y-1 transition-colors hover:bg-mq-surface-subtle ${active === c.key ? "ring-2 ring-mq-accent" : ""}`}
        >
          <p className="text-xs font-semibold text-mq-text">{tr(c.key)}</p>
          <p className="text-mq-text-muted text-[11px]">
            {tr("recipients").replace("{count}", String(c.count))}
          </p>
          <p className="text-base font-bold text-mq-text tabular-nums">{formatMoney(c.payout)}</p>
          <p className="text-[11px] text-mq-accent font-medium">
            {active === c.key ? tr("hideDetail") : tr("viewDetail")}
          </p>
        </button>
      ))}
    </div>
  );
}

// ─── KPI / meta row ──────────────────────────────────────────────────────────

function KpiRow({
  label,
  value,
  badge,
}: {
  label: string;
  value: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 border-b border-mq-border last:border-0 text-xs">
      <span className="text-mq-text-muted">{label}</span>
      <span className="font-semibold text-mq-text flex items-center gap-1.5">
        {value}
        {badge}
      </span>
    </div>
  );
}

// ─── Inner page ───────────────────────────────────────────────────────────────

function CommissionReportInner() {
  const { t } = useLanguage();
  const tr = (k: string) => t(`admin.mlm.commissionReport.${k}`);

  const [inputYm, setInputYm] = useState("");
  const [queryYm, setQueryYm] = useState<string | undefined>(undefined);
  const [activeSection, setActiveSection] = useState<CommissionSection | null>(null);

  const { data, isLoading, isError, error } = useCommissionReport(queryYm);

  function handleLoad() {
    const trimmed = inputYm.trim();
    setQueryYm(trimmed || undefined);
    setActiveSection(null);
  }

  function toggleSection(s: CommissionSection) {
    setActiveSection((prev) => (prev === s ? null : s));
  }

  return (
    <>
      <AdminPageHeader
        title={tr("title")}
        description={tr("description")}
        actions={
          <Link href="/admin/mlm" className="text-xs text-mq-text-muted hover:text-mq-text">
            {tr("backToMlm")}
          </Link>
        }
      />

      <div className="space-y-6 max-w-5xl">
        {/* Period picker */}
        <div className="mq-card p-4 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-mq-text-muted font-medium" htmlFor="ym-input">
              {tr("yearMonthLabel")}
            </label>
            <input
              id="ym-input"
              type="text"
              className="mq-input text-sm w-36"
              placeholder={tr("yearMonthPlaceholder")}
              value={inputYm}
              onChange={(e) => setInputYm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLoad()}
            />
          </div>
          <button type="button" className="mq-btn mq-btn-primary text-sm" onClick={handleLoad}>
            {tr("load")}
          </button>
        </div>

        {isError && (
          <div className="mq-alert mq-alert-error">
            {getErrorMessage(error, t("admin.common.failed"))}
          </div>
        )}

        {isLoading && <AdminCardListSkeleton count={4} />}

        {data?.yearMonth && (
          <>
            {/* ── Dashboard Summary ── */}
            <SectionCard title={tr("sectionDashboard")}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Left: core metrics */}
                <div className="space-y-0 divide-y divide-mq-border">
                  <KpiRow label={tr("gmv")} value={formatMoney(data.gmv)} />
                  <KpiRow label={tr("deliveredOrders")} value={(data.deliveredOrderCount ?? 0).toLocaleString()} />
                  <KpiRow label={tr("globalFundPercent")} value={`${data.globalFundPercent ?? 0}%`} />
                  <KpiRow label={tr("globalPoolPerTier")} value={formatMoney(data.globalPoolPerTier ?? "0")} />
                  <KpiRow label={tr("grandTotalPayout")} value={<span className="text-mq-accent">{formatMoney(data.grandTotalPayout ?? "0")}</span>} />
                </div>

                {/* Center: KPI extras */}
                <div className="space-y-0 divide-y divide-mq-border">
                  <KpiRow label={tr("commissionOverGmv")} value={formatPercent(data.kpi?.commissionToGmvPercent ?? "0")} />
                  <KpiRow label={tr("totalEntries")} value={(data.kpi?.totalEntries ?? 0).toLocaleString()} />
                  <KpiRow label={tr("totalRecipients")} value={(data.kpi?.totalRecipients ?? 0).toLocaleString()} />
                  <KpiRow label={tr("companyKeptTotal")} value={formatMoney(data.kpi?.companyKeptTotal ?? "0")} />
                  <KpiRow label={tr("failedEntries")} value="—" />
                </div>

                {/* Right: batch info */}
                <div className="space-y-0 divide-y divide-mq-border">
                  <KpiRow
                    label={tr("batchStatus")}
                    value={
                      <span className={batchBadge((data.kpi?.batchStatus ?? "NOT_RUN") as CommissionReportBatchStatus)}>
                        {t(`admin.mlm.commissionReport.batchStatuses.${data.kpi?.batchStatus ?? "NOT_RUN"}`)}
                      </span>
                    }
                  />
                  <KpiRow label={tr("generatedAt")} value={fmtDate(data.kpi?.generatedAt as string | null)} />
                  <KpiRow label={tr("generatedBy")} value="—" />
                </div>
              </div>
            </SectionCard>

            {/* ── Commission type cards ── */}
            <SectionCard title={tr("sectionCommissions")}>
              <div className="space-y-4">
                <CommissionCards
                  referralCount={data.referral?.recipientCount ?? 0}
                  referralPayout={data.referral?.totalPayout ?? "0"}
                  teamCount={data.team?.recipientCount ?? 0}
                  teamPayout={data.team?.totalPayout ?? "0"}
                  globalCount={data.global?.recipientCount ?? 0}
                  globalPayout={data.global?.totalPayout ?? "0"}
                  loyaltyCount={data.loyalty?.recipientCount ?? 0}
                  loyaltyPayout={data.loyalty?.totalPayout ?? "0"}
                  active={activeSection}
                  onToggle={toggleSection}
                  t={t}
                />

                {activeSection === "referral" && (
                  <ReferralSection summary={data.referral} />
                )}
                {activeSection === "team" && (
                  <TeamSection summary={data.team} />
                )}
                {activeSection === "global" && (
                  <GlobalSection tiers={data.global?.tiers ?? []} />
                )}
                {activeSection === "loyalty" && (
                  <LoyaltySection summary={data.loyalty} />
                )}
              </div>
            </SectionCard>

            {/* ── Reconciliation summary ── */}
            <SectionCard title={tr("sectionSummary")}>
              <div className="flex flex-col items-start gap-0 w-48">
                <FlowArrow label={`${tr("summaryGmv")}: ${formatMoney(data.gmv ?? "0")}`} />
                <FlowArrow label={`${tr("summaryReferral")}: ${formatMoney(data.referral?.totalPayout ?? "0")}`} />
                <FlowArrow label={`${tr("summaryTeam")}: ${formatMoney(data.team?.totalPayout ?? "0")}`} />
                <FlowArrow label={`${tr("summaryGlobal")}: ${formatMoney(data.global?.totalPayout ?? "0")}`} />
                <FlowArrow label={`${tr("summaryLoyalty")}: ${formatMoney(data.loyalty?.totalPayout ?? "0")}`} />
                <FlowArrow label={`${tr("summaryCompanyKept")}: ${formatMoney(data.kpi?.companyKeptTotal ?? "0")}`} />
                <div className="mt-2 pt-2 border-t border-mq-border w-full text-xs font-bold text-mq-text">
                  {tr("summaryGrandTotal")}: {formatMoney(data.grandTotalPayout ?? "0")}
                </div>
              </div>
            </SectionCard>
          </>
        )}

        {!isLoading && !isError && !data?.yearMonth && queryYm && (
          <div className="mq-card p-6 text-center text-sm text-mq-text-muted">{tr("empty")}</div>
        )}
      </div>
    </>
  );
}

// ─── Page export ──────────────────────────────────────────────────────────────

export default function CommissionReportPage() {
  return (
    <AuthGuard roles={["SUPER_ADMIN"]}>
      <CommissionReportInner />
    </AuthGuard>
  );
}
