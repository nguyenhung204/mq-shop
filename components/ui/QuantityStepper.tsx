"use client";

import { Minus, Plus } from "lucide-react";

type Props = {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  className?: string;
  size?: "sm" | "md";
};

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max,
  className = "",
  size = "md",
}: Props) {
  const btn = size === "sm" ? "w-7 h-7" : "w-8 h-8";
  const num = size === "sm" ? "w-7 text-xs" : "w-8 text-sm";
  const atMin = value <= min;
  const atMax = typeof max === "number" && value >= max;

  return (
    <div
      className={`inline-flex items-center border border-mq-border ${className}`.trim()}
      role="group"
      aria-label="Quantity"
    >
      <button
        type="button"
        className={`${btn} flex items-center justify-center hover:bg-mq-surface-subtle disabled:opacity-40`}
        disabled={atMin}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onChange(Math.max(min, value - 1));
        }}
        aria-label="Decrease quantity"
      >
        <Minus size={size === "sm" ? 12 : 14} />
      </button>
      <span className={`${num} text-center tabular-nums`}>{value}</span>
      <button
        type="button"
        className={`${btn} flex items-center justify-center hover:bg-mq-surface-subtle disabled:opacity-40`}
        disabled={atMax}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onChange(typeof max === "number" ? Math.min(max, value + 1) : value + 1);
        }}
        aria-label="Increase quantity"
      >
        <Plus size={size === "sm" ? 12 : 14} />
      </button>
    </div>
  );
}
