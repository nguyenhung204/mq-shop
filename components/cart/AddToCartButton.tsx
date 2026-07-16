"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
  const buttonLabel = label ?? t("common.addToCart");

  const handleClick = () => {
    addItem(product);
    if (buyNow) {
      toast.success(t("cart.added"), { description: product.name });
      router.push("/checkout");
      return;
    }
    toast.success(t("cart.added"), { description: product.name });
  };

  return (
    <button type="button" className={className} onClick={handleClick}>
      {buttonLabel}
    </button>
  );
}
