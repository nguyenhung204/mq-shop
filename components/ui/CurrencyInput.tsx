"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type InputHTMLAttributes,
} from "react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import {
  evaluateCurrencyInput,
  formatLocaleNumber,
  getCurrencyAffix,
  getCurrencyDecimals,
} from "@/lib/ui/currency";
import {
  formatBlurMoneyInput,
  getMoneyInputErrorMessage,
  parseLocaleMoneyInput,
} from "@/lib/money";

export interface CurrencyInputProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "value" | "onChange" | "defaultValue" | "min" | "max"
  > {
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  currency?: string;
  locale?: string;
  showAffix?: boolean;
  min?: number;
  max?: number;
  error?: string;
}

export function CurrencyInput({
  value,
  onChange,
  currency = "TWD",
  locale: propLocale,
  showAffix = true,
  placeholder,
  className = "",
  disabled,
  min,
  max,
  error,
  onFocus,
  onBlur,
  onKeyDown,
  ...rest
}: CurrencyInputProps) {
  const { t, locale: langLocale } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const activeLocale = useMemo(() => {
    if (propLocale) return propLocale;
    if (langLocale === "zh-TW") return "zh-TW";
    if (langLocale === "vi") return "vi-VN";
    return "en-US";
  }, [propLocale, langLocale]);

  const decimals = useMemo(() => getCurrencyDecimals(currency), [currency]);
  const affix = useMemo(
    () => getCurrencyAffix(currency, activeLocale),
    [currency, activeLocale],
  );

  const [displayString, setDisplayString] = useState<string>(() => {
    if (value == null || !Number.isFinite(value)) return "";
    return formatLocaleNumber(value, activeLocale, {
      minDecimals: decimals > 0 ? decimals : 0,
      maxDecimals: decimals,
    });
  });

  // The text is never rewritten while typing: the typed text is judged as-is
  // and an invalid text emits null plus an inline error (no mask, no clamping).
  const evaluation = useMemo(
    () => evaluateCurrencyInput(displayString, { locale: activeLocale, decimals, min, max }),
    [displayString, activeLocale, decimals, min, max],
  );
  const activeError =
    error ||
    (evaluation.error
      ? getMoneyInputErrorMessage(evaluation.error, t, {
          locale: activeLocale,
          maxDecimals: decimals,
          min,
          max,
        })
      : "");

  // Block native form submission while the text is invalid so no wrong value is submitted.
  useEffect(() => {
    inputRef.current?.setCustomValidity(evaluation.error ? activeError : "");
  }, [evaluation.error, activeError]);

  // Last value this component emitted (or synced from props). A parent value that differs
  // is an external change (reset, API load) and replaces the text; the same value keeps it.
  const lastEmittedValueRef = useRef<number | null | undefined>(value);
  const lastLocaleKeyRef = useRef(`${activeLocale}|${decimals}`);

  useEffect(() => {
    const localeKey = `${activeLocale}|${decimals}`;
    const localeChanged = lastLocaleKeyRef.current !== localeKey;
    lastLocaleKeyRef.current = localeKey;
    if (!localeChanged && lastEmittedValueRef.current === value) return;
    lastEmittedValueRef.current = value;

    if (value == null || !Number.isFinite(value)) {
      // A locale switch alone must not wipe text the user typed (it may just be invalid).
      if (!localeChanged) setDisplayString("");
      return;
    }
    setDisplayString(
      formatLocaleNumber(value, activeLocale, {
        minDecimals: decimals > 0 ? decimals : 0,
        maxDecimals: decimals,
      }),
    );
  }, [value, activeLocale, decimals]);

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      const { value: next } = evaluateCurrencyInput(raw, {
        locale: activeLocale,
        decimals,
        min,
        max,
      });
      setDisplayString(raw);
      lastEmittedValueRef.current = next;
      onChange(next);
    },
    [activeLocale, decimals, min, max, onChange],
  );

  const handleBlur = useCallback(
    (e: FocusEvent<HTMLInputElement>) => {
      // Valid text is tidied (grouping); invalid text is left exactly as typed.
      const res = parseLocaleMoneyInput(displayString, {
        locale: activeLocale,
        maxDecimals: decimals,
        allowZero: true,
        allowNegative: min == null || min < 0,
        min,
        max,
      });
      if (res.ok) {
        setDisplayString(formatBlurMoneyInput(res.canonical, activeLocale, decimals));
      }
      onBlur?.(e);
    },
    [displayString, activeLocale, decimals, min, max, onBlur],
  );

  const inputElement = (
    <input
      ref={inputRef}
      type="text"
      inputMode={decimals === 0 ? "numeric" : "decimal"}
      value={displayString}
      placeholder={placeholder}
      onChange={handleChange}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      onBlur={handleBlur}
      disabled={disabled}
      aria-invalid={Boolean(activeError)}
      className={`w-full outline-none bg-transparent ${className}`}
      {...rest}
    />
  );

  if (!showAffix) {
    return (
      <div className="w-full">
        {inputElement}
        {activeError ? (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
            {activeError}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="w-full">
      <div
        className={`relative inline-flex w-full items-center gap-1.5 px-3 py-2 rounded-lg border ${
          activeError ? "border-red-500" : "border-mq-border"
        } bg-mq-card text-mq-text focus-within:ring-2 focus-within:ring-mq-primary/40 focus-within:border-mq-primary transition-colors ${
          disabled ? "opacity-60 cursor-not-allowed" : ""
        }`}
      >
        {affix.position === "prefix" && (
          <span className="text-xs font-semibold text-mq-text-muted select-none">
            {affix.symbol}
          </span>
        )}
        {inputElement}
        {affix.position === "suffix" && (
          <span className="text-xs font-semibold text-mq-text-muted select-none">
            {affix.symbol}
          </span>
        )}
      </div>
      {activeError ? (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
          {activeError}
        </p>
      ) : null}
    </div>
  );
}
