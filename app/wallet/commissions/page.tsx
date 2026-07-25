"use client";

import { AuthGuard } from "@/components/guards/AuthGuard";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { Container, PageHero } from "@/components/ui/shared";

function CommissionsPlaceholder() {
  const { t } = useLanguage();
  return (
    <>
      <PageHero
        title={t("wallet.commissions")}
        breadcrumb={[
          { label: t("wallet.title"), href: "/wallet" },
          { label: t("wallet.commissions") },
        ]}
      />
      <Container className="py-10 max-w-3xl mx-auto">
        <p className="text-sm text-mq-text-muted">{t("wallet.commissionsComingSoon")}</p>
      </Container>
    </>
  );
}

export default function WalletCommissionsPage() {
  return (
    <AuthGuard>
      <CommissionsPlaceholder />
    </AuthGuard>
  );
}
