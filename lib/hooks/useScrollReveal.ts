"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

type RevealCallback = () => void;

let sharedObserver: IntersectionObserver | null = null;
const revealCallbacks = new WeakMap<Element, RevealCallback>();

function getSharedObserver(): IntersectionObserver | null {
  if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") {
    return null;
  }
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const cb = revealCallbacks.get(entry.target);
            if (cb) {
              cb();
              revealCallbacks.delete(entry.target);
            }
            sharedObserver?.unobserve(entry.target);
          }
        }
      },
      {
        rootMargin: "0px 0px -20px 0px",
        threshold: 0.05,
      }
    );
  }
  return sharedObserver;
}

export function calculateStaggerDelay(
  index: number | undefined,
  baseDelay: number = 50,
  maxColumns: number = 4
): number {
  if (index === undefined || Number.isNaN(index)) return 0;
  const col = Math.abs(index) % maxColumns;
  return col * baseDelay;
}

export interface UseScrollRevealOptions {
  index?: number;
  disabled?: boolean;
  baseDelay?: number;
  maxColumns?: number;
  duration?: number;
}

export function useScrollReveal<T extends HTMLElement = HTMLElement>(
  options: UseScrollRevealOptions = {}
) {
  const {
    index,
    disabled = false,
    baseDelay = 50,
    maxColumns = 4,
    duration = 650,
  } = options;

  const elementRef = useRef<T | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (disabled) {
      setIsRevealed(true);
      return;
    }

    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setIsRevealed(true);
      return;
    }

    const el = elementRef.current;
    if (!el) {
      setIsRevealed(true);
      return;
    }

    const observer = getSharedObserver();
    if (!observer) {
      setIsRevealed(true);
      return;
    }

    setIsReady(true);

    const onIntersect = () => {
      setIsRevealed(true);
    };

    revealCallbacks.set(el, onIntersect);
    observer.observe(el);

    return () => {
      revealCallbacks.delete(el);
      observer.unobserve(el);
    };
  }, [disabled]);

  const delayMs = calculateStaggerDelay(index, baseDelay, maxColumns);

  const revealStyle: CSSProperties =
    isReady && !disabled
      ? {
          transitionDelay: `${delayMs}ms`,
          transitionDuration: `${duration}ms`,
        }
      : {};

  const revealClasses = disabled
    ? ""
    : !isReady
      ? ""
      : isRevealed
        ? "mq-product-reveal is-revealed"
        : "mq-product-reveal";

  return {
    ref: elementRef,
    isRevealed,
    isReady,
    revealStyle,
    revealClasses,
  };
}
