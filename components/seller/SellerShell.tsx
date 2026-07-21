"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  Boxes,
  FolderOpen,
  LayoutDashboard,
  Package,
  RotateCcw,
  ShoppingBag,
  Store,
} from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { Container } from "@/components/ui/shared";
import "./seller.css";

const links = [
  { href: "/seller", label: "Overview", icon: LayoutDashboard },
  { href: "/seller/shop", label: "Shop", icon: Store },
  { href: "/seller/products", label: "Products", icon: Package },
  { href: "/seller/inventory", label: "Inventory", icon: Boxes },
  { href: "/seller/orders", label: "Orders", icon: ShoppingBag },
  { href: "/seller/rma", label: "RMA", icon: RotateCcw },
  { href: "/seller/materials", label: "Materials", icon: FolderOpen },
] as const;

function titleFromPath(pathname: string): { title: string; desc?: string } {
  if (pathname.startsWith("/seller/shop")) {
    return { title: "My shop", desc: "Application status, details, and branding." };
  }
  if (pathname.startsWith("/seller/products")) {
    return { title: "Products", desc: "Create and manage your catalog." };
  }
  if (pathname.startsWith("/seller/inventory")) {
    return { title: "Inventory", desc: "Warehouses and stock requests." };
  }
  if (pathname.startsWith("/seller/orders")) {
    return { title: "Sales orders", desc: "Orders placed for your shop." };
  }
  if (pathname.startsWith("/seller/rma")) {
    return { title: "RMA", desc: "Confirm returned stock." };
  }
  if (pathname.startsWith("/seller/materials")) {
    return { title: "Marketing materials", desc: "Download seller assets." };
  }
  return { title: "Seller Center", desc: "Manage your shop, products, and orders." };
}

export function SellerNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="mq-seller-nav" aria-label="Seller center">
      {links.map((l) => {
        const active =
          l.href === "/seller"
            ? pathname === "/seller"
            : pathname === l.href || pathname.startsWith(`${l.href}/`);
        const Icon = l.icon;
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`mq-seller-nav-item${active ? " is-active" : ""}`}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
          >
            <Icon size={17} strokeWidth={1.75} aria-hidden />
            <span>{l.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function SellerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { title, desc } = titleFromPath(pathname);

  return (
    <section className="mq-seller-page">
      <Container className="grid grid-cols-1 gap-5 items-start lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-6">
        <aside className="mq-seller-sidebar">
          <div className="mq-seller-identity">
            <span className="mq-seller-mark" aria-hidden>
              MQ
            </span>
            <div className="mq-seller-identity-text">
              <p className="mq-seller-kicker">Seller</p>
              <h2 className="mq-seller-title">Seller Center</h2>
              <p className="mq-seller-sub">{user?.fullName || user?.email || "—"}</p>
            </div>
          </div>
          <SellerNav />
        </aside>

        <div className="mq-seller-main">
          <header className="mq-seller-main-head">
            <h1>{title}</h1>
            {desc ? <p>{desc}</p> : null}
          </header>
          {children}
        </div>
      </Container>
    </section>
  );
}
