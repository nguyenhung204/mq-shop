"use client";

import { Product } from "@/lib/data/products";
import { useCart } from "@/components/providers/CartProvider";

export function ProductActions({ product }: { product: Product }) {
  const { addItem } = useCart();

  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-6">
      <button
        type="button"
        className="mq-btn mq-btn-primary flex-1"
        onClick={() => addItem(product)}
      >
        Add to cart
      </button>
      <button
        type="button"
        className="mq-btn mq-btn-outline flex-1"
        onClick={() => {
          addItem(product);
          window.location.href = "/checkout";
        }}
      >
        Buy now
      </button>
    </div>
  );
}
