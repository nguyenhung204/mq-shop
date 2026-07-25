"use client";

import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";

type Props = {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  className?: string;
  size?: "sm" | "md";
};

function clamp(n: number, min: number, max?: number): number {
  let next = Math.max(min, Math.trunc(n));
  if (typeof max === "number") next = Math.min(max, next);
  return next;
}

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max,
  className = "",
  size = "md",
}: Props) {
  const btn = size === "sm" ? "w-7 h-7" : "w-8 h-8";
  const inputW = size === "sm" ? "w-10 text-xs" : "w-12 text-sm";
  const atMin = value <= min;
  const atMax = typeof max === "number" && value >= max;
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = (raw: string) => {
    const parsed = Number.parseInt(raw.replace(/\D/g, ""), 10);
    if (!Number.isFinite(parsed)) {
      setDraft(String(value));
      return;
    }
    const next = clamp(parsed, min, max);
    setDraft(String(next));
    if (next !== value) onChange(next);
  };

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
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        className={`${inputW} h-full bg-transparent text-center tabular-nums outline-none focus:bg-mq-surface-subtle`}
        value={draft}
        aria-label="Quantity"
        onClick={(e) => e.stopPropagation()}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          const next = e.target.value.replace(/\D/g, "");
          setDraft(next);
        }}
        onBlur={() => commit(draft)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(draft);
            (e.target as HTMLInputElement).blur();
          }
          if (e.key === "Escape") {
            setDraft(String(value));
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
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
