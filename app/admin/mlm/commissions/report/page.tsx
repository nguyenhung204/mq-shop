"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Gift,
  Globe,
  Search,
  Users,
} from "lucide-react";
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

// ─── Badge helpers ────────────────────────────────────────────────────────────

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

// ─── Primitives ───────────────────────────────────────────────────────────────

/** Section card with sticky header */
function SectionCard({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mq-admin-panel overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-mq-border bg-mq-surface-subtle">
        <div>
          <h2 className="text-sm font-semibold text-mq-text leading-snug">{title}</h2>
          {subtitle && <p className="text-xs text-mq-text-muted mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

/** Scrollable table with sticky thead */
function ReportTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="mq-table-wrap overflow-x-auto">
      <table className="w-full text-xs tabular-nums">{children}</table>
    </div>
  );
}

function Th({
  children,
  right,
  center,
}: {
  children?: React.ReactNode;
  right?: boolean;
  center?: boolean;
}) {
  return (
    <th
      className={`px-3 py-2.5 font-semibold text-[11px] uppercase tracking-wide text-mq-text-muted whitespace-nowrap bg-mq-surface-subtle border-b border-mq-border${right ? " text-right" : center ? " text-center" : ""}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  right,
  muted,
  center,
  mono,
}: {
  children: React.ReactNode;
  right?: boolean;
  muted?: boolean;
  center?: boolean;
  mono?: boolean;
}) {
  return (
    <td
      className={`px-3 py-2.5 align-middle border-b border-mq-border${right ? " text-right" : center ? " text-center" : ""}${muted ? " text-mq-text-muted" : " text-mq-text"}${mono ? " tabular-nums font-mono text-[11px]" : ""}`}
    >
      {children}
    </td>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent,
  badge,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent?: boolean;
  badge?: React.ReactNode;
}) {
  return (
    <div className="mq-admin-panel p-4 flex flex-col gap-1 min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-mq-text-muted truncate">
        {label}
      </p>
      <p
        className={`text-xl font-bold tabular-nums leading-tight${accent ? " text-mq-accent-teal" : " text-mq-text"}`}
      >
        {value}
      </p>
      {badge && <div>{badge}</div>}
      {sub && <p className="text-[11px] text-mq-text-muted">{sub}</p>}
    </div>
  );
}

// ─── Commission type tab cards ────────────────────────────────────────────────

type CommissionSection = "referral" | "team" | "global" | "loyalty";

const SECTION_ICONS: Record<CommissionSection, React.ElementType> = {
  referral: ArrowUpRight,
  team: Users,
  global: Globe,
  loyalty: Gift,
};

function CommissionTabs({
  referralCount, referralPayout,
  teamCount, teamPayout,
  globalCount, globalPayout,
  loyaltyCount, loyaltyPayout,
  active,
  onToggle,
  t,
}: {
  referralCount: number; referralPayout: string;
  teamCount: number; teamPayout: string;
  globalCount: number; globalPayout: string;
  loyaltyCount: number; loyaltyPayout: string;
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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c) => {
        const Icon = SECTION_ICONS[c.key];
        const isActive = active === c.key;
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => onToggle(c.key)}
            className={`mq-admin-panel p-4 text-left transition-all hover:shadow-md ${isActive ? "ring-2 ring-[var(--mq-accent-teal)] shadow-md" : ""}`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${isActive ? "bg-[rgba(25,149,136,0.18)]" : "bg-mq-surface-subtle"}`}>
                <Icon size={14} className={isActive ? "text-[var(--mq-accent-teal)]" : "text-mq-text-muted"} />
              </span>
              <ChevronDown
                size={13}
                className={`text-mq-text-muted transition-transform ${isActive ? "rotate-180 text-[var(--mq-accent-teal)]" : ""}`}
              />
            </div>
            <p className="text-xs font-semibold text-mq-text leading-tight">{tr(c.key)}</p>
            <p className="text-[11px] text-mq-text-muted mt-0.5">
              {tr("recipients").replace("{count}", String(c.count))}
            </p>
            <p className="text-lg font-bold tabular-nums text-mq-text mt-1">{formatMoney(c.payout)}</p>
          </button>
        );
      })}
    </div>
  );
}

