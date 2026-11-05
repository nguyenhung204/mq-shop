"use client";

import React, { type ElementType, type ReactNode } from "react";
import { useScrollReveal, type UseScrollRevealOptions } from "@/lib/hooks/useScrollReveal";

export interface ScrollRevealProps extends UseScrollRevealOptions {
  children: ReactNode;
  className?: string;
  as?: ElementType;
}

export function ScrollReveal({
  children,
  className = "",
  as: Component = "div",
  index,
  disabled = false,
  baseDelay = 50,
  maxColumns = 4,
  duration = 650,
}: ScrollRevealProps) {
  const { ref, revealClasses, revealStyle } = useScrollReveal<HTMLElement>({
    index,
    disabled,
    baseDelay,
    maxColumns,
    duration,
  });

  return (
    <Component
      ref={ref}
      className={`${revealClasses} ${className}`.trim()}
      style={revealStyle}
    >
      {children}
    </Component>
  );
}

