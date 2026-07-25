"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";

export type SearchableSelectOption = {
  value: string;
  label: string;
  /** Extra text matched by search (e.g. email, sku, product title). */
  keywords?: string;
  /** Optional group heading shown above the option. */
  group?: string;
};

type Props = {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  /** Allow confirming the typed query as a value (e.g. free-form email). */
  allowCustom?: boolean;
  /** Label for the creatable row; defaults to the raw query. */
  customOptionLabel?: (query: string) => string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
};

type PanelCoords = {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
};

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Type to search…",
  emptyText = "No matches",
  allowCustom = false,
  customOptionLabel,
  required,
  disabled,
  className = "",
  "aria-label": ariaLabel,
}: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [coords, setCoords] = useState<PanelCoords | null>(null);

  const selected = useMemo(() => {
    const hit = options.find((o) => o.value === value);
    if (hit) return hit;
    if (allowCustom && value) return { value, label: value };
    return null;
  }, [allowCustom, options, value]);

  const filtered = useMemo(() => {
    const q = normalize(query);
    const base = !q
      ? options
      : options.filter((o) => {
          const hay = normalize(`${o.label} ${o.keywords ?? ""} ${o.group ?? ""}`);
          return hay.includes(q);
        });
    const trimmed = query.trim();
    if (
      allowCustom &&
      trimmed &&
      !options.some((o) => normalize(o.value) === normalize(trimmed)) &&
      !base.some((o) => normalize(o.label) === normalize(trimmed))
    ) {
      return [
        {
          value: trimmed,
          label: customOptionLabel ? customOptionLabel(trimmed) : trimmed,
        },
        ...base,
      ];
    }
    return base;
  }, [allowCustom, customOptionLabel, options, query]);

  const placePanel = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 4;
    const preferredMax = 280;
    const spaceBelow = window.innerHeight - rect.bottom - gap - 8;
    const spaceAbove = rect.top - gap - 8;
    const placeAbove = spaceBelow < 160 && spaceAbove > spaceBelow;
    const maxHeight = Math.min(
      preferredMax,
      Math.max(120, placeAbove ? spaceAbove : spaceBelow),
    );
    setCoords(
      placeAbove
        ? {
            bottom: window.innerHeight - rect.top + gap,
            left: rect.left,
            width: rect.width,
            maxHeight,
          }
        : {
            top: rect.bottom + gap,
            left: rect.left,
            width: rect.width,
            maxHeight,
          },
    );
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    placePanel();
  }, [open, placePanel, filtered.length]);

  useEffect(() => {
    if (!open) return;
    setHighlight(0);
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onReposition = () => placePanel();
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, placePanel]);

  useEffect(() => {
    if (open) {
      setQuery("");
      queueMicrotask(() => inputRef.current?.focus());
    }
  }, [open]);

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
    setQuery("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = filtered[highlight];
      if (opt) pick(opt.value);
    }
  };

  let lastGroup: string | undefined;

  const panel =
    open && coords && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={panelRef}
            id={listId}
            role="listbox"
            className="mq-card shadow-lg overflow-hidden z-[80]"
            style={{
              position: "fixed",
              top: coords.top,
              bottom: coords.bottom,
              left: coords.left,
              width: coords.width,
              maxHeight: coords.maxHeight,
            }}
          >
            <div className="p-2 border-b border-mq-border shrink-0">
              <input
                ref={inputRef}
                type="search"
                className="mq-input w-full text-sm"
                placeholder={searchPlaceholder}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                autoComplete="off"
              />
            </div>
            <ul
              className="overflow-y-auto py-1"
              style={{ maxHeight: Math.max(80, coords.maxHeight - 56) }}
            >
              {filtered.length === 0 ? (
                <li className="px-3 py-2 text-sm text-mq-text-muted">{emptyText}</li>
              ) : (
                filtered.map((opt, index) => {
                  const showGroup = Boolean(opt.group && opt.group !== lastGroup);
                  if (opt.group) lastGroup = opt.group;
                  return (
                    <li key={opt.value}>
                      {showGroup ? (
                        <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wide text-mq-text-muted">
                          {opt.group}
                        </p>
                      ) : null}
                      <button
                        type="button"
                        role="option"
                        aria-selected={opt.value === value}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-mq-surface-subtle transition-colors ${
                          index === highlight || opt.value === value
                            ? "bg-mq-surface-subtle"
                            : ""
                        }`}
                        onMouseEnter={() => setHighlight(index)}
                        onClick={() => pick(opt.value)}
                      >
                        <span className="block truncate">{opt.label}</span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className={`relative w-full min-w-0 ${className}`.trim()}>
      {/* Native required check for form submit */}
      <input
        type="text"
        tabIndex={-1}
        aria-hidden
        required={required}
        value={value}
        onChange={() => undefined}
        className="sr-only absolute opacity-0 pointer-events-none w-px h-px"
      />
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listId}
        className="mq-input w-full min-w-0 text-left flex items-center justify-between gap-2 overflow-hidden"
        onClick={() => !disabled && setOpen((v) => !v)}
      >
        <span
          className={`min-w-0 flex-1 truncate ${selected ? "" : "text-mq-text-muted"}`}
        >
          {selected ? selected.label : placeholder}
        </span>
        <span className="text-mq-text-muted text-xs shrink-0" aria-hidden>
          {open ? "▴" : "▾"}
        </span>
      </button>
      {panel}
    </div>
  );
}
