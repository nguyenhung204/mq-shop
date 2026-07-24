import type { LucideIcon } from "lucide-react";
import {
  BadgeDollarSign,
  BadgePercent,
  Boxes,
  ClipboardList,
  FolderTree,
  ImageIcon,
  LayoutDashboard,
  Package,
  RotateCcw,
  Scale,
  Settings,
  ShoppingBag,
  Store,
  UserCog,
  Users,
} from "lucide-react";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  permissions?: string[];
  sa?: boolean;
  group?: "ops" | "commerce" | "system";
};

export const adminNavItems: AdminNavItem[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, group: "ops" },
  {
    href: "/admin/shops",
    label: "Shops",
    icon: Store,
    permissions: ["APPROVE_SELLER", "APPROVE_SHOP", "REJECT_SHOP", "SUSPEND_SHOP"],
    group: "ops",
  },
  {
    href: "/admin/products",
    label: "Products",
    icon: Package,
    permissions: ["APPROVE_PRODUCT", "REJECT_PRODUCT", "HIDE_PRODUCT"],
    group: "ops",
  },
  {
    href: "/admin/inventory",
    label: "Inventory",
    icon: Boxes,
    permissions: ["VIEW_INVENTORY", "EDIT_INVENTORY"],
    group: "ops",
  },
  {
    href: "/admin/categories",
    label: "Categories",
    icon: FolderTree,
    permissions: ["MANAGE_CONTENT"],
    group: "ops",
  },
  {
    href: "/admin/users",
    label: "Users",
    icon: Users,
    permissions: ["LOCK_USER", "UNLOCK_USER", "DELETE_USER", "VIEW_USERS", "DELETE_ACCOUNT"],
    group: "ops",
  },
  {
    href: "/admin/staff",
    label: "Staff",
    icon: UserCog,
    permissions: ["MANAGE_STAFF", "ASSIGN_ROLES"],
    group: "ops",
  },
  {
    href: "/admin/audit-logs",
    label: "Audit",
    icon: ClipboardList,
    permissions: ["VIEW_AUDIT_LOG"],
    group: "ops",
  },
  {
    href: "/admin/orders",
    label: "Orders",
    icon: ShoppingBag,
    permissions: ["FORCE_CANCEL_ORDER", "CONFIRM_ORDER"],
    group: "commerce",
  },
  {
    href: "/admin/rma",
    label: "RMA",
    icon: RotateCcw,
    permissions: ["PROCESS_RMA", "MANAGE_RMA"],
    group: "commerce",
  },
  {
    href: "/admin/settlements",
    label: "Settlements",
    icon: Scale,
    permissions: ["VIEW_TRANSACT"],
    group: "commerce",
  },
  {
    href: "/admin/finance",
    label: "Finance",
    icon: BadgeDollarSign,
    permissions: ["MANAGE_PAYOUT", "MANAGE_WALLET_WITHDRAW", "REVIEW_PAYMENT_GATEWAY", "VIEW_REFUND_REPORT"],
    group: "commerce",
  },
  {
    href: "/admin/promotions",
    label: "Promotions",
    icon: BadgePercent,
    permissions: ["APPROVE_PROMO", "MANAGE_PROMO"],
    group: "commerce",
  },
  {
    href: "/admin/banners",
    label: "Banners",
    icon: ImageIcon,
    permissions: ["MANAGE_CONTENT"],
    group: "commerce",
  },
  { href: "/super-admin", label: "System", icon: Settings, sa: true, group: "system" },
];
