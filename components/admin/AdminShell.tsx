"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Store,
  Sun,
  X,
} from "lucide-react";
import {
  adminNavItems,
  ACCOUNTANT_COMMERCE_PERMS,
  type AdminNavGroup,
} from "@/components/admin/nav";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { useTheme } from "@/components/providers/ThemeProvider";

const GROUP_ORDER: AdminNavGroup[] = [
  "catalog_ops",
  "sales_crm",
  "finance_mlm",
  "marketing",
  "system",
];

function NavLinks({
  onNavigate,
  isCollapsed = false,
  onExpand,
}: {
  onNavigate?: () => void;
  isCollapsed?: boolean;
  onExpand?: () => void;
}) {
  const pathname = usePathname();
  const { hasAnyPermission, hasRole, user } = useAuth();
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Restore collapsed groups preference from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("mq_admin_nav_groups");
      if (raw) {
        setCollapsedGroups(JSON.parse(raw));
      }
    } catch {
      // ignore JSON parse errors
    }
  }, []);

  // Shortcut Cmd+K / Ctrl+K to focus search input
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isCollapsed && onExpand) {
          onExpand();
        }
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 50);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCollapsed, onExpand]);

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem("mq_admin_nav_groups", JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const visible = adminNavItems.filter((i) => {
    if (i.sa) return hasRole("SUPER_ADMIN");
    if (i.roles?.length && !i.roles.some((r) => hasRole(r))) return false;
    if (!i.permissions) return true;
    if (hasAnyPermission(i.permissions) || hasRole("ADMIN") || hasRole("SUPER_ADMIN")) {
      return true;
    }
    if (hasRole("ACCOUNTANT") && user?.permissions == null) {
      return i.permissions.some((p) =>
        (ACCOUNTANT_COMMERCE_PERMS as readonly string[]).includes(p),
      );
    }
    if (hasRole("CS") && i.roles?.includes("CS")) {
      return true;
    }
    if (hasRole("WAREHOUSE") && i.roles?.includes("WAREHOUSE")) {
      return true;
    }
    return false;
  });

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

  // Filter items by search query if provided
  const query = searchQuery.trim().toLowerCase();
  const filteredVisible = visible.filter((item) => {
    if (!query) return true;
    const label = t(item.labelKey).toLowerCase();
    return label.includes(query) || item.href.toLowerCase().includes(query);
  });

  const overviewItem = filteredVisible.find((i) => i.href === "/admin");

  const groups = GROUP_ORDER.map((key) => {
    const items = filteredVisible.filter((i) => i.group === key);
    return {
      key,
      labelKey: `admin.groups.${key}`,
      items,
    };
  }).filter((g) => g.items.length > 0);

  const hasNoResults = query.length > 0 && groups.length === 0 && !overviewItem;

  return (
    <div className="mq-admin-nav">
      {/* Search Bar (Only shown in expanded mode) */}
      {!isCollapsed ? (
        <div className="mq-admin-search relative px-0.5 mb-1.5">
          <Search
            size={13}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-mq-text-muted pointer-events-none"
            aria-hidden
          />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("admin.searchMenuPlaceholder")}
            className="w-full bg-black/[0.04] dark:bg-white/[0.06] border border-black/10 dark:border-white/10 rounded-lg pl-8 pr-7 py-1.5 text-xs text-mq-text placeholder:text-mq-text-muted focus:outline-none focus:border-[#e7ba0a] focus:bg-white dark:focus:bg-white/[0.09] transition-all"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-mq-text-muted hover:text-mq-text transition-colors"
              aria-label={t("admin.common.cancel")}
            >
              <X size={12} />
            </button>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          onClick={onExpand}
          className="mq-admin-nav-item w-full justify-center mb-1 text-mq-text-muted hover:text-mq-text"
          title={t("admin.searchMenuPlaceholder")}
          aria-label={t("admin.searchMenuPlaceholder")}
        >
          <Search size={18} strokeWidth={1.75} />
        </button>
      )}

      {/* Standalone Overview item */}
      {overviewItem ? (
        <div className="mb-0.5">
          <Link
            href={overviewItem.href}
            className={`mq-admin-nav-item${isActive(overviewItem.href) || pathname === "/admin" ? " is-active" : ""}`}
            onClick={onNavigate}
            title={t(overviewItem.labelKey)}
          >
            <LayoutDashboard size={18} strokeWidth={1.75} aria-hidden />
            <span>{t(overviewItem.labelKey)}</span>
          </Link>
        </div>
      ) : null}

      {/* No search results feedback */}
      {hasNoResults ? (
        <div className="px-3 py-6 text-center text-xs text-mq-text-muted">
          <p>{t("admin.noMenuMatch")}</p>
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="mt-2 text-[#e7ba0a] hover:underline"
          >
            {t("admin.common.cancel")}
          </button>
        </div>
      ) : null}

      {/* Accordion Categorized Groups */}
      {groups.map((g) => {
        // Group is open if searching or not manually collapsed
        const hasActiveChild = g.items.some((item) => isActive(item.href));
        const isCollapsedBySetting = collapsedGroups[g.key] === true;
        // Keep active group expanded unless user actively collapsed it
        const isOpen = query.length > 0 || !isCollapsedBySetting || hasActiveChild;
        const Chevron = isOpen ? ChevronDown : ChevronRight;

        return (
          <div key={g.key} className="mq-admin-nav-group">
            {isCollapsed ? (
              <div className="mq-admin-nav-group-divider" />
            ) : (
              <button
                type="button"
                className="mq-admin-nav-group-btn"
                onClick={() => toggleGroup(g.key)}
                aria-expanded={isOpen}
              >
                <span className="mq-admin-nav-label">{t(g.labelKey)}</span>
                <div className="flex items-center gap-1.5">
                  <span className="mq-admin-nav-count">{g.items.length}</span>
                  <Chevron size={12} className="text-mq-text-muted transition-transform duration-150" />
                </div>
              </button>
            )}

            {(isOpen || isCollapsed) && (
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
                        title={t(item.labelKey)}
                      >
                        <Icon size={18} strokeWidth={1.75} aria-hidden />
                        <span>{t(item.labelKey)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const { dark, toggle } = useTheme();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Restore sidebar collapse preference from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("mq_admin_sidebar_collapsed");
      if (saved !== null) {
        setIsCollapsed(saved === "true");
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("mq_admin_sidebar_collapsed", String(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const onLogout = async () => {
    await logout();
    router.push("/my-account");
  };

  return (
    <div className="mq-admin-shell">
      {/* Desktop Persistent Sidebar */}
      <aside className={`mq-admin-sidebar${isCollapsed ? " is-collapsed" : ""}`}>
        <div className="mq-admin-brand">
          <span className="mq-admin-brand-mark">MQ</span>
          <div className="mq-admin-brand-text min-w-0 flex-1">
            <p className="mq-admin-brand-title truncate">{t("admin.brand")}</p>
            <p className="mq-admin-brand-sub truncate">{t("admin.brandSub")}</p>
          </div>
        </div>

        <NavLinks
          isCollapsed={isCollapsed}
          onExpand={() => setIsCollapsed(false)}
        />

        <div className="mq-admin-sidebar-foot">
          <Link href="/" className="mq-admin-nav-item" title={t("admin.common.storefront")}>
            <Store size={18} strokeWidth={1.75} aria-hidden />
            <span>{t("admin.common.storefront")}</span>
          </Link>
          <button
            type="button"
            className="mq-admin-nav-item w-full text-left cursor-pointer"
            onClick={toggleSidebar}
            title={isCollapsed ? t("admin.expandSidebar") : t("admin.collapseSidebar")}
            aria-label={isCollapsed ? t("admin.expandSidebar") : t("admin.collapseSidebar")}
          >
            {isCollapsed ? (
              <PanelLeftOpen size={18} strokeWidth={1.75} aria-hidden />
            ) : (
              <PanelLeftClose size={18} strokeWidth={1.75} aria-hidden />
            )}
            <span>{isCollapsed ? t("admin.expandSidebar") : t("admin.collapseSidebar")}</span>
          </button>
        </div>
      </aside>

      {/* Mobile Backdrop */}
      {open && (
        <button
          type="button"
          className="mq-admin-backdrop"
          aria-label={t("admin.closeMenu")}
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile Drawer (Always expanded) */}
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
        <NavLinks onNavigate={() => setOpen(false)} isCollapsed={false} />
      </aside>

      {/* Main Content Area */}
      <div className="mq-admin-main">
        <header className="mq-admin-topbar">
          {/* Mobile hamburger menu */}
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

          {/* Desktop Sidebar Toggle Button in Topbar */}
          <div className="shrink-0 hidden lg:block">
            <button
              type="button"
              className="mq-admin-icon-btn mr-1"
              onClick={toggleSidebar}
              title={isCollapsed ? t("admin.expandSidebar") : t("admin.collapseSidebar")}
              aria-label={isCollapsed ? t("admin.expandSidebar") : t("admin.collapseSidebar")}
            >
              {isCollapsed ? (
                <PanelLeftOpen size={18} strokeWidth={1.75} />
              ) : (
                <PanelLeftClose size={18} strokeWidth={1.75} />
              )}
            </button>
          </div>

          <div className="mq-admin-topbar-meta">
            <p className="mq-admin-user-email">{user?.email || t("admin.brand")}</p>
            <p className="mq-admin-user-roles">{user?.roles?.join(" · ") || "—"}</p>
          </div>
          <LanguageSwitcher menuAlign="end" />
          <button
            type="button"
            className="mq-admin-icon-btn"
            onClick={toggle}
            aria-label={dark ? t("admin.lightMode") : t("admin.darkMode")}
            title={dark ? t("admin.lightMode") : t("admin.darkMode")}
          >
            {dark ? <Sun size={18} strokeWidth={1.75} /> : <Moon size={18} strokeWidth={1.75} />}
          </button>
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
