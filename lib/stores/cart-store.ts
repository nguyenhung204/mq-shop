"use client";

import { useMemo } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { toast } from "sonner";
import { tt } from "@/lib/i18n/tt";
import { Product, formatPrice } from "@/lib/data/products";

export type CartLine = {
  variantId: string;
  productId: string;
  shopId: string;
  sku: string;
  name: string;
  unitPrice: number;
  image: string;
  quantity: number;
  slug?: string;
};

/** @deprecated Use CartLine */
export type CartItem = CartLine;

type CartActions = {
  /** Add from PDP Product (uses selectedVariantId). Returns false if blocked (multi-shop). */
  addItem: (product: Product, quantity?: number) => boolean;
  removeItem: (variantId: string) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  clearCart: () => void;
};

type CartState = {
  items: CartLine[];
} & CartActions;

function resolveLine(product: Product, quantity: number): CartLine | null {
  const variantId =
    product.selectedVariantId ||
    product.variants?.find((v) => v.availableStock > 0)?.id ||
    product.variants?.[0]?.id;
  if (!variantId) return null;
  const variant = product.variants?.find((v) => v.id === variantId);
  const shopId = product.shopId?.trim();
  if (!shopId) return null;
  return {
    variantId,
    productId: product.id,
    shopId,
    sku: variant?.sku || product.id.slice(0, 8),
    name: product.name,
    unitPrice: variant?.price ?? product.price,
    image: variant?.images?.[0] || product.image,
    quantity,
    slug: product.slug,
  };
}

export type AddItemFailReason = "no_variant" | "no_shop" | "multi_shop";

export function explainAddItemFailure(product: Product): AddItemFailReason | null {
  const variantId =
    product.selectedVariantId ||
    product.variants?.find((v) => v.availableStock > 0)?.id ||
    product.variants?.[0]?.id;
  if (!variantId) return "no_variant";
  if (!product.shopId?.trim()) return "no_shop";
  return null;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (product, quantity = 1) => {
        const line = resolveLine(product, quantity);
        if (!line) {
          const reason = explainAddItemFailure(product);
          toast.error(
            reason === "no_shop"
              ? tt("cart.noShop")
              : tt("cart.noSku"),
          );
          return false;
        }
        const { items } = get();
        if (items.length > 0 && items[0].shopId !== line.shopId) {
          toast.error(tt("cart.multiShop"));
          return false;
        }
        const existing = items.find((i) => i.variantId === line.variantId);
        if (existing) {
          set({
            items: items.map((i) =>
              i.variantId === line.variantId
                ? { ...i, quantity: i.quantity + quantity }
                : i,
            ),
          });
        } else {
          set({ items: [...items, line] });
        }
        return true;
      },

      removeItem: (variantId) => {
        set((state) => ({
          items: state.items.filter((i) => i.variantId !== variantId),
        }));
      },

      updateQuantity: (variantId, quantity) => {
        if (quantity < 1) {
          set((state) => ({
            items: state.items.filter((i) => i.variantId !== variantId),
          }));
          return;
        }
        set((state) => ({
          items: state.items.map((i) =>
            i.variantId === variantId ? { ...i, quantity } : i,
          ),
        }));
      },

      clearCart: () => set({ items: [] }),
    }),
    {
      name: "mq-cart-v2",
      skipHydration: true,
      partialize: (state) => ({ items: state.items }),
    },
  ),
);

export function useCart() {
  const items = useCartStore((s) => s.items);
  const addItem = useCartStore((s) => s.addItem);
  const removeItem = useCartStore((s) => s.removeItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const clearCart = useCartStore((s) => s.clearCart);

  const itemCount = useMemo(
    () => items.reduce((sum, i) => sum + i.quantity, 0),
    [items],
  );

  const subtotal = useMemo(
    () => items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0),
    [items],
  );

  const shopId = items[0]?.shopId ?? null;

  return {
    items,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    itemCount,
    subtotal,
    shopId,
    formatSubtotal: () => formatPrice(subtotal),
    checkoutItems: () =>
      items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
  };
}
