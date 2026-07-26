"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight } from "lucide-react";
import { adminApi } from "@/lib/api";
import type { ApiAuditLog } from "@/lib/api/types";
import { parsePage } from "@/lib/api/utils";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { TableSkeleton } from "@/components/ui/Skeleton";

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
  return "mq-badge mq-badge-cyan";
}

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function AuditRow({ log }: { log: ApiAuditLog }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const title = log.title || log.action;
  const outcomeText = log.outcomeLabel || log.outcome;
  const hasDetails = Boolean(
    log.summary ||
      log.reason ||
      log.category ||
      log.resource?.type ||
      log.actor?.ip ||
      log.beforeJson != null ||
      log.afterJson != null,
  );

  return (
    <>
      <tr className="border-t border-mq-border align-middle">
        <td className="p-3 whitespace-nowrap text-xs text-mq-text-muted">
          {new Date(log.ts).toLocaleString()}
        </td>
        <td className="p-3">
          <button
            type="button"
            className="flex items-start gap-1.5 text-left w-full group"
            onClick={() => hasDetails && setOpen((v) => !v)}
            disabled={!hasDetails}
            aria-expanded={open}
          >
            {hasDetails ? (
              open ? (
                <ChevronDown size={14} className="mt-0.5 shrink-0 text-mq-text-muted" />
              ) : (
                <ChevronRight size={14} className="mt-0.5 shrink-0 text-mq-text-muted" />
              )
            ) : (
              <span className="w-3.5 shrink-0" />
            )}
            <span>
              <span className="text-sm font-medium text-mq-text group-hover:underline decoration-mq-border underline-offset-2">
                {title}
              </span>
              {log.category ? (
                <span className="block text-[11px] text-mq-text-muted mt-0.5">{log.category}</span>
              ) : null}
            </span>
          </button>
        </td>
        <td className="p-3">
          <span className={outcomeBadgeClass(log.outcome)}>{outcomeText}</span>
        </td>
        <td className="p-3 text-xs">
          <div>{log.actor?.email || log.actor?.id || "—"}</div>
          {log.actor?.ip ? (
            <div className="text-[11px] text-mq-text-muted font-mono mt-0.5">{log.actor.ip}</div>
          ) : null}
        </td>
      </tr>
      {open && hasDetails ? (
        <tr className="bg-mq-surface-subtle/60">
          <td colSpan={4} className="px-3 pb-3 pt-0">
            <div className="ml-5 rounded-lg border border-mq-border bg-mq-surface p-3 text-xs space-y-2">
              {log.summary ? (
                <p className="text-mq-text-secondary">{log.summary}</p>
              ) : null}
              {log.reason ? (
                <p>
                  <span className="text-mq-text-muted">{t("admin.common.reasonPrefix")}</span>
                  {log.reason}
                </p>
              ) : null}
              {log.actor?.ip ? (
                <p>
                  <span className="text-mq-text-muted">{t("admin.auditPage.ip")}: </span>
                  <span className="font-mono">{log.actor.ip}</span>
                </p>
              ) : null}
              <p className="text-mq-text-muted font-mono">
                {log.action}
                {log.resource?.type
                  ? ` · ${log.resource.type}${log.resource.id ? `/${log.resource.id}` : ""}`
                  : ""}
              </p>
              {log.beforeJson != null ? (
                <div>
                  <p className="text-mq-text-muted mb-1">{t("admin.auditPage.before")}</p>
                  <pre className="overflow-auto max-h-48 rounded-md bg-mq-surface-subtle p-2 font-mono text-[11px]">
                    {formatJson(log.beforeJson)}
                  </pre>
                </div>
              ) : null}
              {log.afterJson != null ? (
                <div>
                  <p className="text-mq-text-muted mb-1">{t("admin.auditPage.after")}</p>
                  <pre className="overflow-auto max-h-48 rounded-md bg-mq-surface-subtle p-2 font-mono text-[11px]">
                    {formatJson(log.afterJson)}
                  </pre>
                </div>
              ) : null}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function AuditInner() {
  const { t } = useLanguage();
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [outcome, setOutcome] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [actorId, setActorId] = useState("");
  const [actorEmail, setActorEmail] = useState("");
  const [ip, setIp] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: [
      "admin",
      "audit-logs",
      page,
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
          pageSize: 30,
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

  return (
    <>
      <AdminPageHeader
        title={t("admin.audit.title")}
        description={t("admin.audit.description")}
      />
      <div className="space-y-6">
        {isError && (
          <div className="mq-alert mq-alert-error">
            {error instanceof Error ? error.message : t("admin.common.failed")}
          </div>
        )}

        <div className="mq-admin-panel p-4 flex flex-wrap gap-3 items-end">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-mq-text-muted text-xs">{t("admin.auditPage.event")}</span>
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

        {isLoading ? (
          <TableSkeleton rows={8} cols={4} />
        ) : (
          <div className="mq-table-wrap mq-admin-panel overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-mq-surface-subtle text-left">
                <tr>
                  <th className="p-3 font-medium text-xs text-mq-text-muted">
                    {t("admin.auditPage.time")}
                  </th>
                  <th className="p-3 font-medium text-xs text-mq-text-muted">
                    {t("admin.auditPage.event")}
                  </th>
                  <th className="p-3 font-medium text-xs text-mq-text-muted">
                    {t("admin.auditPage.outcome")}
                  </th>
                  <th className="p-3 font-medium text-xs text-mq-text-muted">
                    {t("admin.auditPage.actor")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-sm text-mq-text-muted">
                      {t("admin.auditPage.empty")}
                    </td>
                  </tr>
                ) : (
                  items.map((log) => <AuditRow key={log.id} log={log} />)
                )}
              </tbody>
            </table>
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
      roles={["ADMIN", "SUPER_ADMIN", "ACCOUNTANT"]}
      permissions={["VIEW_AUDIT_LOG"]}
    >
      <AuditInner />
    </AuthGuard>
  );
}
