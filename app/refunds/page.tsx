"use client";

import { useState } from "react";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { PartyCaseList } from "@/components/refund-cases/PartyCaseList";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { Container, PageHero } from "@/components/ui/shared";
import { useBuyerRefundCases } from "@/lib/queries/refund-cases";

function BuyerRefundsInner() {
  const { t } = useLanguage();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const list = useBuyerRefundCases(status, page);
  return (
    <>
      <PageHero title={t("refundCases.buyerPage.title")} />
      <Container className="py-8">
        <PartyCaseList side="buyer" list={list} status={status} onStatusChange={setStatus} page={page} onPageChange={setPage} />
      </Container>
    </>
  );
}

export default function BuyerRefundsPage() {
  return (
    <AuthGuard roles={["BUYER", "SELLER"]}>
      <BuyerRefundsInner />
    </AuthGuard>
  );
}
