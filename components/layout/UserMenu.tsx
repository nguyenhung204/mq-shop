"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";
import type { AuthUser } from "@/lib/api/types";

function userInitials(user: AuthUser): string {
  const name = user.fullName?.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  const email = user.email?.trim();
  if (email) return email.slice(0, 1).toUpperCase();
  return "U";
}

function UserAvatar({ user }: { user: AuthUser }) {
  const initials = userInitials(user);
  if (user.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.avatarUrl}
        alt=""
        className="mq-user-avatar-img"
        width={32}
        height={32}
      />
    );
  }
  return (
    <span className="mq-user-avatar-initials" aria-hidden="true">
      {initials}
    </span>
  );
}

export function UserMenu() {
  const { t } = useLanguage();
  const { user, isAuthenticated, logout, hasRole } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (rootRef.current && !rootRef.current.contains(target)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!isAuthenticated || !user) {
    return (
      <Link
        href="/my-account"
        className="mq-icon-btn text-mq-text hover:text-mq-gold transition-colors"
        aria-label={t("nav.account")}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      </Link>
    );
  }

  const onSignOut = async () => {
    setOpen(false);
    await logout();
    router.push("/my-account");
  };

  const showAdmin =
    hasRole("ADMIN") || hasRole("SUPER_ADMIN") || hasRole("ACCOUNTANT");

  return (
    <div
      ref={rootRef}
      className={`mq-user-menu${open ? " is-open" : ""}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="mq-user-menu-trigger"
        aria-label={t("nav.account")}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <UserAvatar user={user} />
      </button>

      <div id={menuId} className="mq-user-menu-dropdown" role="menu">
        <div className="mq-user-menu-meta">
          <p className="mq-user-menu-name">{user.fullName || user.email}</p>
          {user.fullName ? <p className="mq-user-menu-email">{user.email}</p> : null}
        </div>
        <Link
          href="/account"
          role="menuitem"
          className="mq-user-menu-item"
          onClick={() => setOpen(false)}
        >
          {t("account.myProfile")}
        </Link>
        <Link
          href="/orders"
          role="menuitem"
          className="mq-user-menu-item"
          onClick={() => setOpen(false)}
        >
          {t("account.myOrders")}
        </Link>
        <Link
          href="/wallet"
          role="menuitem"
          className="mq-user-menu-item"
          onClick={() => setOpen(false)}
        >
          {t("account.links.wallet")}
        </Link>
        <Link
          href="/rma"
          role="menuitem"
          className="mq-user-menu-item"
          onClick={() => setOpen(false)}
        >
          {t("account.links.rma")}
        </Link>
        {hasRole("SELLER") ? (
          <Link
            href="/seller"
            role="menuitem"
            className="mq-user-menu-item"
            onClick={() => setOpen(false)}
          >
            Seller Center
          </Link>
        ) : null}
        {hasRole("WAREHOUSE") && !hasRole("SELLER") ? (
          <Link
            href="/seller/inventory"
            role="menuitem"
            className="mq-user-menu-item"
            onClick={() => setOpen(false)}
          >
            Inventory
          </Link>
        ) : null}
        {showAdmin ? (
          <Link
            href="/admin"
            role="menuitem"
            className="mq-user-menu-item"
            onClick={() => setOpen(false)}
          >
            Admin
          </Link>
        ) : null}
        {hasRole("SUPER_ADMIN") ? (
          <Link
            href="/super-admin"
            role="menuitem"
            className="mq-user-menu-item"
            onClick={() => setOpen(false)}
          >
            System
          </Link>
        ) : null}
        <button
          type="button"
          role="menuitem"
          className="mq-user-menu-item mq-user-menu-item-danger"
          onClick={() => void onSignOut()}
        >
          {t("account.signOut")}
        </button>
      </div>
    </div>
  );
}
