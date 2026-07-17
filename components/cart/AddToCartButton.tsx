"use client";

import type { MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Product } from "@/lib/data/products";
import { useFlyToCart } from "@/components/cart/FlyToCartProvider";
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
  const { flyToCart } = useFlyToCart();
  const { t } = useLanguage();
  const router = useRouter();
  const buttonLabel = label ?? t("common.addToCart");

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    addItem(product);
    flyToCart(product.image, e.currentTarget);

    if (buyNow) {
      toast.success(t("cart.added"), { description: product.name });
      router.push("/checkout");
    }
  };

  return (
    <button type="button" className={className} onClick={handleClick}>
      {buttonLabel}
    </button>
  );
}
