"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/seller", label: "Overview" },
  { href: "/seller/shop", label: "Shop" },
  { href: "/seller/products", label: "Products" },
  { href: "/seller/inventory", label: "Inventory" },
  { href: "/seller/orders", label: "Orders" },
  { href: "/seller/rma", label: "RMA" },
  { href: "/seller/materials", label: "Materials" },
];

export function SellerNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-2 mb-8">
      {links.map((l) => {
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
