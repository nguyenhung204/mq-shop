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

export function ProductActions({ product }: { product: Product }) {
  const { addItem } = useCart();
  const { flyToCart } = useFlyToCart();
  const { t } = useLanguage();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const addResolved = async (e: MouseEvent<HTMLButtonElement>, buyNow: boolean) => {
    if (busy) return;
    setBusy(true);
    const target = e.currentTarget;
    try {
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
      toast.error(
        err instanceof ApiError ? err.message : "Could not add this product to cart.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-6">
      <button
        type="button"
        className="mq-btn mq-btn-primary flex-1"
        disabled={busy}
        onClick={(e) => void addResolved(e, false)}
      >
        {busy ? "…" : t("common.addToCart")}
      </button>
      <button
        type="button"
        className="mq-btn mq-btn-outline flex-1"
        disabled={busy}
        onClick={(e) => void addResolved(e, true)}
      >
        {t("product.buyNow")}
      </button>
    </div>
  );
}
