"use client";

import { AuthGuard } from "@/components/guards/AuthGuard";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { Container, PageHero } from "@/components/ui/shared";

function NetworkPlaceholder() {
  const { t } = useLanguage();
  return (
    <>
      <PageHero
        title={t("wallet.network")}
        breadcrumb={[
          { label: t("wallet.title"), href: "/wallet" },
          { label: t("wallet.network") },
        ]}
      />
      <Container className="py-10 max-w-3xl mx-auto">
        <p className="text-sm text-mq-text-muted">{t("wallet.networkComingSoon")}</p>
      </Container>
    </>
  );
}

export default function MlmNetworkPage() {
  return (
    <AuthGuard>
      <NetworkPlaceholder />
    </AuthGuard>
  );
}