// ─── Referral section ─────────────────────────────────────────────────────────

function ReferralSection({ summary }: { summary: CommissionTypeSummary<ReferralCommissionEntry> }) {
  const { t } = useLanguage();
  const tr = (k: string) => t(`admin.mlm.commissionReport.${k}`);
  const [expanded, setExpanded] = useState<string | null>(null);

  if (summary.users.length === 0) {
    return <p className="text-xs text-mq-text-muted py-2">{tr("empty")}</p>;
  }

  return (
    <ReportTable>
      <thead>
        <tr>
          <Th>{tr("colRecipient")}</Th>
          <Th>{tr("colRank")}</Th>
          <Th right>{tr("colTotalPayout")}</Th>
          <Th center> </Th>
        </tr>
      </thead>
      <tbody>
        {summary.users.map((r) => (
          <Fragment key={r.userId}>
            <tr
              className="hover:bg-mq-surface-subtle/60 cursor-pointer"
              onClick={() => setExpanded((p) => (p === r.userId ? null : r.userId))}
            >
              <Td>
                <span className="font-medium">{r.fullName?.trim() || r.email}</span>
                <span className="block text-[11px] text-mq-text-muted">{r.email}</span>
              </Td>
              <Td muted>{r.rankName || mlmRankLabel(t, r.mlmRank)}</Td>
              <Td right>
                <span className="font-semibold text-sm">{formatMoney(r.totalPayout)}</span>
              </Td>
              <Td center>
                {expanded === r.userId
                  ? <ChevronDown size={14} className="text-mq-text-muted mx-auto" />
                  : <ChevronRight size={14} className="text-mq-text-muted mx-auto" />}
              </Td>
            </tr>
            {expanded === r.userId && (
              <tr>
                <td colSpan={4} className="p-0 border-b border-mq-border">
                  <div className="bg-mq-surface-subtle/50 px-4 py-3 space-y-3">
                    <p className="text-[11px] font-semibold text-mq-text-muted uppercase tracking-wide">
                      {tr("referrerLabel")}: <span className="text-mq-text normal-case font-medium">{r.fullName?.trim() || r.email}</span>
                    </p>
                    <ReportTable>
                      <thead>
                        <tr>
                          <Th>{tr("colBuyer")}</Th>
                          <Th>{tr("colOrder")}</Th>
                          <Th right>{tr("colOrderTotal")}</Th>
                          <Th>{tr("colDeliveredAt")}</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.entries.map((e, i) => (
                          <tr key={`${r.userId}-${e.orderCode}-${i}`} className="last:border-0">
                            <Td muted>{e.buyerEmail}</Td>
                            <Td>
                              <Link href={`/admin/orders?q=${e.orderCode}`} className="inline-flex items-center gap-1 text-[var(--mq-accent-teal)] hover:underline font-medium">
                                {e.orderCode}<ExternalLink size={10} />
                              </Link>
                            </Td>
                            <Td right>{formatMoney(e.orderTotal)}</Td>
                            <Td muted>{fmtDate(e.deliveredAt)}</Td>
                          </tr>
                        ))}
                      </tbody>
                    </ReportTable>
                  </div>
                </td>
              </tr>
            )}
          </Fragment>
        ))}
      </tbody>
    </ReportTable>
  );
}

// ─── Team section ─────────────────────────────────────────────────────────────

