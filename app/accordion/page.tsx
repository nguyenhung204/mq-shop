"use client";

import { useState } from "react";
import { Container, PageHero } from "@/components/ui/shared";

const items = [
  {
    title: "What makes MQ different?",
    content:
      "Every product is hand-selected by our curation team. We prioritize quality materials, ethical sourcing, and timeless design over trends.",
  },
  {
    title: "How do I care for my products?",
    content:
      "Each product page includes specific care instructions. Generally, we recommend following the manufacturer's guidelines and storing items properly.",
  },
  {
    title: "Can I visit your showroom?",
    content:
      "Yes! Our flagship showroom is open Mon–Sat in New York. Book an appointment through our contact page for a personalized shopping experience.",
  },
];

export default function AccordionPage() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <>
      <PageHero title="Accordion" breadcrumb={[{ label: "Accordion" }]} />
      <Container className="py-12 md:py-20 max-w-2xl mx-auto">
        {items.map((item, i) => (
          <div key={item.title} className="border-b border-mq-border">
            <button
              type="button"
              onClick={() => setOpen(open === i ? null : i)}
              className="w-full flex justify-between items-center py-5 text-left"
            >
              <span className="font-medium text-mq-text">{item.title}</span>
              <span className="text-mq-text-muted">{open === i ? "−" : "+"}</span>
            </button>
            {open === i && (
              <p className="pb-5 text-sm text-mq-text-secondary">{item.content}</p>
            )}
          </div>
        ))}
      </Container>
    </>
  );
}
