"use client";

import Link from "next/link";
import {
  BadgeDollarSign,
  BadgePercent,
  Boxes,
  ClipboardList,
  FolderOpen,
  FolderTree,
  ImageIcon,
  Package,
  RotateCcw,
  ShoppingBag,
  Store,
  Users,
} from "lucide-react";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";

const cards: {
  href: string;
  navKey: string;
  permissions: string[];
  icon: typeof Store;
}[] = [
  {
    href: "/admin/shops",
    navKey: "shops",
    permissions: ["APPROVE_SELLER", "APPROVE_SHOP", "SUSPEND_SHOP"],
    icon: Store,
  },
  {
    href: "/admin/products",
    navKey: "products",
    permissions: ["APPROVE_PRODUCT"],
    icon: Package,
  },
  {
    href: "/admin/inventory",
    navKey: "inventory",
    permissions: ["VIEW_INVENTORY", "EDIT_INVENTORY"],
    icon: Boxes,
  },
  {
    href: "/admin/categories",
    navKey: "categories",
    permissions: ["MANAGE_CONTENT"],
    icon: FolderTree,
  },
  {
    href: "/admin/users",
    navKey: "users",
    permissions: ["VIEW_USERS", "DELETE_ACCOUNT", "LOCK_USER"],
    icon: Users,
  },
  {
    href: "/admin/audit-logs",
    navKey: "audit",
    permissions: ["VIEW_AUDIT_LOG"],
    icon: ClipboardList,
  },
  {
    href: "/admin/orders",
    navKey: "orders",
    permissions: ["VIEW_ORDER", "CREATE_ORDER"],
    icon: ShoppingBag,
  },
  {
    href: "/admin/rma",
    navKey: "rma",
    permissions: ["PROCESS_RMA", "MANAGE_RMA"],
    icon: RotateCcw,
  },
  {
    href: "/admin/finance",
    navKey: "finance",
    permissions: ["MANAGE_PAYOUT", "MANAGE_WALLET_WITHDRAW", "VIEW_REFUND_REPORT"],
    icon: BadgeDollarSign,
  },
  {
    href: "/admin/promotions",
    navKey: "promotions",
    permissions: ["APPROVE_PROMO", "MANAGE_PROMO"],
    icon: BadgePercent,
  },
  {
    href: "/admin/banners",
    navKey: "banners",
    permissions: ["MANAGE_CONTENT"],
    icon: ImageIcon,
  },
  {
    href: "/admin/marketing",
    navKey: "marketing",
    permissions: ["MANAGE_CONTENT"],
    icon: FolderOpen,
  },
];

function AdminHome() {
  const { hasAnyPermission, hasRole } = useAuth();
  const { t } = useLanguage();
  const visible = cards.filter((c) => {
    if (hasAnyPermission(c.permissions)) return true;
    if (hasRole("ACCOUNTANT")) {
      return c.permissions.some((p) =>
        ["PROCESS_RMA", "MANAGE_RMA", "VIEW_TRANSACT"].includes(p),
      );
    }
    return false;
  });

  return (
    <>
      <AdminPageHeader
        title={t("admin.overview.title")}
        description={t("admin.overview.description")}
      />

      {visible.length === 0 ? (
        <div className="mq-alert mq-alert-error">
          No admin modules available for this account. Check roles/permissions from BE.
        </div>
      ) : (
        <div className="mq-admin-stat-grid">
          {visible.map((c) => {
            const Icon = c.icon;
            return (
              <Link key={c.href} href={c.href} className="mq-admin-module-card">
                <span className="mq-admin-module-icon">
                  <Icon size={18} strokeWidth={1.75} />
                </span>
                <span className="mq-admin-module-title">{t(`admin.nav.${c.navKey}`)}</span>
                <p className="mq-admin-module-desc">
                  {t(`admin.overview.cards.${c.navKey}`)}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

export default function AdminPage() {
  return (
    <AuthGuard roles={["ADMIN", "SUPER_ADMIN", "ACCOUNTANT"]}>
      <AdminHome />
    </AuthGuard>
  );
}