function TeamSection({ summary }: { summary: CommissionTypeSummary<TeamCommissionEntry> }) {
  const { t } = useLanguage();
  const tr = (k: string) => t(`admin.mlm.commissionReport.${k}`);
  const [expanded, setExpanded] = useState<string | null>(null);

  if (summary.users.length === 0) {
    return <p className="text-xs text-mq-text-muted py-2">{tr("empty")}</p>;
  }

  return (
    <ReportTable>
      <thead>
        <tr>
          <Th>{tr("colRecipient")}</Th>
          <Th>{tr("colRank")}</Th>
          <Th right>{tr("colTotalPayout")}</Th>
          <Th center> </Th>
        </tr>
      </thead>
      <tbody>
        {summary.users.map((r) => (
          <Fragment key={r.userId}>
            <tr
              className="hover:bg-mq-surface-subtle/60 cursor-pointer"
              onClick={() => setExpanded((p) => (p === r.userId ? null : r.userId))}
            >
              <Td><span className="font-medium">{r.fullName?.trim() || r.email}</span></Td>
              <Td muted>{r.rankName || mlmRankLabel(t, r.mlmRank)}</Td>
              <Td right><span className="font-semibold text-sm">{formatMoney(r.totalPayout)}</span></Td>
              <Td center>
                {expanded === r.userId
                  ? <ChevronDown size={14} className="text-mq-text-muted mx-auto" />
                  : <ChevronRight size={14} className="text-mq-text-muted mx-auto" />}
              </Td>
            </tr>
            {expanded === r.userId && (
              <tr>
                <td colSpan={4} className="p-0 border-b border-mq-border">
                  <div className="bg-mq-surface-subtle/50 px-4 py-3 space-y-3">
                    <ReportTable>
                      <thead>
                        <tr>
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
                          <tr key={`${r.userId}-${e.orderCode}-${i}`} className="last:border-0">
                            <Td muted>{e.buyerEmail}</Td>
                            <Td>
                              <Link href={`/admin/orders?q=${e.orderCode}`} className="inline-flex items-center gap-1 text-[var(--mq-accent-teal)] hover:underline font-medium">
                                {e.orderCode}<ExternalLink size={10} />
                              </Link>
                            </Td>
                            <Td right>{formatMoney(e.orderTotal)}</Td>
                            <Td right muted>{formatPercent(e.teamPercent)}</Td>
                            <Td right muted>{formatPercent(e.maxBelow)}</Td>
                            <Td right>
                              <span className="font-semibold text-[var(--mq-accent-teal)]">{formatPercent(e.paidPercent)}</span>
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </ReportTable>
                    <p className="text-[11px] text-mq-text-muted">
                      Paid % = Team % − Max Below (differential commission)
                    </p>
                    {r.entries[0]?.chainNodes && r.entries[0].chainNodes.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-mq-text-muted">Chain</p>
                        <div className="flex flex-col text-[11px] gap-0.5">
                          {r.entries[0].chainNodes.map((n, ni) => (
                            <div key={n.userId} className="flex items-center gap-1.5">
                              {ni > 0 && <span className="text-mq-text-muted">↳</span>}
                              <span className={n.userId === r.userId ? "font-bold text-mq-text" : "text-mq-text-muted"}>
                                {n.rankName} <span className="tabular-nums">({formatPercent(n.percent)})</span>
                                {n.userId === r.userId ? <span className="ml-1 text-[var(--mq-accent-teal)]">← recipient</span> : ""}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </Fragment>
        ))}
      </tbody>
    </ReportTable>
  );
}

// ─── Global fund section ──────────────────────────────────────────────────────

function GlobalSection({ tiers }: { tiers: GlobalFundTierReport[] }) {
  const { t } = useLanguage();
  const tr = (k: string) => t(`admin.mlm.commissionReport.${k}`);
  const [expandedTier, setExpandedTier] = useState<number | null>(null);

  if (tiers.length === 0) {
    return <p className="text-xs text-mq-text-muted py-2">{tr("empty")}</p>;
  }

  return (
    <ReportTable>
      <thead>
        <tr>
          <Th>{tr("colTier")}</Th>
          <Th right>{tr("colPool")}</Th>
          <Th right>{tr("colEligible")}</Th>
          <Th right>{tr("colPaid")}</Th>
          <Th right>{tr("colCompanyKept")}</Th>
          <Th>{tr("colStatus")}</Th>
          <Th center> </Th>
        </tr>
      </thead>
      <tbody>
        {tiers.map((tier) => (
          <Fragment key={tier.tier}>
            <tr
              className="hover:bg-mq-surface-subtle/60 cursor-pointer"
              onClick={() => setExpandedTier((p) => (p === tier.tier ? null : tier.tier))}
            >
              <Td>
                <span className="inline-flex items-center gap-1.5 font-semibold">
                  <span className="w-5 h-5 rounded-md bg-mq-surface-subtle border border-mq-border text-[10px] font-bold flex items-center justify-center text-mq-text-muted">
                    {tier.tier}
                  </span>
                  Tier {tier.tier}
                </span>
              </Td>
              <Td right>{formatMoney(tier.poolAmount)}</Td>
              <Td right muted>{tier.eligibleCount}</Td>
              <Td right>
                <span className="font-semibold">{formatMoney(tier.paidTotal)}</span>
              </Td>
              <Td right muted>{formatMoney(tier.companyKept)}</Td>
              <Td>
                <span className={tierStatusBadge(tier.status)}>
                  {t(`admin.mlm.tierStatus.${tier.status}`)}
                </span>
              </Td>
              <Td center>
                {expandedTier === tier.tier
                  ? <ChevronDown size={14} className="text-mq-text-muted mx-auto" />
                  : <ChevronRight size={14} className="text-mq-text-muted mx-auto" />}
              </Td>
            </tr>
            {expandedTier === tier.tier && (
              <tr>
                <td colSpan={7} className="p-0 border-b border-mq-border">
                  <div className="bg-mq-surface-subtle/50 px-4 py-3">
                    {tier.users.length === 0 ? (
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-mq-text-muted">{tr("tierEmpty")}</span>
                        <span className="font-semibold text-mq-text">{t("admin.mlm.companyKept")}: {formatMoney(tier.companyKept)}</span>
                      </div>
                    ) : (
                      <ReportTable>
                        <thead>
                          <tr>
                            <Th>{tr("colRecipient")}</Th>
                            <Th>{tr("colRank")}</Th>
                            <Th right>{tr("colPaid")}</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {tier.users.map((u) => (
                            <tr key={u.userId} className="last:border-0">
                              <Td>
                                <span className="font-medium">{u.fullName?.trim() || u.email}</span>
                                <span className="block text-[11px] text-mq-text-muted">{u.email}</span>
                              </Td>
                              <Td muted>{u.rankName || mlmRankLabel(t, u.mlmRank)}</Td>
                              <Td right><span className="font-semibold">{formatMoney(u.totalPayout)}</span></Td>
                            </tr>
                          ))}
                        </tbody>
                      </ReportTable>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </Fragment>
        ))}
      </tbody>
    </ReportTable>
  );
}

// ─── Loyalty section ──────────────────────────────────────────────────────────

function LoyaltySection({ summary }: { summary: CommissionTypeSummary<GenericCommissionEntry> }) {
  const { t } = useLanguage();
  const tr = (k: string) => t(`admin.mlm.commissionReport.${k}`);
  const [expanded, setExpanded] = useState<string | null>(null);

  if (summary.users.length === 0) {
    return <p className="text-xs text-mq-text-muted py-2">{tr("empty")}</p>;
  }

  return (
    <ReportTable>
      <thead>
        <tr>
          <Th>{tr("colRecipient")}</Th>
          <Th>{tr("colRank")}</Th>
          <Th right>{tr("colPaid")}</Th>
          <Th center> </Th>
        </tr>
      </thead>
      <tbody>
        {summary.users.map((r) => {
          const consecutiveMonths = r.entries[0]?.meta?.consecutiveMonths as number | undefined;
          return (
            <Fragment key={r.userId}>
              <tr
                className="hover:bg-mq-surface-subtle/60 cursor-pointer"
                onClick={() => setExpanded((p) => (p === r.userId ? null : r.userId))}
              >
                <Td>
                  <span className="font-medium">{r.fullName?.trim() || r.email}</span>
                  <span className="block text-[11px] text-mq-text-muted">{r.email}</span>
                </Td>
                <Td muted>{r.rankName || mlmRankLabel(t, r.mlmRank)}</Td>
                <Td right><span className="font-semibold text-sm">{formatMoney(r.totalPayout)}</span></Td>
                <Td center>
                  {expanded === r.userId
                    ? <ChevronDown size={14} className="text-mq-text-muted mx-auto" />
                    : <ChevronRight size={14} className="text-mq-text-muted mx-auto" />}
                </Td>
              </tr>
              {expanded === r.userId && (
                <tr>
                  <td colSpan={4} className="p-0 border-b border-mq-border">
                    <div className="bg-mq-surface-subtle/50 px-4 py-3 space-y-3">
                      {consecutiveMonths !== undefined && (
                        <p className="text-xs text-mq-text-muted">
                          {tr("loyaltyHistoryTitle")}:{" "}
                          <span className="font-semibold text-mq-text">{consecutiveMonths} months</span>
                        </p>
                      )}
                      {r.entries.length > 0 && (
                        <ReportTable>
                          <thead>
                            <tr>
                              <Th>{tr("colOrder")}</Th>
                              <Th right>{tr("colOrderTotal")}</Th>
                              <Th right>{tr("colCommission")}</Th>
                            </tr>
                          </thead>
                          <tbody>
                            {r.entries.map((e, i) => (
                              <tr key={`${r.userId}-loyalty-${i}`} className="last:border-0">
                                <Td muted>{e.orderCode ?? "—"}</Td>
                                <Td right>{formatMoney(e.orderTotal ?? "0")}</Td>
                                <Td right><span className="font-semibold">{formatMoney(e.commissionAmount ?? "0")}</span></Td>
                              </tr>
                            ))}
                          </tbody>
                        </ReportTable>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </ReportTable>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

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
          <Link href="/admin/mlm" className="mq-btn mq-btn-outline text-xs px-3 py-1.5">
            {tr("backToMlm")}
          </Link>
        }
      />

      <div className="space-y-5 max-w-6xl">

        {/* Period picker */}
        <div className="mq-admin-panel p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1 min-w-0">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-mq-text-muted" htmlFor="ym-input">
                {tr("yearMonthLabel")}
              </label>
              <input
                id="ym-input"
                type="text"
                className="mq-input text-sm w-40"
                placeholder={tr("yearMonthPlaceholder")}
                value={inputYm}
                onChange={(e) => setInputYm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLoad()}
              />
            </div>
            <button type="button" className="mq-btn mq-btn-primary flex items-center gap-2" onClick={handleLoad}>
              <Search size={14} />
              {tr("load")}
            </button>
            {data?.yearMonth && (
              <div className="ml-auto flex items-center gap-2 text-xs text-mq-text-muted">
                <span className="font-semibold text-mq-text text-sm">{data.yearMonth}</span>
                <span className={batchBadge((data.kpi?.batchStatus ?? "NOT_RUN") as CommissionReportBatchStatus)}>
                  {t(`admin.mlm.commissionReport.batchStatuses.${data.kpi?.batchStatus ?? "NOT_RUN"}`)}
                </span>
              </div>
            )}
          </div>
        </div>

        {isError && (
          <div className="mq-alert mq-alert-error">
            {getErrorMessage(error, t("admin.common.failed"))}
          </div>
        )}

        {isLoading && <AdminCardListSkeleton count={6} />}

        {data?.yearMonth && (
          <>
            {/* KPI stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <StatCard label={tr("gmv")} value={formatMoney(data.gmv)} />
              <StatCard label={tr("deliveredOrders")} value={(data.deliveredOrderCount ?? 0).toLocaleString()} />
              <StatCard label={tr("globalFundPercent")} value={`${data.globalFundPercent ?? 0}%`} />
              <StatCard label={tr("globalPoolPerTier")} value={formatMoney(data.globalPoolPerTier ?? "0")} />
              <StatCard label={tr("grandTotalPayout")} value={formatMoney(data.grandTotalPayout ?? "0")} accent />
              <StatCard label={tr("companyKeptTotal")} value={formatMoney(data.kpi?.companyKeptTotal ?? "0")} />
            </div>

            {/* Batch meta row */}
            <SectionCard title={tr("sectionDashboard")}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-8 gap-y-0 divide-y sm:divide-y-0 sm:divide-x divide-mq-border">
                <div className="space-y-0 pb-4 sm:pb-0 sm:pr-8">
                  {[
                    { label: tr("commissionOverGmv"), value: formatPercent(data.kpi?.commissionToGmvPercent ?? "0") },
                    { label: tr("totalEntries"), value: (data.kpi?.totalEntries ?? 0).toLocaleString() },
                    { label: tr("totalRecipients"), value: (data.kpi?.totalRecipients ?? 0).toLocaleString() },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between gap-4 py-2 border-b border-mq-border last:border-0">
                      <span className="text-xs text-mq-text-muted">{label}</span>
                      <span className="text-xs font-semibold text-mq-text tabular-nums">{value}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-0 py-4 sm:py-0 sm:px-8">
                  {[
                    { label: tr("batchStatus"), value: <span className={batchBadge((data.kpi?.batchStatus ?? "NOT_RUN") as CommissionReportBatchStatus)}>{t(`admin.mlm.commissionReport.batchStatuses.${data.kpi?.batchStatus ?? "NOT_RUN"}`)}</span> },
                    { label: tr("generatedAt"), value: fmtDate(data.kpi?.generatedAt as string | null) },
                    { label: tr("failedEntries"), value: "—" },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between gap-4 py-2 border-b border-mq-border last:border-0">
                      <span className="text-xs text-mq-text-muted">{label}</span>
                      <span className="text-xs font-semibold text-mq-text tabular-nums">{value}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-0 pt-4 sm:pt-0 sm:pl-8">
                  {[
                    { label: tr("summaryReferral"), value: formatMoney(data.referral?.totalPayout ?? "0") },
                    { label: tr("summaryTeam"), value: formatMoney(data.team?.totalPayout ?? "0") },
                    { label: tr("summaryGlobal"), value: formatMoney(data.global?.totalPayout ?? "0") },
                    { label: tr("summaryLoyalty"), value: formatMoney(data.loyalty?.totalPayout ?? "0") },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between gap-4 py-2 border-b border-mq-border last:border-0">
                      <span className="text-xs text-mq-text-muted">{label}</span>
                      <span className="text-xs font-semibold text-mq-text tabular-nums">{value}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-4 py-2 mt-1 border-t-2 border-mq-border">
                    <span className="text-xs font-bold text-mq-text">{tr("summaryGrandTotal")}</span>
                    <span className="text-sm font-bold text-[var(--mq-accent-teal)] tabular-nums">{formatMoney(data.grandTotalPayout ?? "0")}</span>
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* Commission breakdown */}
            <SectionCard title={tr("sectionCommissions")}>
              <div className="space-y-5">
                <CommissionTabs
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
                {activeSection === "referral" && <ReferralSection summary={data.referral} />}
                {activeSection === "team" && <TeamSection summary={data.team} />}
                {activeSection === "global" && <GlobalSection tiers={data.global?.tiers ?? []} />}
                {activeSection === "loyalty" && <LoyaltySection summary={data.loyalty} />}
              </div>
            </SectionCard>
          </>
        )}

        {!isLoading && !isError && !data?.yearMonth && queryYm && (
          <div className="mq-admin-panel p-10 text-center text-sm text-mq-text-muted">{tr("empty")}</div>
        )}

        {!queryYm && !isLoading && (
          <div className="mq-admin-panel p-10 text-center space-y-2">
            <p className="text-sm font-medium text-mq-text">{tr("yearMonthLabel")}</p>
            <p className="text-xs text-mq-text-muted">{tr("yearMonthPlaceholder")}</p>
          </div>
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
