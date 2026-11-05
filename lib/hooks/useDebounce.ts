"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const DEFAULT_SEARCH_DEBOUNCE_MS = 400;

/**
 * Debounces a value by delayMs (default 400ms).
 */
export function useDebounce<T>(value: T, delayMs: number = DEFAULT_SEARCH_DEBOUNCE_MS): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delayMs]);

  return debouncedValue;
}

/**
 * Debounces a callback function by delayMs (default 400ms).
 * Exposes .debounced(...args), .flush(...args), and .cancel().
 */
export function useDebouncedCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
  delayMs: number = DEFAULT_SEARCH_DEBOUNCE_MS,
) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const debounced = useCallback(
    (...args: Args) => {
      cancel();
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        callbackRef.current(...args);
      }, delayMs);
    },
    [cancel, delayMs],
  );

  const flush = useCallback(
    (...args: Args) => {
      cancel();
      callbackRef.current(...args);
    },
    [cancel],
  );

  useEffect(() => cancel, [cancel]);

  return { debounced, cancel, flush };
}

