"use client";

import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { evaluateQuantityInput } from "@/lib/ui/currency";
import { getMoneyInputErrorMessage } from "@/lib/money";

type Props = {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  className?: string;
  size?: "sm" | "md";
  /** Called with true while the typed text is not a valid quantity (value is then NOT changed). */
  onInvalidChange?: (invalid: boolean) => void;
};

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max,
  className = "",
  size = "md",
  onInvalidChange,
}: Props) {
  const { t, locale: langLocale } = useLanguage();
  const locale = langLocale ?? "en";
  const btn = size === "sm" ? "w-7 h-7" : "w-8 h-8";
  const inputW = size === "sm" ? "w-10 text-xs" : "w-12 text-sm";
  const atMin = value <= min;
  const atMax = typeof max === "number" && value >= max;
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const evaluation = evaluateQuantityInput(draft, { locale, min, max });
  const invalid = evaluation.error !== null;
  const errorMessage = invalid
    ? getMoneyInputErrorMessage(evaluation.error!, t, {
        locale,
        maxDecimals: 0,
        min,
        max,
      })
    : "";

  useEffect(() => {
    onInvalidChange?.(invalid);
  }, [invalid, onInvalidChange]);

  // Invalid text is kept as typed and reported; the quantity is never silently changed.
  const commit = () => {
    if (evaluation.value == null) return;
    if (evaluation.value !== value) onChange(evaluation.value);
  };

  return (
    <div className="inline-flex flex-col items-start">
      <div
        className={`inline-flex items-center border border-mq-border ${className}`.trim()}
        role="group"
        aria-label={t("cart.quantity")}
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
          className={`${inputW} h-full bg-transparent text-center tabular-nums outline-none focus:bg-mq-surface-subtle`}
          value={draft}
          aria-label={t("cart.quantity")}
          aria-invalid={invalid}
          title={errorMessage || undefined}
          onClick={(e) => e.stopPropagation()}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
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
            onChange(
              typeof max === "number" ? Math.min(max, value + 1) : value + 1,
            );
          }}
          aria-label="Increase quantity"
        >
          <Plus size={size === "sm" ? 12 : 14} />
        </button>
      </div>
      {invalid ? (
        <span
          role="alert"
          className="mt-1 max-w-[14rem] text-xs text-red-600 dark:text-red-400"
        >
          {errorMessage}
        </span>
      ) : null}
    </div>
  );
}
