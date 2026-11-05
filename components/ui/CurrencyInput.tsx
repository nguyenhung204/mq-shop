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
  type KeyboardEvent,
} from "react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import {
  findCursorPosition,
  formatLiveCurrency,
  formatLocaleNumber,
  getCurrencyAffix,
  getCurrencyDecimals,
  getLocaleSeparators,
  parseLocaleNumber,
} from "@/lib/ui/currency";

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
  onFocus,
  onBlur,
  onKeyDown,
  ...rest
}: CurrencyInputProps) {
  const { locale: langLocale } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);

  const activeLocale = useMemo(() => {
    if (propLocale) return propLocale;
    if (langLocale === "zh-TW") return "zh-TW";
    if (langLocale === "vi") return "vi-VN";
    return "en-US";
  }, [propLocale, langLocale]);

  const decimals = useMemo(() => getCurrencyDecimals(currency), [currency]);
  const separators = useMemo(
    () => getLocaleSeparators(activeLocale),
    [activeLocale],
  );
  const affix = useMemo(
    () => getCurrencyAffix(currency, activeLocale),
    [currency, activeLocale],
  );

  const [isFocused, setIsFocused] = useState(false);
  const [displayString, setDisplayString] = useState<string>(() => {
    if (value == null || !Number.isFinite(value)) return "";
    return formatLocaleNumber(value, activeLocale, {
      minDecimals: decimals > 0 ? decimals : 0,
      maxDecimals: decimals,
    });
  });

  // Track latest numeric value emitted to prevent re-formatting while typing
  const lastEmittedValueRef = useRef<number | null | undefined>(value);

  // Sync external value changes (e.g. form reset, loaded from API, locale change)
  useEffect(() => {
    if (isFocused && lastEmittedValueRef.current === value) return;
    lastEmittedValueRef.current = value;

    if (value == null || !Number.isFinite(value)) {
      setDisplayString("");
      return;
    }

    const formatted = formatLocaleNumber(value, activeLocale, {
      minDecimals: decimals > 0 && !isFocused ? decimals : 0,
      maxDecimals: decimals,
    });
    setDisplayString(formatted);
  }, [value, isFocused, activeLocale, decimals]);

  const applyFormattedValue = useCallback(
    (
      rawInput: string,
      cursorBefore: number,
      hadDecBefore: boolean,
    ) => {
      const { group, decimal } = separators;
      const { display, value: parsedVal } = formatLiveCurrency(
        rawInput,
        group,
        decimal,
        decimals,
      );

      // Clamp to min/max if provided
      let finalVal = parsedVal;
      if (finalVal != null) {
        if (min != null && finalVal < min) finalVal = min;
        if (max != null && finalVal > max) finalVal = max;
      }

      setDisplayString(display);
      lastEmittedValueRef.current = finalVal;
      onChange(finalVal);

      // Calculate new cursor position in the formatted string
      const rawDigitsBefore = (
        rawInput.slice(0, cursorBefore).match(/\d/g) || []
      ).length;
      const nextCursor = findCursorPosition(
        display,
        rawDigitsBefore,
        decimal,
        hadDecBefore,
      );

      // Re-position cursor on next animation frame
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.setSelectionRange(nextCursor, nextCursor);
        }
      });
    },
    [separators, decimals, min, max, onChange],
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      const cursor = e.target.selectionStart ?? raw.length;
      const { decimal } = separators;
      const sliceBefore = raw.slice(0, cursor);
      const hadDecBefore =
        sliceBefore.includes(decimal) ||
        (decimal === ","
          ? sliceBefore.includes(".")
          : sliceBefore.includes(","));

      applyFormattedValue(raw, cursor, hadDecBefore);
    },
    [separators, applyFormattedValue],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      // Smart Backspace: when cursor is directly after a thousand separator, delete the digit before it
      if (e.key === "Backspace") {
        const input = inputRef.current;
        if (
          input &&
          input.selectionStart === input.selectionEnd &&
          input.selectionStart != null &&
          input.selectionStart > 1
        ) {
          const pos = input.selectionStart;
          const charBefore = displayString[pos - 1];
          if (charBefore === separators.group) {
            e.preventDefault();
            // Delete both the separator and the digit preceding it
            const newRaw =
              displayString.slice(0, pos - 2) + displayString.slice(pos);
            const digitsBefore = (
              displayString.slice(0, pos - 2).match(/\d/g) || []
            ).length;
            const hadDec =
              displayString.slice(0, pos - 2).includes(separators.decimal);

            const { group, decimal } = separators;
            const { display, value: parsedVal } = formatLiveCurrency(
              newRaw,
              group,
              decimal,
              decimals,
            );

            setDisplayString(display);
            lastEmittedValueRef.current = parsedVal;
            onChange(parsedVal);

            const nextCursor = findCursorPosition(
              display,
              digitsBefore,
              decimal,
              hadDec,
            );
            requestAnimationFrame(() => {
              input.setSelectionRange(nextCursor, nextCursor);
            });
            return;
          }
        }
      }

      onKeyDown?.(e);
    },
    [displayString, separators, decimals, onChange, onKeyDown],
  );

  const handleFocus = useCallback(
    (e: FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      onFocus?.(e);
    },
    [onFocus],
  );

  const handleBlur = useCallback(
    (e: FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      const parsed = parseLocaleNumber(displayString, activeLocale, decimals);
      if (parsed == null) {
        setDisplayString("");
        lastEmittedValueRef.current = null;
        onChange(null);
      } else {
        const formatted = formatLocaleNumber(parsed, activeLocale, {
          minDecimals: decimals > 0 ? decimals : 0,
          maxDecimals: decimals,
        });
        setDisplayString(formatted);
        lastEmittedValueRef.current = parsed;
        onChange(parsed);
      }
      onBlur?.(e);
    },
    [displayString, activeLocale, decimals, onChange, onBlur],
  );

  const inputElement = (
    <input
      ref={inputRef}
      type="text"
      inputMode={decimals === 0 ? "numeric" : "decimal"}
      value={displayString}
      placeholder={placeholder}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
      onBlur={handleBlur}
      disabled={disabled}
      className={`w-full outline-none bg-transparent ${className}`}
      {...rest}
    />
  );

  if (!showAffix) {
    return inputElement;
  }

  return (
    <div
      className={`relative inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-mq-border bg-mq-card text-mq-text focus-within:ring-2 focus-within:ring-mq-primary/40 focus-within:border-mq-primary transition-colors ${
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
  );
}
