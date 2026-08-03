"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Filter } from "lucide-react";
import { adminApi } from "@/lib/api";
import type { ApiAuditLog } from "@/lib/api/types";
import { parsePage } from "@/lib/api/utils";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { AdminCardListSkeleton } from "@/components/ui/Skeleton";
import { translateStatus, translateStatusMap } from "@/lib/i18n/status";
import type { Locale } from "@/lib/i18n/types";
import { getErrorMessage } from "@/lib/queries/utils";

function toIsoStart(date: string): string | undefined {
  if (!date) return undefined;
  return new Date(`${date}T00:00:00.000Z`).toISOString();
}

function toIsoEnd(date: string): string | undefined {
  if (!date) return undefined;
  return new Date(`${date}T23:59:59.999Z`).toISOString();
}

function outcomeBadgeClass(outcome: ApiAuditLog["outcome"] | undefined): string {
  if (outcome === "failure") return "mq-badge mq-badge-pink";
  if (outcome === "denied") return "mq-badge mq-badge-muted";
  return "mq-badge mq-badge-teal";
}

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatRelativeTime(iso: string, locale: string): string {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return iso;
  const diffSec = Math.round((Date.now() - ts) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(-diffSec, "second");
  if (abs < 3600) return rtf.format(-Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(-Math.round(diffSec / 3600), "hour");
  if (abs < 86400 * 7) return rtf.format(-Math.round(diffSec / 86400), "day");
  return new Date(iso).toLocaleString(locale);
}

function pickTargetEmail(log: ApiAuditLog): string | null {
  const meta = log.meta;
  if (meta && typeof meta === "object") {
    for (const key of ["email", "targetEmail", "userEmail", "actorEmail"] as const) {
      const v = meta[key];
      if (typeof v === "string" && v.includes("@")) return v;
    }
  }
  const fromJson = (value: unknown): string | null => {
    if (!value || typeof value !== "object") return null;
    const o = value as Record<string, unknown>;
    for (const key of ["email", "targetEmail", "userEmail"] as const) {
      const v = o[key];
      if (typeof v === "string" && v.includes("@")) return v;
    }
    return null;
  };
  return fromJson(log.afterJson) || fromJson(log.beforeJson);
}

function resourceLabel(
  t: (key: string, vars?: Record<string, string>) => string,
  type: string | null | undefined,
): string {
  return translateStatus(t, "auditResource", type);
}

function AuditCard({
  log,
  locale,
}: {
  log: ApiAuditLog;
  locale: string;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const title = translateStatusMap(
    locale as Locale,
    "auditAction",
    log.action,
    log.title || log.action,
  );
  const outcomeText = translateStatus(t, "auditOutcome", log.outcome);
  const categoryText = log.category
    ? translateStatus(t, "auditCategory", log.category)
    : null;
  const actorEmail = log.actor?.email?.trim() || null;
  const targetEmail = pickTargetEmail(log);
  const hasDiff = log.beforeJson != null || log.afterJson != null;
  const hasDetails = Boolean(
    log.summary ||
      log.reason ||
      log.resource?.type ||
      log.actor?.ip ||
      log.action ||
      hasDiff ||
      (log.meta && Object.keys(log.meta).length > 0),
  );

  return (
    <article className="mq-card overflow-hidden">
      <button
        type="button"
        className="w-full text-left p-4 flex gap-3 items-start hover:bg-mq-surface-subtle/50 transition-colors"
        onClick={() => hasDetails && setOpen((v) => !v)}
        disabled={!hasDetails}
        aria-expanded={open}
      >
        <span className="mt-0.5 shrink-0 text-mq-text-muted">
          {hasDetails ? (
            open ? (
              <ChevronDown size={16} />
            ) : (
              <ChevronRight size={16} />
            )
          ) : (
            <span className="inline-block w-4" />
          )}
        </span>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            {categoryText ? (
              <span className="mq-badge mq-badge-cyan text-[10px]">{categoryText}</span>
            ) : null}
            <span className={outcomeBadgeClass(log.outcome)}>{outcomeText}</span>
            <span
              className="text-[11px] text-mq-text-muted ml-auto whitespace-nowrap"
              title={new Date(log.ts).toLocaleString(locale)}
            >
              {formatRelativeTime(log.ts, locale)}
            </span>
          </div>

          <h3 className="text-sm font-semibold text-mq-text leading-snug">{title}</h3>

          {log.summary ? (
            <p className="text-sm text-mq-text-secondary leading-relaxed line-clamp-2">
              {log.summary}
            </p>
          ) : null}

          <div className="flex flex-col gap-0.5 text-xs pt-0.5">
            <p className="text-mq-text">
              <span className="text-mq-text-muted">{t("admin.auditPage.actorEmail")}: </span>
              <span className="font-medium break-all">{actorEmail || "—"}</span>
            </p>
            {targetEmail && targetEmail !== actorEmail ? (
              <p className="text-mq-text">
                <span className="text-mq-text-muted">{t("admin.auditPage.targetEmail")}: </span>
                <span className="font-medium break-all">{targetEmail}</span>
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-mq-text-muted">
            {log.resource?.type ? (
              <span>
                {resourceLabel(t, log.resource.type)}
              </span>
            ) : null}
            {hasDiff ? (
              <span className="text-mq-accent-teal">{t("admin.auditPage.hasDiff")}</span>
            ) : null}
          </div>
        </div>
      </button>

      {open && hasDetails ? (
        <div className="border-t border-mq-border bg-mq-surface-subtle/40 px-4 py-3 space-y-3 text-xs">
          {log.reason ? (
            <p>
              <span className="text-mq-text-muted">{t("admin.common.reasonPrefix")}</span>
              {log.reason}
            </p>
          ) : null}

          <dl className="grid sm:grid-cols-2 gap-x-4 gap-y-2">
            <div>
              <dt className="text-mq-text-muted">{t("admin.auditPage.time")}</dt>
              <dd>{new Date(log.ts).toLocaleString(locale)}</dd>
            </div>
            <div>
              <dt className="text-mq-text-muted">{t("admin.auditPage.actorEmail")}</dt>
              <dd className="break-all font-medium">{actorEmail || "—"}</dd>
            </div>
            {targetEmail && targetEmail !== actorEmail ? (
              <div>
                <dt className="text-mq-text-muted">{t("admin.auditPage.targetEmail")}</dt>
                <dd className="break-all font-medium">{targetEmail}</dd>
              </div>
            ) : null}
            {log.actor?.ip ? (
              <div>
                <dt className="text-mq-text-muted">{t("admin.auditPage.ip")}</dt>
                <dd className="font-mono">{log.actor.ip}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-mq-text-muted">{t("admin.auditPage.actionCode")}</dt>
              <dd className="font-mono break-all">{log.action}</dd>
            </div>
            {log.resource?.type ? (
              <div className="sm:col-span-2">
                <dt className="text-mq-text-muted">{t("admin.auditPage.resource")}</dt>
                <dd>
                  {resourceLabel(t, log.resource.type)}
                </dd>
              </div>
            ) : null}
          </dl>

          {hasDiff ? (
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <p className="text-mq-text-muted mb-1 font-medium">{t("admin.auditPage.before")}</p>
                <pre className="overflow-auto max-h-56 rounded-md border border-mq-border bg-mq-surface p-2 font-mono text-[11px]">
                  {log.beforeJson != null ? formatJson(log.beforeJson) : "—"}
                </pre>
              </div>
              <div>
                <p className="text-mq-text-muted mb-1 font-medium">{t("admin.auditPage.after")}</p>
                <pre className="overflow-auto max-h-56 rounded-md border border-mq-border bg-mq-surface p-2 font-mono text-[11px]">
                  {log.afterJson != null ? formatJson(log.afterJson) : "—"}
                </pre>
              </div>
            </div>
          ) : null}

          {log.meta && Object.keys(log.meta).length > 0 ? (
            <div>
              <p className="text-mq-text-muted mb-1 font-medium">{t("admin.auditPage.meta")}</p>
              <pre className="overflow-auto max-h-40 rounded-md border border-mq-border bg-mq-surface p-2 font-mono text-[11px]">
                {formatJson(log.meta)}
              </pre>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function AuditInner() {
  const { t, locale } = useLanguage();
  const displayLocale = locale || "en";
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [action, setAction] = useState("");
  const [outcome, setOutcome] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [actorId, setActorId] = useState("");
  const [actorEmail, setActorEmail] = useState("");
  const [ip, setIp] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const pageSize = 20;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: [
      "admin",
      "audit-logs",
      page,
      pageSize,
      action,
      outcome,
      resourceType,
      actorId,
      actorEmail,
      ip,
      from,
      to,
    ],
    queryFn: async () =>
      parsePage<ApiAuditLog>(
        await adminApi.auditLogs({
          page,
          pageSize,
          action: action || undefined,
          outcome: outcome || undefined,
          resourceType: resourceType || undefined,
          actorId: actorId || undefined,
          actorEmail: actorEmail || undefined,
          ip: ip || undefined,
          from: toIsoStart(from),
          to: toIsoEnd(to),
        }),
      ),
  });

  const items = data?.items ?? [];
  const meta = data?.meta;

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const log of items) {
      if (log.category) set.add(log.category);
    }
    return Array.from(set).sort();
  }, [items]);

  const visible = useMemo(() => {
    if (!categoryFilter) return items;
    return items.filter((l) => l.category === categoryFilter);
  }, [items, categoryFilter]);

  const overview = useMemo(() => {
    const counts = { success: 0, failure: 0, denied: 0 };
    for (const log of items) {
      if (log.outcome === "failure") counts.failure += 1;
      else if (log.outcome === "denied") counts.denied += 1;
      else counts.success += 1;
    }
    return counts;
  }, [items]);

  const activeFilterCount = [
    action,
    outcome,
    resourceType,
    actorId,
    actorEmail,
    ip,
    from,
    to,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setAction("");
    setOutcome("");
    setResourceType("");
    setActorId("");
    setActorEmail("");
    setIp("");
    setFrom("");
    setTo("");
    setCategoryFilter("");
    setPage(1);
  };

  return (
    <>
      <AdminPageHeader
        title={t("admin.audit.title")}
        description={t("admin.audit.description")}
      />
      <div className="space-y-5">
        {isError && (
          <div className="mq-alert mq-alert-error">
            {getErrorMessage(error, t("admin.common.failed"))}
          </div>
        )}

        {!isLoading && items.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="mq-admin-panel px-3 py-2.5">
              <p className="text-[11px] text-mq-text-muted">{t("admin.auditPage.total")}</p>
              <p className="text-lg font-semibold tabular-nums">
                {meta?.total ?? items.length}
              </p>
            </div>
            <div className="mq-admin-panel px-3 py-2.5">
              <p className="text-[11px] text-mq-text-muted">{t("admin.auditPage.succeeded")}</p>
              <p className="text-lg font-semibold tabular-nums text-mq-accent-teal">
                {overview.success}
              </p>
            </div>
            <div className="mq-admin-panel px-3 py-2.5">
              <p className="text-[11px] text-mq-text-muted">{t("admin.auditPage.failed")}</p>
              <p className="text-lg font-semibold tabular-nums text-mq-accent-pink">
                {overview.failure}
              </p>
            </div>
            <div className="mq-admin-panel px-3 py-2.5">
              <p className="text-[11px] text-mq-text-muted">{t("admin.auditPage.denied")}</p>
              <p className="text-lg font-semibold tabular-nums text-mq-text-muted">
                {overview.denied}
              </p>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="mq-admin-btn mq-admin-btn-secondary"
            onClick={() => setFiltersOpen((v) => !v)}
          >
            <Filter size={14} />
            {t("admin.auditPage.filters")}
            {activeFilterCount > 0 ? (
              <span className="mq-badge mq-badge-cyan text-[10px]">{activeFilterCount}</span>
            ) : null}
          </button>
          {activeFilterCount > 0 ? (
            <button
              type="button"
              className="text-xs underline text-mq-text-muted"
              onClick={clearFilters}
            >
              {t("admin.auditPage.clearFilters")}
            </button>
          ) : null}
          {categories.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 ml-auto">
              <button
                type="button"
                className={`text-[11px] px-2 py-1 rounded-md border ${
                  !categoryFilter
                    ? "border-mq-accent-teal bg-mq-surface text-mq-text"
                    : "border-mq-border text-mq-text-muted"
                }`}
                onClick={() => setCategoryFilter("")}
              >
                {t("admin.auditPage.allCategories")}
              </button>
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`text-[11px] px-2 py-1 rounded-md border ${
                    categoryFilter === c
                      ? "border-mq-accent-teal bg-mq-surface text-mq-text"
                      : "border-mq-border text-mq-text-muted"
                  }`}
                  onClick={() => setCategoryFilter(c === categoryFilter ? "" : c)}
                >
                  {translateStatus(t, "auditCategory", c)}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {filtersOpen ? (
          <div className="mq-admin-panel p-4 flex flex-wrap gap-3 items-end">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-mq-text-muted text-xs">{t("admin.auditPage.actionCode")}</span>
              <input
                className="mq-input max-w-xs"
                placeholder={t("admin.auditPage.filterAction")}
                value={action}
                onChange={(e) => {
                  setAction(e.target.value);
                  setPage(1);
                }}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-mq-text-muted text-xs">{t("admin.auditPage.outcome")}</span>
              <select
                className="mq-input !w-[10rem] max-w-full"
                value={outcome}
                onChange={(e) => {
                  setOutcome(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">{t("admin.auditPage.anyOutcome")}</option>
                <option value="success">{t("admin.auditPage.succeeded")}</option>
                <option value="failure">{t("admin.auditPage.failed")}</option>
                <option value="denied">{t("admin.auditPage.denied")}</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-mq-text-muted text-xs">{t("admin.auditPage.resourceType")}</span>
              <input
                className="mq-input max-w-xs"
                placeholder={t("admin.auditPage.resourceTypePh")}
                value={resourceType}
                onChange={(e) => {
                  setResourceType(e.target.value);
                  setPage(1);
                }}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-mq-text-muted text-xs">{t("admin.auditPage.actorEmail")}</span>
              <input
                className="mq-input max-w-xs"
                placeholder={t("admin.auditPage.actorEmailPh")}
                value={actorEmail}
                onChange={(e) => {
                  setActorEmail(e.target.value.trim());
                  setPage(1);
                }}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-mq-text-muted text-xs">{t("admin.auditPage.actor")}</span>
              <input
                className="mq-input max-w-xs"
                placeholder={t("admin.auditPage.actorPh")}
                value={actorId}
                onChange={(e) => {
                  setActorId(e.target.value.trim());
                  setPage(1);
                }}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-mq-text-muted text-xs">{t("admin.auditPage.ip")}</span>
              <input
                className="mq-input max-w-[10rem]"
                placeholder={t("admin.auditPage.ipPh")}
                value={ip}
                onChange={(e) => {
                  setIp(e.target.value.trim());
                  setPage(1);
                }}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-mq-text-muted text-xs">{t("transactions.startDate")}</span>
              <input
                type="date"
                className="mq-input"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPage(1);
                }}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-mq-text-muted text-xs">{t("transactions.endDate")}</span>
              <input
                type="date"
                className="mq-input"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPage(1);
                }}
              />
            </label>
          </div>
        ) : null}

        {isLoading ? (
          <AdminCardListSkeleton count={6} />
        ) : visible.length === 0 ? (
          <p className="text-sm text-mq-text-muted py-8 text-center">{t("admin.auditPage.empty")}</p>
        ) : (
          <div className="space-y-2.5">
            {visible.map((log) => (
              <AuditCard key={log.id} log={log} locale={displayLocale} />
            ))}
          </div>
        )}

        <PaginationBar page={page} meta={meta} onPageChange={setPage} />
      </div>
    </>
  );
}

export default function AdminAuditLogsPage() {
  return (
    <AuthGuard
      roles={["ADMIN", "SUPER_ADMIN"]}
      permissions={["VIEW_AUDIT_LOG"]}
    >
      <AuditInner />
    </AuthGuard>
  );
}
