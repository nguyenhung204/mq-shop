import type { LucideIcon } from "lucide-react";
import {
  BadgeDollarSign,
  BadgePercent,
  Boxes,
  Calculator,
  ClipboardList,
  FolderOpen,
  FolderTree,
  HandCoins,
  ImageIcon,
  LayoutDashboard,
  Package,
  Percent,
  RotateCcw,
  Scale,
  Settings,
  ShoppingBag,
  Store,
  UserCog,
  Users,
} from "lucide-react";
import type { Role } from "@/lib/api/types";

export type AdminNavItem = {
  href: string;
  /** i18n key under admin.nav.* */
  labelKey: string;
  icon: LucideIcon;
  permissions?: string[];
  /** When set, user must have at least one of these roles (in addition to permissions). */
  roles?: Role[];
  sa?: boolean;
  group?: "ops" | "commerce" | "system";
};

export const adminNavItems: AdminNavItem[] = [
  { href: "/admin", labelKey: "admin.nav.overview", icon: LayoutDashboard, group: "ops" },
  {
    href: "/admin/shops",
    labelKey: "admin.nav.shops",
    icon: Store,
    permissions: ["APPROVE_SELLER", "APPROVE_SHOP", "REJECT_SHOP", "SUSPEND_SHOP"],
    group: "ops",
  },
  {
    href: "/admin/products",
    labelKey: "admin.nav.products",
    icon: Package,
    permissions: ["APPROVE_PRODUCT", "REJECT_PRODUCT", "HIDE_PRODUCT"],
    group: "ops",
  },
  {
    href: "/admin/inventory",
    labelKey: "admin.nav.inventory",
    icon: Boxes,
    permissions: ["VIEW_INVENTORY", "EDIT_INVENTORY"],
    group: "ops",
  },
  {
    href: "/admin/categories",
    labelKey: "admin.nav.categories",
    icon: FolderTree,
    permissions: ["MANAGE_CONTENT"],
    group: "ops",
  },
  {
    href: "/admin/users",
    labelKey: "admin.nav.users",
    icon: Users,
    permissions: ["LOCK_USER", "UNLOCK_USER", "DELETE_USER", "VIEW_USERS", "DELETE_ACCOUNT"],
    group: "ops",
  },
  {
    href: "/admin/staff",
    labelKey: "admin.nav.staff",
    icon: UserCog,
    permissions: ["MANAGE_STAFF", "ASSIGN_ROLES"],
    group: "ops",
  },
  {
    href: "/admin/audit-logs",
    labelKey: "admin.nav.audit",
    icon: ClipboardList,
    permissions: ["VIEW_AUDIT_LOG"],
    group: "ops",
  },
  {
    href: "/admin/orders",
    labelKey: "admin.nav.orders",
    icon: ShoppingBag,
    permissions: ["FORCE_CANCEL_ORDER", "CONFIRM_ORDER"],
    group: "commerce",
  },
  {
    href: "/admin/rma",
    labelKey: "admin.nav.rma",
    icon: RotateCcw,
    permissions: ["PROCESS_RMA", "MANAGE_RMA"],
    group: "commerce",
  },
  {
    href: "/admin/settlements",
    labelKey: "admin.nav.settlements",
    icon: Scale,
    permissions: ["VIEW_TRANSACT"],
    group: "commerce",
  },
  {
    href: "/admin/payouts",
    labelKey: "admin.nav.payouts",
    icon: HandCoins,
    permissions: ["PAYOUT_SELLER"],
    group: "commerce",
  },
  {
    href: "/admin/landing-cost",
    labelKey: "admin.nav.landingCost",
    icon: Calculator,
    permissions: ["CALC_LAND_COST"],
    group: "commerce",
  },
  {
    href: "/admin/finance",
    labelKey: "admin.nav.finance",
    icon: BadgeDollarSign,
    permissions: ["MANAGE_PAYOUT", "MANAGE_WALLET_WITHDRAW", "REVIEW_PAYMENT_GATEWAY", "VIEW_REFUND_REPORT"],
    group: "commerce",
  },
  {
    href: "/admin/finance/configs",
    labelKey: "admin.nav.financeConfigs",
    icon: Percent,
    permissions: ["CONFIG_FEE"],
    roles: ["SUPER_ADMIN", "ACCOUNTANT"],
    group: "commerce",
  },
  {
    href: "/admin/promotions",
    labelKey: "admin.nav.promotions",
    icon: BadgePercent,
    permissions: ["APPROVE_PROMO", "MANAGE_PROMO"],
    group: "commerce",
  },
  {
    href: "/admin/banners",
    labelKey: "admin.nav.banners",
    icon: ImageIcon,
    permissions: ["MANAGE_CONTENT"],
    group: "commerce",
  },
  {
    href: "/admin/marketing",
    labelKey: "admin.nav.marketing",
    icon: FolderOpen,
    permissions: ["MANAGE_CONTENT"],
    group: "commerce",
  },
  { href: "/super-admin", labelKey: "admin.nav.system", icon: Settings, sa: true, group: "system" },
];
