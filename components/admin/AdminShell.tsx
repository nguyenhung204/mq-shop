"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { LogOut, Menu, Store, X } from "lucide-react";
import { adminNavItems } from "@/components/admin/nav";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { useAuth } from "@/components/providers/AuthProvider";

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { hasAnyPermission, hasRole } = useAuth();

  const visible = adminNavItems.filter((i) => {
    if (i.sa) return hasRole("SUPER_ADMIN");
    if (!i.permissions) return true;
    return hasAnyPermission(i.permissions) || hasRole("ADMIN") || hasRole("SUPER_ADMIN");
  });

  const groups: { key: string; label: string; items: typeof visible }[] = [
    { key: "ops", label: "Operations", items: visible.filter((i) => i.group === "ops") },
    { key: "commerce", label: "Commerce", items: visible.filter((i) => i.group === "commerce") },
    { key: "system", label: "System", items: visible.filter((i) => i.group === "system") },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="mq-admin-nav">
      {groups.map((g) => (
        <div key={g.key} className="mq-admin-nav-group">
          <p className="mq-admin-nav-label">{g.label}</p>
          <ul>
            {g.items.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/admin" && pathname.startsWith(`${item.href}/`));
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`mq-admin-nav-item${active ? " is-active" : ""}`}
                    onClick={onNavigate}
                  >
                    <Icon size={18} strokeWidth={1.75} aria-hidden />
                    <span>{item.label}</span>
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
            <p className="mq-admin-brand-title">Admin</p>
            <p className="mq-admin-brand-sub">Control center</p>
          </div>
        </div>
        <NavLinks />
        <div className="mq-admin-sidebar-foot">
          <Link href="/" className="mq-admin-nav-item">
            <Store size={18} strokeWidth={1.75} aria-hidden />
            <span>Storefront</span>
          </Link>
        </div>
      </aside>

      {open && (
        <button
          type="button"
          className="mq-admin-backdrop"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
      )}

      <aside className={`mq-admin-drawer${open ? " is-open" : ""}`}>
        <div className="mq-admin-brand">
          <span className="mq-admin-brand-mark">MQ</span>
          <div>
            <p className="mq-admin-brand-title">Admin</p>
            <p className="mq-admin-brand-sub">Control center</p>
          </div>
          <button
            type="button"
            className="mq-admin-icon-btn ml-auto"
            onClick={() => setOpen(false)}
            aria-label="Close"
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
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
          </div>
          <div className="mq-admin-topbar-meta">
            <p className="mq-admin-user-email">{user?.email || "Admin"}</p>
            <p className="mq-admin-user-roles">{user?.roles?.join(" · ") || "—"}</p>
          </div>
          <NotificationBell />
          <button type="button" className="mq-admin-logout" onClick={() => void onLogout()}>
            <LogOut size={16} strokeWidth={1.75} />
            Sign out
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
