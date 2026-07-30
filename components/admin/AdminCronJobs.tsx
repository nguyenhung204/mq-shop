"use client";

import { useEffect, useState } from "react";
import { Clock, Timer } from "lucide-react";
import type { CronJobInfo } from "@/lib/api/admin-dashboard";
import { useAdminCronJobs } from "@/lib/queries/admin";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { Skeleton } from "@/components/ui/Skeleton";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function getUrgencyClass(ms: number): string {
  if (ms <= 0) return "text-mq-text-muted";
  if (ms < 5 * 60_000) return "text-red-500 animate-pulse";
  if (ms < 30 * 60_000) return "text-orange-500";
  return "text-emerald-600";
}

// ---------------------------------------------------------------------------
// Countdown hook — ticks every second
// ---------------------------------------------------------------------------

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

    const interval = setInterval(() => {
      setRemaining(computeAll());
    }, 1000);

    return () => clearInterval(interval);
  }, [jobs, serverTime]);

  return remaining;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AdminCronJobs() {
  const { t } = useLanguage();
  const { data, isLoading } = useAdminCronJobs();

  if (isLoading) {
    return (
      <div className="mq-card p-4">
        <Skeleton className="h-4 w-32 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
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
        <p className="text-xs text-mq-text-muted mt-2">{t("admin.overview.noCronJobs")}</p>
      </div>
    );
  }

  return (
    <div className="mq-card">
      <div className="px-4 pt-4 pb-2">
        <h3 className="text-sm font-semibold text-mq-text flex items-center gap-2">
          <Timer size={15} strokeWidth={1.75} aria-hidden />
          {t("admin.overview.cronJobs")}
        </h3>
        <p className="text-xs text-mq-text-muted mt-0.5">
          {t("admin.overview.cronJobsDesc")}
        </p>
      </div>
      <CronJobList jobs={data.jobs} serverTime={data.serverTime} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component with countdown
// ---------------------------------------------------------------------------

function CronJobList({
  jobs,
  serverTime,
}: {
  jobs: CronJobInfo[];
  serverTime: string;
}) {
  const { t } = useLanguage();
  const remaining = useCountdowns(jobs, serverTime);

  return (
    <div className="px-4 pb-4 space-y-2">
      {jobs.map((job) => {
        const ms = remaining[job.id] ?? job.nextRunInMs;
        return (
          <div
            key={job.id}
            className="flex items-start gap-3 rounded-lg border border-mq-border p-3"
          >
            <span className={`mt-0.5 ${getUrgencyClass(ms)}`}>
              <Clock size={16} strokeWidth={1.75} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-mq-text truncate">
                  {job.name}
                </span>
                <span
                  className={`text-xs font-mono tabular-nums font-medium ${getUrgencyClass(ms)}`}
                >
                  {formatCountdown(ms)}
                </span>
              </div>
              <p className="text-xs text-mq-text-muted mt-0.5 line-clamp-2">
                {job.description}
              </p>
              <p className="text-[11px] text-mq-text-muted mt-1">
                {t("admin.overview.schedule")}: {job.schedule}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
