"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  BadgeDollarSign,
  BadgePercent,
  Boxes,
  FolderOpen,
  LayoutDashboard,
  Package,
  RotateCcw,
  ShoppingBag,
  Store,
} from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { Container } from "@/components/ui/shared";
import "./seller.css";

const links = [
  { href: "/seller", labelKey: "seller.nav.overview", icon: LayoutDashboard, sellerOnly: true },
  { href: "/seller/shop", labelKey: "seller.nav.shop", icon: Store, sellerOnly: true },
  { href: "/seller/products", labelKey: "seller.nav.products", icon: Package, sellerOnly: true },
  { href: "/seller/inventory", labelKey: "seller.nav.inventory", icon: Boxes, sellerOnly: false },
  { href: "/seller/orders", labelKey: "seller.nav.orders", icon: ShoppingBag, sellerOnly: true },
  {
    href: "/seller/settlements",
    labelKey: "seller.nav.settlements",
    icon: BadgeDollarSign,
    sellerOnly: true,
  },
  {
    href: "/seller/promotions",
    labelKey: "seller.nav.promotions",
    icon: BadgePercent,
    sellerOnly: true,
  },
  { href: "/seller/rma", labelKey: "seller.nav.rma", icon: RotateCcw, sellerOnly: true },
  {
    href: "/seller/materials",
    labelKey: "seller.nav.materials",
    icon: FolderOpen,
    sellerOnly: true,
  },
] as const;

function titleKeysFromPath(pathname: string): { titleKey: string; descKey?: string } {
  if (pathname.startsWith("/seller/shop")) {
    return { titleKey: "seller.titles.shop", descKey: "seller.titles.shopDesc" };
  }
  if (pathname.startsWith("/seller/products")) {
    return { titleKey: "seller.titles.products", descKey: "seller.titles.productsDesc" };
  }
  if (pathname.startsWith("/seller/inventory")) {
    return { titleKey: "seller.titles.inventory", descKey: "seller.titles.inventoryDesc" };
  }
  if (pathname.startsWith("/seller/orders")) {
    return { titleKey: "seller.titles.orders", descKey: "seller.titles.ordersDesc" };
  }
  if (pathname.startsWith("/seller/settlements")) {
    return { titleKey: "seller.titles.settlements", descKey: "seller.titles.settlementsDesc" };
  }
  if (pathname.startsWith("/seller/promotions")) {
    return { titleKey: "seller.titles.promotions", descKey: "seller.titles.promotionsDesc" };
  }
  if (pathname.startsWith("/seller/rma")) {
    return { titleKey: "seller.titles.rma", descKey: "seller.titles.rmaDesc" };
  }
  if (pathname.startsWith("/seller/materials")) {
    return { titleKey: "seller.titles.materials", descKey: "seller.titles.materialsDesc" };
  }
  return { titleKey: "seller.titles.overview", descKey: "seller.titles.overviewDesc" };
}

export function SellerNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { hasRole } = useAuth();
  const { t } = useLanguage();
  const warehouseOnly = hasRole("WAREHOUSE") && !hasRole("SELLER");
  const visible = warehouseOnly ? links.filter((l) => !l.sellerOnly) : links;

  return (
    <nav className="mq-seller-nav" aria-label={t("seller.brand")}>
      {visible.map((l) => {
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
            <span>{t(l.labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function SellerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, hasRole } = useAuth();
  const { t } = useLanguage();
  const { titleKey, descKey } = titleKeysFromPath(pathname);
  const warehouseOnly = hasRole("WAREHOUSE") && !hasRole("SELLER");

  return (
    <section className="mq-seller-page">
      <Container className="grid grid-cols-1 gap-5 items-start lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-6">
        <aside className="mq-seller-sidebar">
          <div className="mq-seller-identity">
            <span className="mq-seller-mark" aria-hidden>
              MQ
            </span>
            <div className="mq-seller-identity-text">
              <p className="mq-seller-kicker">
                {warehouseOnly ? t("seller.warehouseKicker") : t("seller.kicker")}
              </p>
              <h2 className="mq-seller-title">
                {warehouseOnly ? t("seller.warehouseBrand") : t("seller.brand")}
              </h2>
              <p className="mq-seller-sub">{user?.fullName || user?.email || "—"}</p>
            </div>
          </div>
          <SellerNav />
        </aside>

        <div className="mq-seller-main">
          <header className="mq-seller-main-head">
            <h1>{t(titleKey)}</h1>
            {descKey ? <p>{t(descKey)}</p> : null}
          </header>
          {children}
        </div>
      </Container>
    </section>
  );
}
