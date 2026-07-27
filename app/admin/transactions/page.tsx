"use client";

import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { TransactionsReport } from "@/components/finance/TransactionsReport";
import { useLanguage } from "@/components/providers/LanguageProvider";

function AdminTransactionsInner() {
  const { t } = useLanguage();
  return (
    <>
      <AdminPageHeader
        title={t("admin.transactions.title")}
        description={t("admin.transactions.description")}
      />
      <TransactionsReport
        showShopFilter
        payoutDetailHref={(id) => `/admin/payouts/${id}`}
      />
    </>
  );
}

export default function AdminTransactionsPage() {
  return (
    <AuthGuard
      roles={["ADMIN", "SUPER_ADMIN", "ACCOUNTANT"]}
      permissions={["VIEW_TRANSACT"]}
    >
      <AdminTransactionsInner />
    </AuthGuard>
  );
}
