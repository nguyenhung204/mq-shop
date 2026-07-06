"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Product } from "@/lib/data/products";
import { useCart } from "@/components/providers/CartProvider";

export function AddToCartButton({
  product,
  className = "mq-btn mq-btn-primary w-full",
  label = "Add To Cart",
  buyNow = false,
}: {
  product: Product;
  className?: string;
  label?: string;
  buyNow?: boolean;
}) {
  const { addItem } = useCart();
  const router = useRouter();
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleClick = () => {
    addItem(product);
    if (buyNow) {
      router.push("/checkout");
      return;
    }
    setFeedback("Added!");
    setTimeout(() => setFeedback(null), 1500);
  };

  return (
    <button type="button" className={className} onClick={handleClick}>
      {feedback ?? label}
    </button>
  );
}
