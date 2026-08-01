"use client";

import { useEffect } from "react";
import { useWishlistStore } from "@/lib/stores/wishlist-store";

export type { WishlistItem } from "@/lib/stores/wishlist-store";
export { useWishlist } from "@/lib/stores/wishlist-store";

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    useWishlistStore.persist.rehydrate();
  }, []);

  return children;
}
