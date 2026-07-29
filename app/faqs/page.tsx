"use client";

import { useState } from "react";
import { MessageCircle, Package, Undo2, type LucideIcon } from "lucide-react";
import { Container, PageHero } from "@/components/ui/shared";
import { useLanguage } from "@/components/providers/LanguageProvider";

function AccordionItem({
  question,
  answer,
  open,
  onToggle,
}: {
  question: string;
  answer: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-mq-border">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between py-5 text-left"
      >
        <span className="text-base font-medium text-mq-text pr-4">{question}</span>
        <span className="text-xl text-mq-text-muted shrink-0">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="pb-5 text-sm text-mq-text-secondary leading-relaxed">
          {answer}
        </div>
      )}
    </div>
  );
}

export default function FAQsPage() {
  const { t } = useLanguage();
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [openIndex2, setOpenIndex2] = useState<number | null>(null);

  const faqs = [
    { q: t("faqsPage.q1"), a: t("faqsPage.a1") },
    { q: t("faqsPage.q2"), a: t("faqsPage.a2") },
    { q: t("faqsPage.q3"), a: t("faqsPage.a3") },
    { q: t("faqsPage.q4"), a: t("faqsPage.a4") },
  ];

  const faqsExtended = [
    { q: t("faqsPage.q5"), a: t("faqsPage.a5") },
    { q: t("faqsPage.q6"), a: t("faqsPage.a6") },
    { q: t("faqsPage.q7"), a: t("faqsPage.a7") },
    { q: t("faqsPage.q8"), a: t("faqsPage.a8") },
  ];

  return (
    <>
      <PageHero title={t("faqsPage.title")} breadcrumb={[{ label: t("faqsPage.title") }]} />
      <Container className="py-12 md:py-20 max-w-3xl mx-auto">
        <div className="mb-12">
          {faqs.map((faq, i) => (
            <AccordionItem
              key={i}
              question={faq.q}
              answer={faq.a}
              open={openIndex === i}
              onToggle={() => setOpenIndex(openIndex === i ? null : i)}
            />
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {(
            [
              { icon: Package, title: t("faqsPage.shipping"), desc: t("faqsPage.shippingDesc") },
              { icon: Undo2, title: t("faqsPage.returns"), desc: t("faqsPage.returnsDesc") },
              { icon: MessageCircle, title: t("faqsPage.supportTitle"), desc: t("faqsPage.supportDesc") },
            ] as { icon: LucideIcon; title: string; desc: string }[]
          ).map((box) => {
            const Icon = box.icon;
            return (
            <div key={box.title} className="text-center p-6 border border-mq-border">
              <Icon className="w-8 h-8 mx-auto mb-3 text-mq-text" strokeWidth={1.5} />
              <h3 className="font-medium text-mq-text">{box.title}</h3>
              <p className="text-sm text-mq-text-secondary mt-1">{box.desc}</p>
            </div>
            );
          })}
        </div>

        <h2 className="text-xl text-mq-text mb-6">{t("faqsPage.moreQuestions")}</h2>
        <div>
          {faqsExtended.map((faq, i) => (
            <AccordionItem
              key={i}
              question={faq.q}
              answer={faq.a}
              open={openIndex2 === i}
              onToggle={() => setOpenIndex2(openIndex2 === i ? null : i)}
            />
          ))}
        </div>
      </Container>
    </>
  );
}
