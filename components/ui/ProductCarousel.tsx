"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Product } from "@/lib/data/products";
import { ProductCard } from "./ProductCard";

export function ProductCarousel({
  products,
  priorityCount = 0,
}: {
  products: Product[];
  priorityCount?: number;
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: -1 | 1) => {
    const el = trackRef.current;
    const first = el?.firstElementChild as HTMLElement | null;
    if (!el || !first) return;
    const itemWidth = first.offsetWidth;
    const styles = window.getComputedStyle(el);
    const gap = Number.parseFloat(styles.columnGap || styles.gap || "24") || 24;
    el.scrollBy({ left: dir * (itemWidth + gap) * 2, behavior: "smooth" });
  };

  return (
    <div className="relative">
      <div className="flex justify-end mb-4 mq-carousel-nav">
        <button
          type="button"
          className="mq-carousel-btn mq-icon-btn"
          onClick={() => scroll(-1)}
          aria-label="Previous"
        >
          <ChevronLeft size={20} strokeWidth={1.5} />
        </button>
        <button
          type="button"
          className="mq-carousel-btn mq-icon-btn"
          onClick={() => scroll(1)}
          aria-label="Next"
        >
          <ChevronRight size={20} strokeWidth={1.5} />
        </button>
      </div>
      <div ref={trackRef} className="mq-carousel-track">
        {products.map((p, i) => (
          <div key={p.id} className="mq-carousel-item">
            <ProductCard product={p} priority={i < priorityCount} />
          </div>
        ))}
      </div>
    </div>
  );
}
