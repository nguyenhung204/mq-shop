"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";

type Tone = "approve" | "reject" | "warn" | "danger" | "secondary";

const toneClass: Record<Tone, string> = {
  approve: "mq-admin-btn-approve",
  reject: "mq-admin-btn-reject",
  warn: "mq-admin-btn-warn",
  danger: "mq-admin-btn-danger",
  secondary: "mq-admin-btn-secondary",
};

type CommonProps = {
  label: string;
  icon: LucideIcon;
  tone?: Tone;
  className?: string;
};

function useTooltip(label: string) {
  const tipId = useId();
  const anchorRef = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  const place = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setCoords({
      top: rect.top - 8,
      left: rect.left + rect.width / 2,
    });
  }, []);

  const show = useCallback(() => {
    place();
    setOpen(true);
  }, [place]);

  const hide = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => place();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, place]);

  const setAnchor = useCallback((node: HTMLElement | null) => {
    anchorRef.current = node;
  }, []);

  const tooltip =
    open && typeof document !== "undefined"
      ? createPortal(
          <span
            id={tipId}
            role="tooltip"
            className="mq-admin-tooltip"
            style={{ top: coords.top, left: coords.left }}
          >
            {label}
          </span>,
          document.body,
        )
      : null;

  return { tipId, setAnchor, show, hide, tooltip };
}

export function AdminIconButton({
  label,
  icon: Icon,
  tone = "secondary",
  className = "",
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  ...props
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  const { tipId, setAnchor, show, hide, tooltip } = useTooltip(label);

  return (
    <>
      <button
        ref={setAnchor}
        type="button"
        className={`mq-admin-btn mq-admin-btn-icon ${toneClass[tone]} ${className}`.trim()}
        aria-label={label}
        aria-describedby={openDescribed(tipId, tooltip)}
        onMouseEnter={(e) => {
          show();
          onMouseEnter?.(e);
        }}
        onMouseLeave={(e) => {
          hide();
          onMouseLeave?.(e);
        }}
        onFocus={(e) => {
          show();
          onFocus?.(e);
        }}
        onBlur={(e) => {
          hide();
          onBlur?.(e);
        }}
        {...props}
      >
        <Icon size={15} strokeWidth={2.25} aria-hidden />
      </button>
      {tooltip}
    </>
  );
}

function openDescribed(tipId: string, tooltip: ReactNode) {
  return tooltip ? tipId : undefined;
}

export function AdminIconLink({
  href,
  label,
  icon: Icon,
  tone = "secondary",
  className = "",
}: CommonProps & { href: string }) {
  const { tipId, setAnchor, show, hide, tooltip } = useTooltip(label);

  return (
    <>
      <Link
        ref={setAnchor}
        href={href}
        className={`mq-admin-btn mq-admin-btn-icon ${toneClass[tone]} ${className}`.trim()}
        aria-label={label}
        aria-describedby={openDescribed(tipId, tooltip)}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        <Icon size={15} strokeWidth={2.25} aria-hidden />
      </Link>
      {tooltip}
    </>
  );
}

export function AdminActions({ children }: { children: ReactNode }) {
  return <div className="mq-admin-actions">{children}</div>;
}
