"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Product } from "@/lib/data/products";
import { useCart } from "@/components/providers/CartProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";

export function ProductActions({ product }: { product: Product }) {
  const { addItem } = useCart();
  const { t } = useLanguage();
  const router = useRouter();

  const handleAdd = () => {
    addItem(product);
    toast.success(t("cart.added"), { description: product.name });
  };

  const handleBuyNow = () => {
    addItem(product);
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
