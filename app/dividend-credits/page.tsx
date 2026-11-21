"use client";

import { useState } from "react";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { ItemsTable } from "@/components/dividend/SettlementViews";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { Container, PageHero } from "@/components/ui/shared";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { OrderListSkeleton } from "@/components/ui/Skeleton";
import { useMyDividendCredits } from "@/lib/queries/dividend-settlements";
import { getErrorMessage } from "@/lib/queries/utils";

function Inner() {
  const { t } = useLanguage();
  const [page, setPage] = useState(1);
  const list = useMyDividendCredits(page);
  const items = list.data?.items ?? [];
  return (
    <>
      <PageHero title={t("dividendCredits.title")} />
      <Container className="py-8 space-y-4">
        <p className="text-sm text-mq-text-muted">{t("dividendCredits.intro")}</p>
        {list.isLoading ? <OrderListSkeleton /> : null}
        {list.isError ? <div className="mq-alert mq-alert-error">{getErrorMessage(list.error, t("admin.common.failed"))}</div> : null}
        {!list.isLoading && !list.isError && items.length === 0 ? <p className="text-sm text-mq-text-muted">{t("dividendCredits.empty")}</p> : null}
        {items.length > 0 ? <ItemsTable items={items} owner /> : null}
        <PaginationBar page={page} meta={list.data?.meta} onPageChange={setPage} />
      </Container>
    </>
  );
}

export default function DividendCreditsPage() {
  return (
    <AuthGuard>
      <Inner />
    </AuthGuard>
  );
}
