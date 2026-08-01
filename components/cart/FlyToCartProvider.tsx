"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

export const CART_TARGET_ID = "mq-cart-target";
export const WISHLIST_TARGET_ID = "mq-wishlist-target";

type Rect = { x: number; y: number; w: number; h: number };

type Flyer = {
  id: string;
  image: string;
  from: Rect;
  to: Rect;
  targetId: string;
};

type FlyToCartContextValue = {
  flyToCart: (image: string, source?: Element | null) => void;
  flyToWishlist: (image: string, source?: Element | null) => void;
};

const FlyToCartContext = createContext<FlyToCartContextValue | null>(null);

function toRect(r: DOMRect): Rect {
  return { x: r.left, y: r.top, w: Math.max(r.width, 1), h: Math.max(r.height, 1) };
}

/** Multiple elements may share a target id (e.g. desktop + mobile nav); pick the visible one. */
function getTargetRect(targetId: string): Rect | null {
  const candidates = document.querySelectorAll(`[id="${targetId}"]`);
  let el: Element | null = null;
  for (const candidate of candidates) {
    const r = candidate.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      el = candidate;
      break;
    }
  }
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const size = 32;
  return {
    x: r.left + r.width / 2 - size / 2,
    y: r.top + r.height / 2 - size / 2,
    w: size,
    h: size,
  };
}

function resolveSourceRect(source?: Element | null): Rect {
  const root =
    (source instanceof Element &&
      (source.closest("[data-mq-fly-source]") ||
        source.closest("article") ||
        source.closest("[data-mq-product-gallery]"))) ||
    null;

  const img =
    (root?.querySelector("img") as HTMLElement | null) ||
    (document.querySelector("[data-mq-fly-source] img") as HTMLElement | null);

  if (img) {
    const r = img.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return toRect(r);
  }

  if (source instanceof HTMLElement) {
    const r = source.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return toRect(r);
  }

  const size = 80;
  return {
    x: window.innerWidth / 2 - size / 2,
    y: window.innerHeight * 0.45,
    w: size,
    h: size,
  };
}

function bumpTarget(targetId: string) {
  const elements = document.querySelectorAll(`[id="${targetId}"]`);
  elements.forEach((el) => {
    el.classList.remove("mq-cart-bump");
    void (el as HTMLElement).offsetWidth;
    el.classList.add("mq-cart-bump");
    window.setTimeout(() => el.classList.remove("mq-cart-bump"), 420);
  });
}

/** Shrink source rect to a calm thumbnail centered on the product image. */
function softStartRect(from: Rect): Rect {
  const size = Math.min(56, Math.max(40, Math.min(from.w, from.h) * 0.28));
  return {
    x: from.x + from.w / 2 - size / 2,
    y: from.y + from.h / 2 - size / 2,
    w: size,
    h: size,
  };
}

function FlyerItem({
  flyer,
  onDone,
}: {
  flyer: Flyer;
  onDone: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const from = softStartRect(flyer.from);
    const { to } = flyer;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const midX = dx * 0.45;
    const midY = dy * 0.4 - 28;
    const endScale = Math.min(to.w / from.w, to.h / from.h, 0.45);

    el.style.left = `${from.x}px`;
    el.style.top = `${from.y}px`;
    el.style.width = `${from.w}px`;
    el.style.height = `${from.h}px`;
    el.style.transformOrigin = "top left";
    el.style.opacity = "0";
    el.style.transform = "translate3d(0,0,0) scale(0.92)";

    const animation = el.animate(
      [
        {
          transform: "translate3d(0,0,0) scale(0.92)",
          opacity: 0,
          offset: 0,
        },
        {
          transform: "translate3d(0,0,0) scale(1)",
          opacity: 0.88,
          offset: 0.12,
        },
        {
          transform: `translate3d(${midX}px, ${midY}px, 0) scale(0.82)`,
          opacity: 0.75,
          offset: 0.55,
        },
        {
          transform: `translate3d(${dx}px, ${dy}px, 0) scale(${endScale})`,
          opacity: 0,
          offset: 1,
        },
      ],
      {
        duration: 1100,
        easing: "cubic-bezier(0.33, 0.1, 0.25, 1)",
        fill: "forwards",
      },
    );

    animation.onfinish = () => {
      bumpTarget(flyer.targetId);
      onDone(flyer.id);
    };

    return () => {
      animation.cancel();
    };
  }, [flyer, onDone]);

  return (
    <div ref={ref} className="mq-fly-item">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={flyer.image} alt="" draggable={false} />
    </div>
  );
}

export function FlyToCartProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [flyers, setFlyers] = useState<Flyer[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const removeFlyer = useCallback((id: string) => {
    setFlyers((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const flyTo = useCallback(
    (targetId: string, image: string, source?: Element | null) => {
      if (typeof window === "undefined") return;

      const to = getTargetRect(targetId);
      if (!to) {
        bumpTarget(targetId);
        return;
      }

      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce) {
        bumpTarget(targetId);
        return;
      }

      const from = resolveSourceRect(source);
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setFlyers((prev) => [...prev, { id, image, from, to, targetId }]);
    },
    [],
  );

  const flyToCart = useCallback(
    (image: string, source?: Element | null) => flyTo(CART_TARGET_ID, image, source),
    [flyTo],
  );

  const flyToWishlist = useCallback(
    (image: string, source?: Element | null) => flyTo(WISHLIST_TARGET_ID, image, source),
    [flyTo],
  );

  const value = useMemo(() => ({ flyToCart, flyToWishlist }), [flyToCart, flyToWishlist]);

  return (
    <FlyToCartContext.Provider value={value}>
      {children}
      {mounted &&
        createPortal(
          <div className="mq-fly-layer" aria-hidden>
            {flyers.map((f) => (
              <FlyerItem key={f.id} flyer={f} onDone={removeFlyer} />
            ))}
          </div>,
          document.body,
        )}
    </FlyToCartContext.Provider>
  );
}

export function useFlyToCart() {
  const ctx = useContext(FlyToCartContext);
  if (!ctx) throw new Error("useFlyToCart must be used within FlyToCartProvider");
  return ctx;
}
