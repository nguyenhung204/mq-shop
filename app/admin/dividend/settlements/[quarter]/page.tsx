"use client";

import Link from "next/link";
import { use, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { ItemsTable, RunPanel, RunResult, SettlementFacts } from "@/components/dividend/SettlementViews";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { AdminCardListSkeleton } from "@/components/ui/Skeleton";
import type { ItemStatus } from "@/lib/api/dividend-settlements";
import { canRunDividendSettlement } from "@/lib/auth/admin-write";
import { quarterFromSegment } from "@/lib/dividend/access";
import { ITEM_STATUSES, periodKeyLabel } from "@/lib/dividend/settlement";
import { useRunSettlement, useSettlementDetail } from "@/lib/queries/dividend-settlements";
import { getErrorMessage } from "@/lib/queries/utils";

function NotFound() {
  const { t } = useLanguage();
  return (
    <>
      <AdminPageHeader
        title={t("dividendSettlements.detailTitle")}
        actions={
          <Link href="/admin/dividend/settlements" className="mq-admin-btn mq-admin-btn-secondary">
            <ArrowLeft size={16} aria-hidden />
            {t("dividendSettlements.back")}
          </Link>
        }
      />
      <div className="mq-alert mq-alert-error" role="alert">
        {t("dividendSettlements.errors.notFound")}
      </div>
    </>
  );
}

function Inner({ quarter }: { quarter: string }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<ItemStatus | "">("");
  const detail = useSettlementDetail(quarter, page, status);
  const run = useRunSettlement();
  const canRun = canRunDividendSettlement(user);
  return (
    <>
      <AdminPageHeader
        title={`${t("dividendSettlements.detailTitle")} · ${periodKeyLabel(quarter)}`}
        actions={
          <Link href="/admin/dividend/settlements" className="mq-admin-btn mq-admin-btn-secondary">
            <ArrowLeft size={16} aria-hidden />
            {t("dividendSettlements.back")}
          </Link>
        }
      />
      <div className="space-y-6">
        {detail.isLoading ? <AdminCardListSkeleton count={2} /> : null}
        {detail.isError ? <div className="mq-alert mq-alert-error">{getErrorMessage(detail.error, t("admin.common.failed"))}</div> : null}
        {detail.data ? <SettlementFacts s={detail.data.settlement} /> : null}
        {canRun ? <RunPanel fixedQuarter={quarter} busy={run.isPending} onRun={async (q) => void run.mutateAsync(q).catch(() => undefined)} /> : null}
        {run.data ? <RunResult r={run.data} /> : null}
        {detail.data ? (
          <>
            <select
              className="mq-input max-w-[16rem]"
              value={status}
              aria-label={t("admin.common.filterStatus")}
              onChange={(e) => {
                setStatus(e.target.value as ItemStatus | "");
                setPage(1);
              }}
            >
              <option value="">{t("admin.common.all")}</option>
              {ITEM_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`dividendSettlements.itemStatus.${s}`)}
                </option>
              ))}
            </select>
            {detail.data.items.length === 0 ? <p className="text-sm text-mq-text-muted">{t("dividendSettlements.noItems")}</p> : <ItemsTable items={detail.data.items} />}
            <PaginationBar page={page} meta={detail.data.meta} onPageChange={setPage} />
          </>
        ) : null}
      </div>
    </>
  );
}

export default function AdminDividendSettlementDetailPage({ params }: { params: Promise<{ quarter: string }> }) {
  const { quarter } = use(params);
  // a malformed segment (/settlements/%25) must not throw: it is simply a quarter that does not exist
  const valid = quarterFromSegment(quarter);
  return (
    <AuthGuard roles={["ACCOUNTANT", "ADMIN", "SUPER_ADMIN"]} permissions={["VIEW_MLM_COMSN"]}>
      {valid ? <Inner quarter={valid} /> : <NotFound />}
    </AuthGuard>
  );
}
