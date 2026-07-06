"use client";

import { useState } from "react";
import { MessageCircle, Package, Undo2, type LucideIcon } from "lucide-react";
import { Container, PageHero } from "@/components/ui/shared";

const faqs = [
  {
    q: "What is your return policy?",
    a: "We offer hassle-free returns within 14 days of delivery. Items must be unused and in original packaging. Contact our support team to initiate a return.",
  },
  {
    q: "How long does shipping take?",
    a: "Standard shipping takes 3–5 business days. Express shipping (1–2 days) is available at checkout. Free shipping on orders over $75.",
  },
  {
    q: "Do you ship internationally?",
    a: "Yes, we ship to over 40 countries worldwide. International shipping rates and delivery times vary by destination.",
  },
  {
    q: "How can I track my order?",
    a: "Once your order ships, you'll receive a tracking number via email. You can also track orders from your account dashboard.",
  },
];

const faqsExtended = [
  {
    q: "What payment methods do you accept?",
    a: "We accept Visa, Mastercard, American Express, PayPal, Apple Pay, and Google Pay. We also offer Klarna and Afterpay for flexible payments.",
  },
  {
    q: "Are MQ products authentic?",
    a: "Every product in our collection is 100% authentic. We work directly with brands and authorized distributors to ensure quality and authenticity.",
  },
  {
    q: "Can I modify or cancel my order?",
    a: "Orders can be modified or cancelled within 1 hour of placement. After that, please contact support and we'll do our best to help.",
  },
  {
    q: "Do you offer gift wrapping?",
    a: "Yes! Select gift wrapping at checkout for $5. Our premium MQ gift boxes are also available for select items.",
  },
];

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
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [openIndex2, setOpenIndex2] = useState<number | null>(null);

  return (
    <>
      <PageHero title="FAQs" breadcrumb={[{ label: "FAQs" }]} />
      <Container className="py-12 md:py-20 max-w-3xl mx-auto">
        <div className="mb-12">
          {faqs.map((faq, i) => (
            <AccordionItem
              key={faq.q}
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
              { icon: Package, title: "Shipping", desc: "Fast & reliable delivery" },
              { icon: Undo2, title: "Returns", desc: "14-day hassle-free returns" },
              { icon: MessageCircle, title: "Support", desc: "We're here to help 7 days a week" },
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

        <h2 className="text-xl text-mq-text mb-6">More Questions</h2>
        <div>
          {faqsExtended.map((faq, i) => (
            <AccordionItem
              key={faq.q}
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
