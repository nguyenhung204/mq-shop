"use client";

import Link from "next/link";
import {
  BadgeDollarSign,
  Boxes,
  ClipboardList,
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

const cards: {
  href: string;
  label: string;
  desc: string;
  permissions: string[];
  icon: typeof Store;
}[] = [
  {
    href: "/admin/shops",
    label: "Shops",
    desc: "Approve, reject, and violation-lock seller applications",
    permissions: ["APPROVE_SELLER", "APPROVE_SHOP", "SUSPEND_SHOP"],
    icon: Store,
  },
  {
    href: "/admin/products",
    label: "Products",
    desc: "Review listings — approve, reject, or hide",
    permissions: ["APPROVE_PRODUCT"],
    icon: Package,
  },
  {
    href: "/admin/inventory",
    label: "Inventory",
    desc: "Approve or reject cross-shop stock slips",
    permissions: ["VIEW_INVENTORY", "EDIT_INVENTORY"],
    icon: Boxes,
  },
  {
    href: "/admin/categories",
    label: "Categories",
    desc: "Maintain the storefront catalog tree",
    permissions: ["MANAGE_CONTENT"],
    icon: FolderTree,
  },
  {
    href: "/admin/users",
    label: "Users",
    desc: "Lock, unlock, and soft-delete accounts",
    permissions: ["VIEW_USERS", "DELETE_ACCOUNT", "LOCK_USER"],
    icon: Users,
  },
  {
    href: "/admin/audit-logs",
    label: "Audit logs",
    desc: "Trace admin actions across the platform",
    permissions: ["VIEW_AUDIT_LOG"],
    icon: ClipboardList,
  },
  {
    href: "/admin/orders",
    label: "Orders",
    desc: "Confirm COD payments or force-cancel",
    permissions: ["FORCE_CANCEL_ORDER", "CONFIRM_ORDER"],
    icon: ShoppingBag,
  },
  {
    href: "/admin/rma",
    label: "RMA",
    desc: "Decide return and refund requests",
    permissions: ["MANAGE_RMA"],
    icon: RotateCcw,
  },
  {
    href: "/admin/finance",
    label: "Finance",
    desc: "Payouts, withdraws, and gateway reviews",
    permissions: ["MANAGE_PAYOUT", "MANAGE_WALLET_WITHDRAW", "VIEW_REFUND_REPORT"],
    icon: BadgeDollarSign,
  },
  {
    href: "/admin/banners",
    label: "Banners",
    desc: "Homepage and promo CMS creatives",
    permissions: ["MANAGE_BANNERS"],
    icon: ImageIcon,
  },
];

function AdminHome() {
  const { user, hasAnyPermission } = useAuth();
  const visible = cards.filter((c) => hasAnyPermission(c.permissions));

  return (
    <>
      <AdminPageHeader
        title="Overview"
        description={`Welcome back${user?.fullName ? `, ${user.fullName}` : ""}. Pick a module to continue.`}
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
                <span className="mq-admin-module-title">{c.label}</span>
                <p className="mq-admin-module-desc">{c.desc}</p>
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
    <AuthGuard roles={["ADMIN", "SUPER_ADMIN"]}>
      <AdminHome />
    </AuthGuard>
  );
}
