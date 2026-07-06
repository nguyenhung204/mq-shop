"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Product } from "@/lib/data/products";
import { ProductCard } from "./ProductCard";

export function ProductCarousel({
  products,
  itemWidth = 240,
}: {
  products: Product[];
  itemWidth?: number;
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: -1 | 1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * (itemWidth + 20) * 2, behavior: "smooth" });
  };

  return (
    <div className="relative">
      <div className="flex justify-end mb-4 mq-carousel-nav">
        <button
          type="button"
          className="mq-carousel-btn"
          onClick={() => scroll(-1)}
          aria-label="Previous"
        >
          <ChevronLeft size={20} strokeWidth={1.5} />
        </button>
        <button
          type="button"
          className="mq-carousel-btn"
          onClick={() => scroll(1)}
          aria-label="Next"
        >
          <ChevronRight size={20} strokeWidth={1.5} />
        </button>
      </div>
      <div ref={trackRef} className="mq-carousel-track">
        {products.map((p) => (
          <div key={p.id} style={{ width: itemWidth }}>
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </div>
  );
}
