"use client";

import type { MouseEvent } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Product } from "@/lib/data/products";
import { resolveProductForCart } from "@/lib/cart/resolveProductForCart";
import { ApiError } from "@/lib/api/client";
import { useFlyToCart } from "@/components/cart/FlyToCartProvider";
import { useCart } from "@/components/providers/CartProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { QuantityStepper } from "@/components/ui/QuantityStepper";

export function ProductActions({ product }: { product: Product }) {
  const { addItem } = useCart();
  const { flyToCart } = useFlyToCart();
  const { t } = useLanguage();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [qty, setQty] = useState(1);
  const maxStock = Math.max(1, product.inStock ?? 99);

  useEffect(() => {
    setQty((q) => Math.min(Math.max(1, q), maxStock));
  }, [maxStock, product.selectedVariantId]);

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
      const quantity = Math.min(qty, Math.max(1, resolved.inStock ?? qty));
      const ok = addItem(resolved, quantity);
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
    <div className="mb-6 space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-sm text-mq-text-muted">{t("product.quantity") || "Qty"}</span>
        <QuantityStepper
          value={qty}
          min={1}
          max={maxStock}
          onChange={setQty}
        />
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
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
    </div>
  );
}
