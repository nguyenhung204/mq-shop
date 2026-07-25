"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

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
  required?: boolean;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
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
  required,
  disabled,
  className = "",
  "aria-label": ariaLabel,
}: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return options;
    return options.filter((o) => {
      const hay = normalize(`${o.label} ${o.keywords ?? ""} ${o.group ?? ""}`);
      return hay.includes(q);
    });
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    setHighlight(0);
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

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

      {open ? (
        <div
          id={listId}
          role="listbox"
          className="absolute z-40 left-0 right-0 mt-1 mq-card shadow-lg overflow-hidden"
        >
          <div className="p-2 border-b border-mq-border">
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
          <ul className="max-h-56 overflow-y-auto py-1">
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
        </div>
      ) : null}
    </div>
  );
}
