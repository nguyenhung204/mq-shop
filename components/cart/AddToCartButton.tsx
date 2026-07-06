"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Product } from "@/lib/data/products";
import { useCart } from "@/components/providers/CartProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";

export function AddToCartButton({
  product,
  className = "mq-btn mq-btn-primary w-full",
  label,
  buyNow = false,
}: {
  product: Product;
  className?: string;
  label?: string;
  buyNow?: boolean;
}) {
  const { addItem } = useCart();
  const { t } = useLanguage();
  const router = useRouter();
  const [feedback, setFeedback] = useState<string | null>(null);
  const buttonLabel = label ?? t("common.addToCart");

  const handleClick = () => {
    addItem(product);
    if (buyNow) {
      router.push("/checkout");
      return;
    }
    setFeedback(t("cart.added"));
    setTimeout(() => setFeedback(null), 1500);
  };

  return (
    <button type="button" className={className} onClick={handleClick}>
      {feedback ?? buttonLabel}
    </button>
  );
}
