"use client";

import { useEffect, useMemo, useState } from "react";
import { Timer } from "lucide-react";
import type { CronJobInfo } from "@/lib/api/admin-dashboard";
import { useAdminCronJobs } from "@/lib/queries/admin";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { formatDateTimeLocale } from "@/lib/i18n/locale-format";
import { Skeleton } from "@/components/ui/Skeleton";

function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (d > 0) {
    return `${d}d ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function getUrgencyClass(ms: number): string {
  if (ms <= 0) return "text-mq-text-muted";
  if (ms < 5 * 60_000) return "text-red-500 animate-pulse";
  if (ms < 30 * 60_000) return "text-orange-500";
  return "text-emerald-600";
}

function useCountdowns(jobs: CronJobInfo[], serverTime: string) {
  const [remaining, setRemaining] = useState<Record<string, number>>({});

  useEffect(() => {
    const serverNow = new Date(serverTime).getTime();
    const clientNow = Date.now();
    const drift = clientNow - serverNow;

    function computeAll() {
      const now = Date.now();
      const map: Record<string, number> = {};
      for (const job of jobs) {
        const nextRunClient = new Date(job.nextRunAt).getTime() + drift;
        map[job.id] = Math.max(0, nextRunClient - now);
      }
      return map;
    }

    setRemaining(computeAll());
    const interval = setInterval(() => setRemaining(computeAll()), 1000);
    return () => clearInterval(interval);
  }, [jobs, serverTime]);

  return remaining;
}

export function AdminCronJobs() {
  const { t, locale } = useLanguage();
  const { data, isLoading, isError, error, refetch, isFetching } =
    useAdminCronJobs();

  if (isLoading) {
    return (
      <div className="mq-card p-4">
        <Skeleton className="h-4 w-40 mb-4" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mq-card p-4 space-y-2">
        <h3 className="text-sm font-semibold text-mq-text flex items-center gap-2">
          <Timer size={15} strokeWidth={1.75} aria-hidden />
          {t("admin.overview.cronJobs")}
        </h3>
        <p className="text-xs text-mq-alert-error">
          {error instanceof Error ? error.message : t("admin.overview.cronJobsLoadError")}
        </p>
        <button
          type="button"
          className="mq-btn mq-btn-secondary text-xs"
          onClick={() => void refetch()}
        >
          {t("admin.common.retry")}
        </button>
      </div>
    );
  }

  if (!data || data.jobs.length === 0) {
    return (
      <div className="mq-card p-4">
        <h3 className="text-sm font-semibold text-mq-text flex items-center gap-2">
          <Timer size={15} strokeWidth={1.75} aria-hidden />
          {t("admin.overview.cronJobs")}
        </h3>
        <p className="text-xs text-mq-text-muted mt-2">
          {t("admin.overview.noCronJobs")}
        </p>
      </div>
    );
  }

  return (
    <div className="mq-card">
      <div className="px-4 pt-4 pb-3 flex flex-wrap items-start justify-between gap-3 border-b border-mq-border">
        <div>
          <h3 className="text-sm font-semibold text-mq-text flex items-center gap-2">
            <Timer size={15} strokeWidth={1.75} aria-hidden />
            {t("admin.overview.cronJobs")}
            <span className="mq-badge mq-badge-muted text-[10px]">
              {data.count ?? data.jobs.length}
            </span>
          </h3>
          <p className="text-xs text-mq-text-muted mt-0.5">
            {t("admin.overview.cronJobsDesc")}
          </p>
        </div>
        <button
          type="button"
          className="mq-btn mq-btn-secondary text-xs"
          disabled={isFetching}
          onClick={() => void refetch()}
        >
          {isFetching ? t("admin.common.loading") : t("admin.overview.refreshCron")}
        </button>
      </div>
      <CronJobTable
        jobs={data.jobs}
        serverTime={data.serverTime}
        locale={locale}
      />
    </div>
  );
}

function CronJobTable({
  jobs,
  serverTime,
  locale,
}: {
  jobs: CronJobInfo[];
  serverTime: string;
  locale: Parameters<typeof formatDateTimeLocale>[1];
}) {
  const { t } = useLanguage();
  const remaining = useCountdowns(jobs, serverTime);
  const sorted = useMemo(
    () =>
      [...jobs].sort(
        (a, b) =>
          (remaining[a.id] ?? a.nextRunInMs) - (remaining[b.id] ?? b.nextRunInMs),
      ),
    [jobs, remaining],
  );

  return (
    <div className="mq-table-wrap overflow-x-auto">
      <table className="w-full text-xs tabular-nums">
        <thead>
          <tr className="border-b border-mq-border bg-mq-surface-subtle text-left text-mq-text-muted">
            <th className="px-3 py-2 font-medium">{t("admin.overview.cronColName")}</th>
            <th className="px-3 py-2 font-medium">{t("admin.overview.cronColCategory")}</th>
            <th className="px-3 py-2 font-medium">{t("admin.overview.schedule")}</th>
            <th className="px-3 py-2 font-medium">{t("admin.overview.nextRun")}</th>
            <th className="px-3 py-2 font-medium text-right">{t("admin.overview.cronColCountdown")}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((job) => {
            const ms = remaining[job.id] ?? job.nextRunInMs;
            const nameKey = `admin.overview.jobs.${job.id}.name`;
            const descKey = `admin.overview.jobs.${job.id}.description`;
            const scheduleKey = `admin.overview.jobs.${job.id}.schedule`;
            const name = t(nameKey) !== nameKey ? t(nameKey) : job.name;
            const description =
              t(descKey) !== descKey ? t(descKey) : job.description;
            const schedule =
              t(scheduleKey) !== scheduleKey ? t(scheduleKey) : job.schedule;
            const cat = job.category ?? "orders";
            const catKey = `admin.overview.cronCategory.${cat}`;
            const catLabel = t(catKey) !== catKey ? t(catKey) : cat;
            return (
              <tr
                key={job.id}
                className="border-b border-mq-border last:border-0 align-top hover:bg-mq-surface-subtle/50"
              >
                <td className="px-3 py-2.5 min-w-[14rem]">
                  <div className="font-medium text-mq-text">{name}</div>
                  <p className="text-[11px] text-mq-text-muted mt-0.5 max-w-lg leading-relaxed">
                    {description}
                  </p>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <span className="mq-badge mq-badge-muted">{catLabel}</span>
                </td>
                <td className="px-3 py-2.5 text-mq-text-muted whitespace-nowrap">
                  {schedule}
                </td>
                <td className="px-3 py-2.5 text-mq-text whitespace-nowrap">
                  {formatDateTimeLocale(job.nextRunAt, locale)}
                </td>
                <td
                  className={`px-3 py-2.5 text-right font-mono font-medium whitespace-nowrap ${getUrgencyClass(ms)}`}
                >
                  {formatCountdown(ms)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
