"use client";

import { Product } from "@/lib/data/products";
import { useCart } from "@/components/providers/CartProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";

export function ProductActions({ product }: { product: Product }) {
  const { addItem } = useCart();
  const { t } = useLanguage();

  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-6">
      <button type="button" className="mq-btn mq-btn-primary flex-1" onClick={() => addItem(product)}>
        {t("common.addToCart")}
      </button>
      <button
        type="button"
        className="mq-btn mq-btn-outline flex-1"
        onClick={() => {
          addItem(product);
          window.location.href = "/checkout";
        }}
      >
        {t("product.buyNow")}
      </button>
    </div>
  );
}
