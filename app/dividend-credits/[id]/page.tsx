"use client";

import Link from "next/link";
import { use } from "react";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { CreditDetailView } from "@/components/dividend/CreditDetailView";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { Container, PageHero } from "@/components/ui/shared";
import { useMyDividendCredit } from "@/lib/queries/dividend-settlements";
import { getErrorMessage } from "@/lib/queries/utils";

function Inner({ id }: { id: string }) {
  const { t } = useLanguage();
  const { data, isLoading, isError, error } = useMyDividendCredit(id);
  return (
    <>
      <PageHero title={t("dividendCredits.detailTitle")} />
      <Container className="py-8 space-y-4">
        <Link href="/dividend-credits" className="text-sm underline">
          {t("dividendCredits.back")}
        </Link>
        {isLoading ? <p className="text-sm text-mq-text-muted">{t("admin.common.loading")}</p> : null}
        {isError ? <div className="mq-alert mq-alert-error">{getErrorMessage(error, t("admin.common.failed"))}</div> : null}
        {data ? <CreditDetailView item={data} /> : null}
      </Container>
    </>
  );
}

export default function DividendCreditDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AuthGuard>
      <Inner id={id} />
    </AuthGuard>
  );
}
