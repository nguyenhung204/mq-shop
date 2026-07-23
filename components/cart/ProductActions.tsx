"use client";

import type { MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Product } from "@/lib/data/products";
import { useFlyToCart } from "@/components/cart/FlyToCartProvider";
import { useCart } from "@/components/providers/CartProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";

export function ProductActions({ product }: { product: Product }) {
  const { addItem } = useCart();
  const { flyToCart } = useFlyToCart();
  const { t } = useLanguage();
  const router = useRouter();

  const handleAdd = (e: MouseEvent<HTMLButtonElement>) => {
    const ok = addItem(product);
    if (!ok) return;
    flyToCart(product.image, e.currentTarget);
  };

  const handleBuyNow = (e: MouseEvent<HTMLButtonElement>) => {
    const ok = addItem(product);
    if (!ok) return;
    flyToCart(product.image, e.currentTarget);
    toast.success(t("cart.added"), { description: product.name });
    router.push("/checkout");
  };

  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-6">
      <button type="button" className="mq-btn mq-btn-primary flex-1" onClick={handleAdd}>
        {t("common.addToCart")}
      </button>
      <button type="button" className="mq-btn mq-btn-outline flex-1" onClick={handleBuyNow}>
        {t("product.buyNow")}
      </button>
    </div>
  );
}
