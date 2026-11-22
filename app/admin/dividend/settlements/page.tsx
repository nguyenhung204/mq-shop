"use client";

import { useState } from "react";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { AutoCreditStateCard, AutoCreditWarning, RunPanel, RunResult, SettlementTable } from "@/components/dividend/SettlementViews";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { AdminCardListSkeleton } from "@/components/ui/Skeleton";
import { canRunDividendSettlement } from "@/lib/auth/admin-write";
import { useDividendSettlements, useRunSettlement } from "@/lib/queries/dividend-settlements";
import { getErrorMessage } from "@/lib/queries/utils";

function Inner() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const list = useDividendSettlements(page);
  const run = useRunSettlement();
  const canRun = canRunDividendSettlement(user);
  const items = list.data?.items ?? [];
  return (
    <>
      <AdminPageHeader title={t("dividendSettlements.title")} description={t("dividendSettlements.description")} />
      <div className="space-y-6">
        <AutoCreditWarning compact />
        <AutoCreditStateCard state={list.data?.autoCredit ?? null} />
        {canRun ? (
          <RunPanel busy={run.isPending} onRun={async (q) => void run.mutateAsync(q).catch(() => undefined)} />
        ) : (
          <p className="text-xs text-mq-text-muted">{t("dividendSettlements.run.readOnly")}</p>
        )}
        {run.data ? <RunResult r={run.data} /> : null}
        {list.isLoading ? <AdminCardListSkeleton count={3} /> : null}
        {list.isError ? <div className="mq-alert mq-alert-error">{getErrorMessage(list.error, t("admin.common.failed"))}</div> : null}
        {!list.isLoading && !list.isError && items.length === 0 ? <p className="text-sm text-mq-text-muted">{t("dividendSettlements.empty")}</p> : null}
        {items.length > 0 ? <SettlementTable items={items} /> : null}
        <PaginationBar page={page} meta={list.data?.meta} onPageChange={setPage} />
      </div>
    </>
  );
}

export default function AdminDividendSettlementsPage() {
  return (
    <AuthGuard roles={["ACCOUNTANT", "ADMIN", "SUPER_ADMIN"]} permissions={["VIEW_MLM_COMSN"]}>
      <Inner />
    </AuthGuard>
  );
}
