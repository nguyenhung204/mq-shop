"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { TransactionsReport } from "@/components/finance/TransactionsReport";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { Container, PageHero } from "@/components/ui/shared";

function BuyerTransactionsInner() {
  const { t } = useLanguage();
  const { hasRole, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (hasRole("ACCOUNTANT") || hasRole("ADMIN") || hasRole("SUPER_ADMIN")) {
      router.replace("/admin/transactions");
      return;
    }
    if (hasRole("SELLER")) {
      router.replace("/seller/transactions");
    }
  }, [loading, hasRole, router]);

  if (
    hasRole("SELLER") ||
    hasRole("ACCOUNTANT") ||
    hasRole("ADMIN") ||
    hasRole("SUPER_ADMIN")
  ) {
    return (
      <div className="mq-container py-20 text-center text-mq-text-muted text-sm">
        {t("admin.common.loading")}
      </div>
    );
  }

  return (
    <>
      <PageHero
        title={t("transactions.title")}
        breadcrumb={[{ label: t("transactions.title") }]}
      />
      <Container className="py-10 md:py-14">
        <TransactionsReport buyerMode />
      </Container>
    </>
  );
}

/** Buyer SELF history — VIEW_TRANSACT; no EXPORT_REPORT. */
export default function BuyerTransactionsPage() {
  return (
    <AuthGuard roles={["BUYER"]} permissions={["VIEW_TRANSACT"]}>
      <BuyerTransactionsInner />
    </AuthGuard>
  );
}
