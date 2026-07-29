"use client";

import { Container, PageHero } from "@/components/ui/shared";
import { useLanguage } from "@/components/providers/LanguageProvider";

export default function PrivacyPage() {
  const { t } = useLanguage();

  return (
    <>
      <PageHero title={t("privacyPage.title")} breadcrumb={[{ label: t("privacyPage.title") }]} />
      <Container className="py-12 md:py-20 max-w-3xl">
        <div className="space-y-6 text-mq-text-secondary text-sm leading-relaxed">
          <p>{t("privacyPage.lastUpdated")}</p>
          <h2 className="text-xl text-mq-text font-display">{t("privacyPage.introTitle")}</h2>
          <p>{t("privacyPage.introText")}</p>
          <h2 className="text-xl text-mq-text font-display">{t("privacyPage.collectTitle")}</h2>
          <p>{t("privacyPage.collectText")}</p>
          <h2 className="text-xl text-mq-text font-display">{t("privacyPage.useTitle")}</h2>
          <p>{t("privacyPage.useText")}</p>
          <h2 className="text-xl text-mq-text font-display">{t("privacyPage.securityTitle")}</h2>
          <p>{t("privacyPage.securityText")}</p>
          <h2 className="text-xl text-mq-text font-display">{t("privacyPage.rightsTitle")}</h2>
          <p>{t("privacyPage.rightsText")}</p>
          <h2 className="text-xl text-mq-text font-display">{t("privacyPage.contactTitle")}</h2>
          <p>{t("privacyPage.contactText")}</p>
        </div>
      </Container>
    </>
  );
}
