"use client";

import { useState } from "react";
import { Container, PageHero } from "@/components/ui/shared";

const tabs = [
  {
    id: "description",
    label: "Description",
    content:
      "MQ curates premium lifestyle goods designed for modern living. Each product is selected for its quality, craftsmanship, and timeless appeal.",
  },
  {
    id: "details",
    label: "Details",
    content:
      "Materials: Premium grade. Origin: Ethically sourced. Warranty: 1 year manufacturer warranty on all tech products. Care: See individual product pages.",
  },
  {
    id: "shipping",
    label: "Shipping",
    content:
      "Standard: 3–5 business days ($5.99). Express: 1–2 business days ($12.99). Free shipping on orders over $75. International rates vary.",
  },
  {
    id: "reviews",
    label: "Reviews",
    content:
      "Our customers love MQ. Average rating: 4.8/5 stars across 2,000+ reviews. \"Best online shopping experience I've had.\" — Verified Buyer",
  },
];

export default function TabsPage() {
  const [active, setActive] = useState("description");

  return (
    <>
      <PageHero title="Tabs" breadcrumb={[{ label: "Tabs" }]} />
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
              {tab.label}
            </button>
          ))}
        </div>
        <div className="text-mq-text-secondary text-sm leading-relaxed">
          {tabs.find((t) => t.id === active)?.content}
        </div>
      </Container>
    </>
  );
}
