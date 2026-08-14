"use client";

import { AuthGuard } from "@/components/guards/AuthGuard";
import { TransactionsReport } from "@/components/finance/TransactionsReport";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { Container, PageHero } from "@/components/ui/shared";

function BuyerTransactionsInner() {
  const { t } = useLanguage();

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

/**
 * Buyer SELF purchase history — VIEW_TRANSACT.
 * Dual-role sellers keep this page (shop sales live under /seller/transactions).
 */
export default function BuyerTransactionsPage() {
  return (
    <AuthGuard roles={["BUYER", "SELLER"]} permissions={["VIEW_TRANSACT"]}>
      <BuyerTransactionsInner />
    </AuthGuard>
  );
}
