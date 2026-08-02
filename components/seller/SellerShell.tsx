"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowLeftRight,
  ArrowRightLeft,
  BadgeDollarSign,
  BadgePercent,
  Boxes,
  Calculator,
  ChevronDown,
  FolderOpen,
  Gift,
  LayoutDashboard,
  MessageSquare,
  Network,
  Package,
  Receipt,
  RotateCcw,
  ShoppingBag,
  Store,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { Container } from "@/components/ui/shared";
import "./seller.css";

type NavLeaf = {
  href: string;
  labelKey: string;
  icon: typeof LayoutDashboard;
  sellerOnly: boolean;
};

type NavGroup = {
  id: "wallet";
  labelKey: string;
  icon: typeof Wallet;
  sellerOnly: boolean;
  baseHref: string;
  children: NavLeaf[];
};

type NavEntry = NavLeaf | NavGroup;

function isGroup(entry: NavEntry): entry is NavGroup {
  return "children" in entry;
}

const links: NavEntry[] = [
  { href: "/seller", labelKey: "seller.nav.overview", icon: LayoutDashboard, sellerOnly: true },
  {
    id: "wallet",
    labelKey: "seller.nav.wallet",
    icon: Wallet,
    sellerOnly: true,
    baseHref: "/seller/wallet",
    children: [
      {
        href: "/seller/wallet",
        labelKey: "seller.nav.walletOverview",
        icon: Wallet,
        sellerOnly: true,
      },
      {
        href: "/seller/wallet/transfer",
        labelKey: "seller.nav.walletTransfer",
        icon: ArrowLeftRight,
        sellerOnly: true,
      },
      {
        href: "/seller/wallet/withdraw",
        labelKey: "seller.nav.walletWithdraw",
        icon: BadgeDollarSign,
        sellerOnly: true,
      },
      {
        href: "/seller/wallet/network",
        labelKey: "seller.nav.walletNetwork",
        icon: Network,
        sellerOnly: true,
      },
      {
        href: "/seller/wallet/commissions",
        labelKey: "seller.nav.walletCommissions",
        icon: Gift,
        sellerOnly: true,
      },
    ],
  },
  { href: "/seller/shop", labelKey: "seller.nav.shop", icon: Store, sellerOnly: true },
  { href: "/seller/products", labelKey: "seller.nav.products", icon: Package, sellerOnly: true },
  { href: "/seller/reviews", labelKey: "seller.nav.reviews", icon: MessageSquare, sellerOnly: true },
  { href: "/seller/inventory", labelKey: "seller.nav.inventory", icon: Boxes, sellerOnly: false },
  { href: "/seller/orders", labelKey: "seller.nav.orders", icon: ShoppingBag, sellerOnly: true },
  {
    href: "/seller/settlements",
    labelKey: "seller.nav.settlements",
    icon: BadgeDollarSign,
    sellerOnly: true,
  },
  {
    href: "/seller/transactions",
    labelKey: "seller.nav.transactions",
    icon: Receipt,
    sellerOnly: true,
  },
  {
    href: "/seller/landing-cost",
    labelKey: "seller.nav.landingCost",
    icon: Calculator,
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
];

function titleKeysFromPath(pathname: string): { titleKey: string; descKey?: string } {
  if (pathname.startsWith("/seller/shop")) {
    return { titleKey: "seller.titles.shop", descKey: "seller.titles.shopDesc" };
  }
  if (pathname.startsWith("/seller/products")) {
    return { titleKey: "seller.titles.products", descKey: "seller.titles.productsDesc" };
  }
  if (pathname.startsWith("/seller/reviews")) {
    return { titleKey: "seller.titles.reviews", descKey: "seller.titles.reviewsDesc" };
  }
  if (pathname.startsWith("/seller/inventory/transfers")) {
    return { titleKey: "seller.transfers.title", descKey: "seller.transfers.description" };
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
  if (pathname.startsWith("/seller/transactions")) {
    return {
      titleKey: "seller.titles.transactions",
      descKey: "seller.titles.transactionsDesc",
    };
  }
  if (pathname === "/seller/wallet/transfer") {
    return {
      titleKey: "seller.titles.walletTransfer",
      descKey: "seller.titles.walletTransferDesc",
    };
  }
  if (pathname === "/seller/wallet/withdraw") {
    return {
      titleKey: "seller.titles.walletWithdraw",
      descKey: "seller.titles.walletWithdrawDesc",
    };
  }
  if (pathname.startsWith("/seller/wallet/withdrawals/")) {
    return {
      titleKey: "seller.titles.walletWithdrawDetail",
      descKey: "seller.titles.walletWithdrawDetailDesc",
    };
  }
  if (pathname === "/seller/wallet/network") {
    return {
      titleKey: "seller.titles.walletNetwork",
      descKey: "seller.titles.walletNetworkDesc",
    };
  }
  if (pathname === "/seller/wallet/commissions") {
    return {
      titleKey: "seller.titles.walletCommissions",
      descKey: "seller.titles.walletCommissionsDesc",
    };
  }
  if (pathname.startsWith("/seller/wallet")) {
    return { titleKey: "seller.titles.wallet", descKey: "seller.titles.walletDesc" };
  }
  if (pathname.startsWith("/seller/landing-cost")) {
    return { titleKey: "seller.titles.landingCost", descKey: "seller.titles.landingCostDesc" };
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

function leafActive(pathname: string, href: string): boolean {
  if (href === "/seller") return pathname === "/seller";
  if (href === "/seller/wallet") return pathname === "/seller/wallet";
  if (href === "/seller/wallet/withdraw") {
    return (
      pathname === href || pathname.startsWith("/seller/wallet/withdrawals")
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SellerNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { hasRole } = useAuth();
  const { t } = useLanguage();
  const warehouseOnly = hasRole("WAREHOUSE") && !hasRole("SELLER");
  // Buyer (no SELLER / WAREHOUSE role) landing on /seller/shop to apply —
  // only show the Shop nav item so the sidebar isn't confusing.
  const buyerApplying =
    !hasRole("SELLER") && !hasRole("WAREHOUSE") && pathname.startsWith("/seller/shop");
  const visible = buyerApplying
    ? links.filter((l) => !isGroup(l) && l.href === "/seller/shop")
    : warehouseOnly
      ? links.filter((l) => !l.sellerOnly)
      : links;

  const walletOpenByRoute = pathname.startsWith("/seller/wallet");
  const [walletOpen, setWalletOpen] = useState(walletOpenByRoute);

  useEffect(() => {
    if (walletOpenByRoute) setWalletOpen(true);
  }, [walletOpenByRoute]);

  return (
    <nav className="mq-seller-nav" aria-label={t("seller.brand")}>
      {visible.map((entry) => {
        if (isGroup(entry)) {
          const GroupIcon = entry.icon;
          const groupActive = pathname.startsWith(entry.baseHref);
          const open = walletOpen || groupActive;
          return (
            <div
              key={entry.id}
              className={`mq-seller-nav-group${open ? " is-open" : ""}${groupActive ? " is-active" : ""}`}
            >
              <button
                type="button"
                className={`mq-seller-nav-item mq-seller-nav-toggle${groupActive ? " is-active" : ""}`}
                aria-expanded={open}
                onClick={() => setWalletOpen((v) => !v)}
              >
                <GroupIcon size={17} strokeWidth={1.75} aria-hidden />
                <span className="flex-1 text-left">{t(entry.labelKey)}</span>
                <ChevronDown
                  size={15}
                  strokeWidth={2}
                  className={`mq-seller-nav-chevron${open ? " is-open" : ""}`}
                  aria-hidden
                />
              </button>
              {open ? (
                <div className="mq-seller-nav-sub" role="group" aria-label={t(entry.labelKey)}>
                  {entry.children.map((child) => {
                    const active = leafActive(pathname, child.href);
                    const ChildIcon = child.icon;
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={`mq-seller-nav-subitem${active ? " is-active" : ""}`}
                        aria-current={active ? "page" : undefined}
                        onClick={onNavigate}
                      >
                        <ChildIcon size={15} strokeWidth={1.75} aria-hidden />
                        <span>{t(child.labelKey)}</span>
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        }

        const active = leafActive(pathname, entry.href);
        const Icon = entry.icon;
        return (
          <Link
            key={entry.href}
            href={entry.href}
            className={`mq-seller-nav-item${active ? " is-active" : ""}`}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
          >
            <Icon size={17} strokeWidth={1.75} aria-hidden />
            <span>{t(entry.labelKey)}</span>
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
  const buyerApplying =
    !hasRole("SELLER") && !hasRole("WAREHOUSE") && pathname.startsWith("/seller/shop");

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
                {warehouseOnly
                  ? t("seller.warehouseKicker")
                  : buyerApplying
                    ? t("seller.applyKicker")
                    : t("seller.kicker")}
              </p>
              <h2 className="mq-seller-title">
                {warehouseOnly
                  ? t("seller.warehouseBrand")
                  : buyerApplying
                    ? t("seller.applyBrand")
                    : t("seller.brand")}
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
