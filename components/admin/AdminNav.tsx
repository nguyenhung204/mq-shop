"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";

const items: { href: string; label: string; permissions?: string[]; sa?: boolean }[] = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/shops", label: "Shops", permissions: ["APPROVE_SHOP", "REJECT_SHOP", "SUSPEND_SHOP"] },
  { href: "/admin/products", label: "Products", permissions: ["APPROVE_PRODUCT", "REJECT_PRODUCT", "HIDE_PRODUCT"] },
  { href: "/admin/orders", label: "Orders", permissions: ["FORCE_CANCEL_ORDER", "CONFIRM_ORDER"] },
  { href: "/admin/rma", label: "RMA", permissions: ["MANAGE_RMA"] },
  { href: "/admin/finance", label: "Finance", permissions: ["MANAGE_PAYOUT", "MANAGE_WALLET_WITHDRAW", "REVIEW_PAYMENT_GATEWAY", "VIEW_REFUND_REPORT"] },
  { href: "/admin/banners", label: "Banners", permissions: ["MANAGE_BANNERS"] },
  { href: "/admin/users", label: "Users", permissions: ["LOCK_USER", "UNLOCK_USER", "DELETE_USER", "CREATE_STAFF"] },
  { href: "/super-admin", label: "System", sa: true },
];

export function AdminNav() {
  const pathname = usePathname();
  const { hasAnyPermission, hasRole } = useAuth();

  return (
    <nav className="flex flex-wrap gap-2 mb-8">
      {items
        .filter((i) => {
          if (i.sa) return hasRole("SUPER_ADMIN");
          if (!i.permissions) return true;
          return hasAnyPermission(i.permissions) || hasRole("SUPER_ADMIN");
        })
        .map((l) => {
          const active = pathname === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`px-3 py-1.5 text-xs font-medium uppercase tracking-wider rounded-full border transition-colors ${
                active
                  ? "bg-mq-text text-mq-surface border-mq-text"
                  : "border-mq-border text-mq-text-muted hover:text-mq-text"
              }`}
            >
              {l.label}
            </Link>
          );
        })}
    </nav>
  );
}
