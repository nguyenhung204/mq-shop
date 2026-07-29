"use client";

import { useState } from "react";
import { Container, PageHero } from "@/components/ui/shared";
import { useLanguage } from "@/components/providers/LanguageProvider";

export default function TabsPage() {
  const { t } = useLanguage();
  const [active, setActive] = useState("description");

  const tabs = [
    { id: "description", labelKey: "tabsPage.descriptionLabel", contentKey: "tabsPage.descriptionContent" },
    { id: "details", labelKey: "tabsPage.detailsLabel", contentKey: "tabsPage.detailsContent" },
    { id: "shipping", labelKey: "tabsPage.shippingLabel", contentKey: "tabsPage.shippingContent" },
    { id: "reviews", labelKey: "tabsPage.reviewsLabel", contentKey: "tabsPage.reviewsContent" },
  ];

  return (
    <>
      <PageHero title={t("tabsPage.title")} breadcrumb={[{ label: t("tabsPage.title") }]} />
      <Container className="py-12 md:py-20 max-w-3xl mx-auto">
        <div className="flex gap-6 border-b border-mq-border mb-8 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActive(tab.id)}
              className={`pb-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                active === tab.id
                  ? "border-mq-primary text-mq-text"
                  : "border-transparent text-mq-text-muted hover:text-mq-text"
              }`}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>
        <div className="text-mq-text-secondary text-sm leading-relaxed">
          {t(tabs.find((tab) => tab.id === active)?.contentKey ?? "")}
        </div>
      </Container>
    </>
  );
}
