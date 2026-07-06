"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { categories } from "@/lib/data/categories";
import { elementPages, mainNav } from "@/lib/data/navigation";
import { products } from "@/lib/data/products";
import { ProductCard, ProductCardMini } from "@/components/ui/ProductCard";
import { ProductCarousel } from "@/components/ui/ProductCarousel";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useCart } from "@/components/providers/CartProvider";
import { heroImages } from "@/lib/images";

function NavBadge({ type }: { type: "sale" | "hot" | "new" }) {
  const map = { sale: "mq-badge-teal", hot: "mq-badge-pink", new: "mq-badge-cyan" };
  return <span className={`mq-badge ${map[type]} ml-1.5`}>{type}</span>;
}

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeMega, setActiveMega] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState(categories[0].slug);
  const menuRef = useRef<HTMLDivElement>(null);
  const { dark, toggle } = useTheme();
  const { itemCount } = useCart();

  const closeMega = useCallback(() => setActiveMega(null), []);

  useEffect(() => {
    if (!activeMega) return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target;
      if (
        menuRef.current &&
        (!(target instanceof Node) || !menuRef.current.contains(target))
      ) {
        closeMega();
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMega();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [activeMega, closeMega]);

  const dealProducts = products.filter((p) => p.salePercent);
  const bestSelling = products.slice(0, 4);

  return (
    <>
      <div
        ref={menuRef}
        className="sticky top-0 z-50 relative"
        onMouseLeave={(e) => {
          const next = e.relatedTarget;
          if (
            !(next instanceof Node) ||
            !menuRef.current?.contains(next)
          ) {
            closeMega();
          }
        }}
      >
        {activeMega && (
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default bg-black/20"
            aria-label="Close menu"
            onClick={closeMega}
          />
        )}

        <header className="relative z-50 bg-mq-surface border-b border-mq-border">
          <div
            className="mq-container flex items-center justify-between gap-6"
            style={{ height: "var(--mq-header-h)" }}
          >
          <Link href="/" className="shrink-0 border border-mq-text px-4 py-1.5" onClick={closeMega} onMouseEnter={closeMega}>
            <span className="text-xl font-medium tracking-[0.15em] text-mq-text uppercase">
              mq
            </span>
          </Link>

          <nav className="hidden lg:flex items-center h-full">
            {mainNav.map((item) => (
              <div
                key={item.label}
                className="relative h-full flex items-center"
                onMouseEnter={() => setActiveMega(item.mega)}
              >
                <Link
                  href={item.href}
                  className={`px-4 py-2 text-[15px] font-medium transition-colors flex items-center ${
                    activeMega === item.mega
                      ? "text-mq-gold"
                      : "text-mq-text hover:text-mq-text-secondary"
                  }`}
                >
                  {item.label}
                  {item.badge && <NavBadge type={item.badge} />}
                </Link>
              </div>
            ))}
          </nav>

          <div
            className="flex items-center gap-4 md:gap-5"
            onMouseEnter={closeMega}
          >
            <button type="button" className="text-mq-text hover:text-mq-gold transition-colors" aria-label="Search" onClick={closeMega}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
            <Link href="/my-account" className="hidden sm:block text-mq-text hover:text-mq-gold transition-colors" aria-label="Account" onClick={closeMega}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </Link>
            <Link href="/wishlist" className="hidden sm:block relative text-mq-text hover:text-mq-gold transition-colors" aria-label="Wishlist" onClick={closeMega}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </Link>
            <Link href="/cart" className="relative text-mq-text hover:text-mq-gold transition-colors" aria-label="Cart" onClick={closeMega}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              {itemCount > 0 && <span className="mq-count-badge">{itemCount}</span>}
            </Link>
            <button type="button" onClick={toggle} className="mq-theme-toggle hidden md:flex" aria-label="Toggle theme">
              {dark ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
            <button type="button" className="lg:hidden text-mq-text" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                {mobileOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
          </div>
        </header>

        {activeMega && (
          <div className="absolute left-0 right-0 top-full z-50 flex justify-center pt-1">
            <div className="mq-mega w-[92%] md:w-[80%] max-w-[1144px]">
              <div className="px-5 md:px-10 py-8">
              {activeMega === "categories" && (
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-10">
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-x-6 gap-y-4">
                    {categories.map((cat) => (
                      <div key={cat.slug}>
                        <Link
                          href={`/shop?category=${cat.slug}`}
                          className="text-sm font-semibold text-mq-text hover:text-mq-gold transition-colors mb-2 block"
                          onClick={closeMega}
                        >
                          {cat.name}
                        </Link>
                        <ul className="space-y-1">
                          {cat.subcategories?.map((sub) => (
                            <li key={sub.slug}>
                              <Link
                                href={`/shop?category=${cat.slug}`}
                                className="text-xs text-mq-text-secondary hover:text-mq-text transition-colors"
                                onClick={closeMega}
                              >
                                {sub.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                  <div className="border-l border-mq-border pl-8 hidden lg:block">
                    <h4 className="text-sm font-semibold text-mq-text mb-4">Best Selling</h4>
                    <div className="space-y-1">
                      {bestSelling.map((p) => (
                        <ProductCardMini key={p.id} product={p} />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeMega === "products" && (
                <div>
                  <div className="flex gap-6 mb-6 border-b border-mq-border pb-3">
                    {categories.slice(0, 3).map((cat) => (
                      <button
                        key={cat.slug}
                        type="button"
                        onClick={() => setActiveCategory(cat.slug)}
                        className={`text-sm font-medium pb-1 border-b-2 transition-colors ${
                          activeCategory === cat.slug
                            ? "text-mq-gold border-mq-gold"
                            : "text-mq-text-secondary border-transparent hover:text-mq-text"
                        }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                  <ProductCarousel
                    products={products.filter((p) => p.categorySlug === activeCategory).slice(0, 5)}
                  />
                </div>
              )}

              {activeMega === "shop" && (
                <div className="grid grid-cols-4 gap-8">
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-mq-text-muted mb-4">Product Types</h4>
                    <ul className="space-y-2 text-sm text-mq-text-secondary">
                      <li><Link href="/shop" className="hover:text-mq-gold">All Products</Link></li>
                      <li><Link href="/shop?sort=new" className="hover:text-mq-gold">New Arrivals</Link></li>
                      <li><Link href="/shop?sort=deals" className="hover:text-mq-gold">On Sale</Link></li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-mq-text-muted mb-4">Pages</h4>
                    <ul className="space-y-2 text-sm text-mq-text-secondary">
                      <li><Link href="/cart" className="hover:text-mq-gold">Cart</Link></li>
                      <li><Link href="/checkout" className="hover:text-mq-gold">Checkout</Link></li>
                      <li><Link href="/wishlist" className="hover:text-mq-gold">Wishlist</Link></li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-mq-text-muted mb-4">Features</h4>
                    <ul className="space-y-2 text-sm text-mq-text-secondary">
                      <li><Link href="/shop" className="hover:text-mq-gold">Quick View</Link></li>
                      <li><Link href="/shop?sort=popular" className="hover:text-mq-gold">Best Sellers</Link></li>
                    </ul>
                  </div>
                  <div className="relative h-48 overflow-hidden">
                    <Image src={heroImages.promo1} alt="MQ Collection" fill className="object-cover" sizes="300px" quality={70} />
                    <div className="absolute inset-0 bg-black/45 flex flex-col justify-end p-5">
                      <p className="text-white text-base font-display">New Season</p>
                      <Link href="/shop" className="mq-btn mq-btn-primary mt-2 w-fit text-xs">Shop Now</Link>
                    </div>
                  </div>
                </div>
              )}

              {(activeMega === "deals") && (
                <ProductCarousel products={dealProducts} />
              )}

              {activeMega === "elements" && (
                <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                  {elementPages.map((page) => (
                    <Link key={page.href} href={page.href} className="text-sm text-mq-text-secondary hover:text-mq-gold py-2 border-b border-mq-border transition-colors">
                      {page.label}
                    </Link>
                  ))}
                </div>
              )}
              </div>
            </div>
          </div>
        )}
      </div>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-mq-surface pt-[calc(var(--mq-topbar-h)+var(--mq-header-h))] overflow-y-auto">
          <nav className="mq-container py-6 space-y-1">
            {mainNav.map((item) => (
              <Link key={item.label} href={item.href} className="block py-3 text-base font-medium border-b border-mq-border" onClick={() => setMobileOpen(false)}>
                {item.label}
                {item.badge && <NavBadge type={item.badge} />}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </>
  );
}
