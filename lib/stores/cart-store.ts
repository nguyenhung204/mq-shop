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
  shopName?: string;
  sku: string;
  name: string;
  unitPrice: number;
  /** Original price before discount, if any. */
  originalPrice?: number;
  image: string;
  quantity: number;
  slug?: string;
  /** Variant option labels, e.g. { Màu: "Đỏ", Size: "M" } */
  variantOptions?: Record<string, string>;
  /** Available stock for low-stock / OOS display. */
  inStock?: number;
};

/** @deprecated Use CartLine */
export type CartItem = CartLine;

type CartActions = {
  /** Add from PDP Product (uses selectedVariantId). Returns false if blocked (multi-shop). */
  addItem: (product: Product, quantity?: number) => boolean;
  removeItem: (variantId: string) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  clearCart: () => void;
  /**
   * Persist the user's line-item selection across the cart → checkout navigation.
   * Pass `null` to clear (fall back to all items at checkout).
   * Not persisted to localStorage — session only.
   */
  setSelectedVariantIds: (ids: string[] | null) => void;
};

type CartState = {
  items: CartLine[];
  /** Transient: variantIds the user checked on the cart page. null = "all". */
  selectedVariantIds: string[] | null;
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
    shopName: product.shop?.name,
    sku: variant?.sku || product.id.slice(0, 8),
    name: product.name,
    unitPrice: variant?.price ?? product.price,
    originalPrice: product.originalPrice,
    image: variant?.images?.[0] || product.image,
    quantity,
    slug: product.slug,
    variantOptions: variant?.options ?? undefined,
    inStock: variant?.availableStock ?? product.inStock,
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
      selectedVariantIds: null,

      setSelectedVariantIds: (ids) => set({ selectedVariantIds: ids }),

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

      clearCart: () => set({ items: [], selectedVariantIds: null }),
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
  const selectedVariantIds = useCartStore((s) => s.selectedVariantIds);
  const addItem = useCartStore((s) => s.addItem);
  const removeItem = useCartStore((s) => s.removeItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const clearCart = useCartStore((s) => s.clearCart);
  const setSelectedVariantIds = useCartStore((s) => s.setSelectedVariantIds);

  const itemCount = useMemo(
    () => items.reduce((sum, i) => sum + i.quantity, 0),
    [items],
  );

  const subtotal = useMemo(
    () => items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0),
    [items],
  );

  /** Items the user selected on the cart page (falls back to all items). */
  const selectedItems = useMemo(() => {
    if (!selectedVariantIds) return items;
    const idSet = new Set(selectedVariantIds);
    const filtered = items.filter((i) => idSet.has(i.variantId));
    return filtered.length > 0 ? filtered : items;
  }, [items, selectedVariantIds]);

  const selectedSubtotal = useMemo(
    () => selectedItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0),
    [selectedItems],
  );

  const selectedItemCount = useMemo(
    () => selectedItems.reduce((sum, i) => sum + i.quantity, 0),
    [selectedItems],
  );

  const shopId = items[0]?.shopId ?? null;
  const shopIds = useMemo(() => [...new Set(items.map((i) => i.shopId))], [items]);

  /** Distinct shop IDs among the *selected* lines (used for multi-shop guard at checkout). */
  const selectedShopIds = useMemo(
    () => [...new Set(selectedItems.map((i) => i.shopId))],
    [selectedItems],
  );

  return {
    items,
    selectedItems,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    setSelectedVariantIds,
    itemCount,
    selectedItemCount,
    subtotal,
    selectedSubtotal,
    shopId,
    shopIds,
    selectedShopIds,
    formatSubtotal: () => formatPrice(subtotal),
    checkoutItems: () =>
      items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
    /** Returns only the selected lines mapped to checkout payload shape. */
    checkoutSelectedItems: () =>
      selectedItems.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
  };
}
