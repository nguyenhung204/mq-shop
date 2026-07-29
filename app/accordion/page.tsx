"use client";

import { useState } from "react";
import { Container, PageHero } from "@/components/ui/shared";
import { useLanguage } from "@/components/providers/LanguageProvider";

export default function AccordionPage() {
  const { t } = useLanguage();
  const [open, setOpen] = useState<number | null>(0);

  const items = [
    { q: t("accordionPage.q1"), a: t("accordionPage.a1") },
    { q: t("accordionPage.q2"), a: t("accordionPage.a2") },
    { q: t("accordionPage.q3"), a: t("accordionPage.a3") },
  ];

  return (
    <>
      <PageHero title={t("accordionPage.title")} breadcrumb={[{ label: t("accordionPage.title") }]} />
      <Container className="py-12 md:py-20 max-w-2xl mx-auto">
        {items.map((item, i) => (
          <div key={i} className="border-b border-mq-border">
            <button
              type="button"
              onClick={() => setOpen(open === i ? null : i)}
              className="w-full flex justify-between items-center py-5 text-left"
            >
              <span className="font-medium text-mq-text">{item.q}</span>
              <span className="text-mq-text-muted">{open === i ? "−" : "+"}</span>
            </button>
            {open === i && (
              <p className="pb-5 text-sm text-mq-text-secondary">{item.a}</p>
            )}
          </div>
        ))}
      </Container>
    </>
  );
}
