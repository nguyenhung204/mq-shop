"use client";

import type { MouseEvent } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Product } from "@/lib/data/products";
import { resolveProductForCart } from "@/lib/cart/resolveProductForCart";
import { ApiError } from "@/lib/api/client";
import { useFlyToCart } from "@/components/cart/FlyToCartProvider";
import { useCart } from "@/components/providers/CartProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { getErrorMessage } from "@/lib/queries/utils";

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
  const { t, locale } = useLanguage();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const buttonLabel = label ?? t("common.addToCart");

  const handleClick = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    const target = e.currentTarget;
    try {
      // Listing cards lack variants — resolve PDP and default to first in-stock SKU.
      const resolved = await resolveProductForCart(product);
      if ((resolved.inStock ?? 0) <= 0) {
        toast.error(t("product.outOfStock") || "Out of stock");
        return;
      }
      const ok = addItem(resolved);
      if (!ok) return;
      flyToCart(resolved.image || product.image, target);
      if (buyNow) {
        toast.success(t("cart.added"), { description: resolved.name });
        router.push("/checkout");
      }
    } catch (err) {
      toast.error(getErrorMessage(err, t("cart.addFailed"), locale));
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      className={className}
      disabled={busy}
      onClick={(e) => void handleClick(e)}
    >
      {busy ? "…" : buttonLabel}
    </button>
  );
}
