"use client";

import { useEffect } from "react";
import { useCartStore } from "@/lib/stores/cart-store";

export { useCart } from "@/lib/stores/cart-store";

export function CartProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    useCartStore.persist.rehydrate();
  }, []);

  return children;
}
