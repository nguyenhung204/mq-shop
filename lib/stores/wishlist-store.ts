"use client";

import { useMemo } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Product } from "@/lib/data/products";

export type WishlistItem = {
  productId: string;
  slug: string;
  name: string;
  image: string;
  price: number;
  minPrice?: number;
  maxPrice?: number;
  originalPrice?: number;
  rating: number;
  addedAt: number;
};

type WishlistActions = {
  addItem: (product: Product) => void;
  removeItem: (productId: string) => void;
  toggleItem: (product: Product) => void;
  isInWishlist: (productId: string) => boolean;
  clearWishlist: () => void;
};

type WishlistState = {
  items: WishlistItem[];
} & WishlistActions;

function resolveItem(product: Product): WishlistItem {
  return {
    productId: product.id,
    slug: product.slug,
    name: product.name,
    image: product.image,
    price: product.price,
    minPrice: product.minPrice,
    maxPrice: product.maxPrice,
    originalPrice: product.originalPrice,
    rating: product.rating,
    addedAt: Date.now(),
  };
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (product) => {
        const { items } = get();
        if (items.some((i) => i.productId === product.id)) return;
        set({ items: [resolveItem(product), ...items] });
      },

      removeItem: (productId) => {
        set((state) => ({
          items: state.items.filter((i) => i.productId !== productId),
        }));
      },

      toggleItem: (product) => {
        const { items } = get();
        const exists = items.some((i) => i.productId === product.id);
        if (exists) {
          set({ items: items.filter((i) => i.productId !== product.id) });
        } else {
          set({ items: [resolveItem(product), ...items] });
        }
      },

      isInWishlist: (productId) => get().items.some((i) => i.productId === productId),

      clearWishlist: () => set({ items: [] }),
    }),
    {
      name: "mq-wishlist-v1",
      skipHydration: true,
      partialize: (state) => ({ items: state.items }),
    },
  ),
);

export function useWishlist() {
  const items = useWishlistStore((s) => s.items);
  const addItem = useWishlistStore((s) => s.addItem);
  const removeItem = useWishlistStore((s) => s.removeItem);
  const toggleItem = useWishlistStore((s) => s.toggleItem);
  const clearWishlist = useWishlistStore((s) => s.clearWishlist);

  const itemCount = useMemo(() => items.length, [items]);
  const wishlistIds = useMemo(
    () => new Set(items.map((i) => i.productId)),
    [items],
  );

  return {
    items,
    addItem,
    removeItem,
    toggleItem,
    clearWishlist,
    itemCount,
    isInWishlist: (productId: string) => wishlistIds.has(productId),
  };
}
