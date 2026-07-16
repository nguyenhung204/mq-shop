"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";

const portals = [
  { href: "/", label: "Shop", match: (p: string) => p === "/" || p.startsWith("/shop") || p.startsWith("/product") || p.startsWith("/cart") || p.startsWith("/checkout") || p.startsWith("/orders") },
  { href: "/seller", label: "Seller", role: "SELLER" as const, match: (p: string) => p.startsWith("/seller") },
  { href: "/admin", label: "Admin", roles: ["ADMIN", "SUPER_ADMIN"] as const, match: (p: string) => p.startsWith("/admin") },
  { href: "/wallet", label: "Wallet", match: (p: string) => p.startsWith("/wallet") },
  { href: "/super-admin", label: "System", role: "SUPER_ADMIN" as const, match: (p: string) => p.startsWith("/super-admin") },
];

export function RoleSwitcher() {
  const { user, hasRole, isAuthenticated } = useAuth();
  const pathname = usePathname();

  if (!isAuthenticated || !user) return null;

  const visible = portals.filter((p) => {
    if ("role" in p && p.role) return hasRole(p.role);
    if ("roles" in p && p.roles) return p.roles.some((r) => hasRole(r));
    return true;
  });

  if (visible.length <= 1) return null;

  return (
    <div className="flex items-center gap-1 rounded-full border border-mq-border bg-mq-surface-subtle p-1">
      {visible.map((p) => {
        const active = p.match(pathname);
        return (
          <Link
            key={p.href}
            href={p.href}
            className={`px-3 py-1 text-[11px] font-medium uppercase tracking-wider rounded-full transition-colors ${
              active
                ? "bg-mq-text text-mq-surface"
                : "text-mq-text-muted hover:text-mq-text"
            }`}
          >
            {p.label}
          </Link>
        );
      })}
    </div>
  );
}
