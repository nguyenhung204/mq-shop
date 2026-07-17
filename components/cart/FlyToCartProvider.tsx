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

type Rect = { x: number; y: number; w: number; h: number };

type Flyer = {
  id: string;
  image: string;
  from: Rect;
  to: Rect;
};

type FlyToCartContextValue = {
  flyToCart: (image: string, source?: Element | null) => void;
};

const FlyToCartContext = createContext<FlyToCartContextValue | null>(null);

function toRect(r: DOMRect): Rect {
  return { x: r.left, y: r.top, w: Math.max(r.width, 1), h: Math.max(r.height, 1) };
}

function getCartRect(): Rect | null {
  const el = document.getElementById(CART_TARGET_ID);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
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

function bumpCartTarget() {
  const el = document.getElementById(CART_TARGET_ID);
  if (!el) return;
  el.classList.remove("mq-cart-bump");
  void el.offsetWidth;
  el.classList.add("mq-cart-bump");
  window.setTimeout(() => el.classList.remove("mq-cart-bump"), 520);
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

    const { from, to } = flyer;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const midX = dx * 0.4;
    const midY = Math.min(dy * 0.35, dy) - 60;
    const endScale = Math.min(to.w / from.w, to.h / from.h, 0.22);

    el.style.left = `${from.x}px`;
    el.style.top = `${from.y}px`;
    el.style.width = `${from.w}px`;
    el.style.height = `${from.h}px`;
    el.style.transformOrigin = "top left";
    el.style.opacity = "1";
    el.style.transform = "translate3d(0,0,0) scale(1) rotate(0deg)";

    const animation = el.animate(
      [
        {
          transform: "translate3d(0,0,0) scale(1) rotate(0deg)",
          opacity: 1,
          offset: 0,
        },
        {
          transform: `translate3d(${midX}px, ${midY}px, 0) scale(0.78) rotate(-10deg)`,
          opacity: 1,
          offset: 0.42,
        },
        {
          transform: `translate3d(${dx}px, ${dy}px, 0) scale(${endScale}) rotate(14deg)`,
          opacity: 0.15,
          offset: 1,
        },
      ],
      {
        duration: 820,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "forwards",
      },
    );

    animation.onfinish = () => {
      bumpCartTarget();
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

  const flyToCart = useCallback((image: string, source?: Element | null) => {
    if (typeof window === "undefined") return;

    const to = getCartRect();
    if (!to) {
      bumpCartTarget();
      return;
    }

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      bumpCartTarget();
      return;
    }

    const from = resolveSourceRect(source);
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setFlyers((prev) => [...prev, { id, image, from, to }]);
  }, []);

  const value = useMemo(() => ({ flyToCart }), [flyToCart]);

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
