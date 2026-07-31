"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { LogOut, Menu, Store, X } from "lucide-react";
import { adminNavItems, ACCOUNTANT_COMMERCE_PERMS } from "@/components/admin/nav";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { hasAnyPermission, hasRole } = useAuth();
  const { t } = useLanguage();

  const visible = adminNavItems.filter((i) => {
    if (i.sa) return hasRole("SUPER_ADMIN");
    if (i.roles?.length && !i.roles.some((r) => hasRole(r))) return false;
    if (!i.permissions) return true;
    if (hasAnyPermission(i.permissions) || hasRole("ADMIN") || hasRole("SUPER_ADMIN")) {
      return true;
    }
    if (hasRole("ACCOUNTANT")) {
      return i.permissions.some((p) =>
        (ACCOUNTANT_COMMERCE_PERMS as readonly string[]).includes(p),
      );
    }
    // CS sees items explicitly listing CS in roles[]
    if (hasRole("CS") && i.roles?.includes("CS")) {
      return true;
    }
    return false;
  });

  /** Prefer the most specific matching nav href for nested admin routes. */
  const isActive = (href: string) => {
    if (pathname === href) return true;
    if (href === "/admin") return false;
    if (!pathname.startsWith(`${href}/`)) return false;
    return !visible.some(
      (o) =>
        o.href !== href &&
        o.href.startsWith(`${href}/`) &&
        (pathname === o.href || pathname.startsWith(`${o.href}/`)),
    );
  };

  const groups: { key: string; labelKey: string; items: typeof visible }[] = [
    { key: "ops", labelKey: "admin.groups.ops", items: visible.filter((i) => i.group === "ops") },
    {
      key: "commerce",
      labelKey: "admin.groups.commerce",
      items: visible.filter((i) => i.group === "commerce"),
    },
    {
      key: "system",
      labelKey: "admin.groups.system",
      items: visible.filter((i) => i.group === "system"),
    },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="mq-admin-nav">
      {groups.map((g) => (
        <div key={g.key} className="mq-admin-nav-group">
          <p className="mq-admin-nav-label">{t(g.labelKey)}</p>
          <ul>
            {g.items.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`mq-admin-nav-item${active ? " is-active" : ""}`}
                    onClick={onNavigate}
                  >
                    <Icon size={18} strokeWidth={1.75} aria-hidden />
                    <span>{t(item.labelKey)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const onLogout = async () => {
    await logout();
    router.push("/my-account");
  };

  return (
    <div className="mq-admin-shell">
      <aside className="mq-admin-sidebar">
        <div className="mq-admin-brand">
          <span className="mq-admin-brand-mark">MQ</span>
          <div>
            <p className="mq-admin-brand-title">{t("admin.brand")}</p>
            <p className="mq-admin-brand-sub">{t("admin.brandSub")}</p>
          </div>
        </div>
        <NavLinks />
        <div className="mq-admin-sidebar-foot">
          <Link href="/" className="mq-admin-nav-item">
            <Store size={18} strokeWidth={1.75} aria-hidden />
            <span>{t("admin.common.storefront")}</span>
          </Link>
        </div>
      </aside>

      {open && (
        <button
          type="button"
          className="mq-admin-backdrop"
          aria-label={t("admin.closeMenu")}
          onClick={() => setOpen(false)}
        />
      )}

      <aside className={`mq-admin-drawer${open ? " is-open" : ""}`}>
        <div className="mq-admin-brand">
          <span className="mq-admin-brand-mark">MQ</span>
          <div>
            <p className="mq-admin-brand-title">{t("admin.brand")}</p>
            <p className="mq-admin-brand-sub">{t("admin.brandSub")}</p>
          </div>
          <button
            type="button"
            className="mq-admin-icon-btn ml-auto"
            onClick={() => setOpen(false)}
            aria-label={t("admin.common.close")}
          >
            <X size={18} />
          </button>
        </div>
        <NavLinks onNavigate={() => setOpen(false)} />
      </aside>

      <div className="mq-admin-main">
        <header className="mq-admin-topbar">
          <div className="shrink-0 lg:hidden">
            <button
              type="button"
              className="mq-admin-icon-btn"
              onClick={() => setOpen(true)}
              aria-label={t("admin.openMenu")}
            >
              <Menu size={20} />
            </button>
          </div>
          <div className="mq-admin-topbar-meta">
            <p className="mq-admin-user-email">{user?.email || t("admin.brand")}</p>
            <p className="mq-admin-user-roles">{user?.roles?.join(" · ") || "—"}</p>
          </div>
          <LanguageSwitcher menuAlign="end" />
          <NotificationBell />
          <button type="button" className="mq-admin-logout" onClick={() => void onLogout()}>
            <LogOut size={16} strokeWidth={1.75} />
            {t("admin.signOut")}
          </button>
        </header>
        <div className="mq-admin-content">{children}</div>
      </div>
    </div>
  );
}

export function AdminPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mq-admin-page-head">
      <div>
        <h1 className="mq-admin-page-title">{title}</h1>
        {description ? <p className="mq-admin-page-desc">{description}</p> : null}
      </div>
      {actions ? <div className="mq-admin-page-actions">{actions}</div> : null}
    </div>
  );
}
