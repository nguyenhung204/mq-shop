"use client";

import { useEffect, type RefObject } from "react";

const FOCUSABLE = "select:not([disabled]), input:not([disabled]), textarea:not([disabled]), button:not([disabled])";

/**
 * Dialog focus handling: the first control inside `ref` gets focus when the dialog mounts and the
 * element that had focus before is focused again when it unmounts. (Escape is handled by the dialog.)
 */
export function useDialogFocus(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const previous = typeof document !== "undefined" ? (document.activeElement as HTMLElement | null) : null;
    ref.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    return () => {
      previous?.focus?.();
    };
  }, [ref]);
}
