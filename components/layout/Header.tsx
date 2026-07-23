"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { elementPages, mainNav } from "@/lib/data/navigation";
import { ProductCardMini } from "@/components/ui/ProductCard";
import { ProductCarousel } from "@/components/ui/ProductCarousel";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { CartMenu } from "@/components/layout/CartMenu";
import { RoleSwitcher } from "@/components/layout/RoleSwitcher";
import { TopBar } from "@/components/layout/TopBar";
import { UserMenu } from "@/components/layout/UserMenu";
import { categoryLabel } from "@/lib/api/categoryLabel";
import {
  childCategories,
  rootCategories,
  useCatalogCategories,
  useCatalogListing,
} from "@/lib/queries/catalog";
import { heroImages } from "@/lib/images";
import type { Locale } from "@/lib/i18n/types";

function NavBadge({ type }: { type: "sale" | "hot" | "new" }) {
  const { t } = useLanguage();
  const map = { sale: "mq-badge-muted", hot: "mq-badge-pink", new: "mq-badge-cyan" };
  return <span className={`mq-badge ${map[type]} ml-1.5`}>{t(`badge.${type}`)}</span>;
}

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeMega, setActiveMega] = useState<string | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState("");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [suggestOpen, setSuggestOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLFormElement>(null);
  const { dark, toggle } = useTheme();
  const { t, locale } = useLanguage();
  const router = useRouter();

  const { data: apiCategories = [] } = useCatalogCategories();
  const roots = useMemo(() => rootCategories(apiCategories), [apiCategories]);

  useEffect(() => {
    if (!activeCategoryId && roots[0]?.id) {
      setActiveCategoryId(roots[0].id);
    }
  }, [roots, activeCategoryId]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 280);
    return () => window.clearTimeout(timer);
  }, [query]);

  const { data: featuredListing = [] } = useCatalogListing({ pageSize: 12 });
  const { data: categoryListing = [] } = useCatalogListing({
    categoryId: activeCategoryId || undefined,
    pageSize: 12,
    enabled: Boolean(activeCategoryId) && activeMega === "products",
  });
  const { data: searchSuggestions = [], isFetching: suggestLoading } =
    useCatalogListing({
      q: debouncedQuery,
      pageSize: 6,
      enabled: debouncedQuery.length >= 2,
    });

  const bestSelling = useMemo(() => featuredListing.slice(0, 4), [featuredListing]);
  const newest = useMemo(
    () =>
      [...featuredListing]
        .sort((a, b) => {
          const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
          const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
          return tb - ta;
        })
        .slice(0, 8),
    [featuredListing],
  );
  const productsForMega = categoryListing.length ? categoryListing : featuredListing;
  const showSuggestions =
    suggestOpen && debouncedQuery.length >= 2 && !mobileOpen && !activeMega;

  const closeMega = useCallback(() => setActiveMega(null), []);
  const closeSuggestions = useCallback(() => setSuggestOpen(false), []);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    const next = query.trim();
    closeMega();
    closeSuggestions();
    setMobileOpen(false);
    router.push(next ? `/shop?q=${encodeURIComponent(next)}` : "/shop");
  };

  useEffect(() => {
    if (!mobileOpen) return;

    const html = document.documentElement;
    const scrollY = window.scrollY;
    html.classList.add("mq-mobile-nav-open");
    document.body.classList.add("mq-mobile-nav-open");
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";

    return () => {
      html.classList.remove("mq-mobile-nav-open");
      document.body.classList.remove("mq-mobile-nav-open");
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.width = "";
      window.scrollTo(0, scrollY);
    };
  }, [mobileOpen]);

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

  useEffect(() => {
    if (!showSuggestions) return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target;
      if (
        searchRef.current &&
        (!(target instanceof Node) || !searchRef.current.contains(target))
      ) {
        closeSuggestions();
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSuggestions();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [showSuggestions, closeSuggestions]);

  const loc = (locale ?? "en") as Locale;

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

        <TopBar />

        <header className="relative z-50 overflow-visible bg-mq-surface border-b border-mq-border">
          <div
            className="mq-container flex items-center gap-3 lg:gap-4 xl:gap-6 overflow-visible"
            style={{ height: "var(--mq-header-h)" }}
          >
            <div className="flex items-center gap-3 xl:gap-4 shrink-0 min-w-0">
              <Link
                href="/"
                className="shrink-0 flex items-center gap-2.5"
                onClick={closeMega}
                onMouseEnter={closeMega}
              >
                <span className="w-8 h-8 rounded-[8px] border border-mq-text flex items-center justify-center">
                  <span className="w-2.5 h-2.5 rotate-45 border border-mq-text" />
                </span>
                <span className="text-lg font-semibold tracking-[0.12em] text-mq-text uppercase">
                  MQ
                </span>
              </Link>

              <nav className="hidden lg:flex items-center h-full">
                {mainNav.map((item) => (
                  <div
                    key={item.key}
                    className="relative h-full flex items-center"
                    onMouseEnter={() => setActiveMega(item.mega)}
                  >
                    <Link
                      href={item.href}
                      className={`px-2 xl:px-3 py-2 text-[14px] font-medium transition-colors flex items-center whitespace-nowrap ${
                        activeMega === item.mega
                          ? "text-mq-gold"
                          : "text-mq-text hover:text-mq-text-secondary"
                      }`}
                    >
                      {t(`nav.${item.key}`)}
                      {item.badge && <NavBadge type={item.badge} />}
                    </Link>
                  </div>
                ))}
              </nav>
            </div>

            <form
              ref={searchRef}
              onSubmit={handleSearch}
              className="relative flex-1 min-w-0 max-w-[420px] xl:max-w-[480px] mx-auto"
              onMouseEnter={closeMega}
            >
              <label className="relative block">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mq-text-muted pointer-events-none">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </span>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSuggestOpen(true);
                    closeMega();
                  }}
                  onFocus={() => {
                    setSuggestOpen(true);
                    closeMega();
                  }}
                  placeholder={t("nav.searchPlaceholder")}
                  className="w-full h-10 pl-10 pr-4 rounded-full border border-mq-border bg-mq-surface-subtle text-sm text-mq-text placeholder:text-mq-text-muted outline-none transition-colors focus:border-mq-text-muted focus:bg-mq-surface"
                  aria-label={t("nav.search")}
                  aria-autocomplete="list"
                  aria-expanded={showSuggestions}
                  autoComplete="off"
                />
              </label>

              {showSuggestions ? (
                <div
                  role="listbox"
                  className="absolute left-0 right-0 top-[calc(100%+0.4rem)] z-[60] overflow-hidden rounded-[var(--mq-radius-lg)] border border-mq-border bg-mq-surface shadow-[var(--mq-shadow-lg)]"
                >
                  {suggestLoading && searchSuggestions.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-mq-text-muted">
                      {t("nav.searching") || "Searching…"}
                    </p>
                  ) : searchSuggestions.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-mq-text-muted">
                      {t("nav.noSearchResults") || "No products found."}
                    </p>
                  ) : (
                    <ul className="max-h-[min(22rem,70vh)] overflow-y-auto py-1 px-2">
                      {searchSuggestions.map((product) => (
                        <li key={product.id} role="option">
                          <ProductCardMini
                            product={product}
                            onNavigate={() => {
                              closeSuggestions();
                              closeMega();
                              setMobileOpen(false);
                              setQuery("");
                              setDebouncedQuery("");
                            }}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                  <Link
                    href={`/shop?q=${encodeURIComponent(debouncedQuery)}`}
                    className="block border-t border-mq-border px-4 py-2.5 text-xs font-medium text-mq-text-secondary hover:text-mq-gold hover:bg-mq-surface-subtle transition-colors"
                    onClick={() => {
                      closeSuggestions();
                      closeMega();
                    }}
                  >
                    {t("nav.viewAllResults") || "View all results"} →
                  </Link>
                </div>
              ) : null}
            </form>

            <div
              className="flex items-center gap-0.5 sm:gap-1 shrink-0 ml-auto"
              onMouseEnter={closeMega}
            >
              <NotificationBell />
              <UserMenu />
              <CartMenu onNavigate={closeMega} />
              <Link
                href="/wishlist"
                className="hidden sm:inline-flex mq-icon-btn relative text-mq-text hover:text-mq-gold transition-colors"
                aria-label="Wishlist"
                onClick={closeMega}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </Link>

              <span className="hidden lg:block w-px h-5 bg-mq-border mx-1.5" aria-hidden />

              <LanguageSwitcher className="hidden lg:block" />
              <button
                type="button"
                onClick={toggle}
                className="hidden lg:inline-flex mq-theme-toggle mq-icon-btn"
                aria-label="Toggle theme"
              >
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

              <div className="shrink-0 lg:hidden">
                <button
                  type="button"
                  className="mq-mobile-nav-toggle mq-icon-btn text-mq-text"
                  onClick={() => {
                    closeMega();
                    setMobileOpen((open) => !open);
                  }}
                  aria-label="Menu"
                >
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
          </div>
        </header>

        {activeMega && (
          <div className="absolute left-0 right-0 top-full z-50 flex justify-center pt-1">
            <div className="mq-mega w-[92%] md:w-[80%] max-w-[1144px]">
              <div className="px-5 md:px-10 py-8">
              {activeMega === "categories" && (
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-10">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-6 gap-y-4">
                    {roots.length === 0 ? (
                      <p className="text-sm text-mq-text-muted col-span-full">
                        No categories yet.
                      </p>
                    ) : (
                      roots.map((cat) => {
                        const children = childCategories(apiCategories, cat.id);
                        return (
                          <div key={cat.id}>
                            <Link
                              href={`/shop?category=${encodeURIComponent(cat.id)}`}
                              className="text-sm font-semibold text-mq-text hover:text-mq-gold transition-colors mb-2 block"
                              onClick={closeMega}
                            >
                              {categoryLabel(cat, loc)}
                            </Link>
                            {children.length > 0 ? (
                              <ul className="space-y-1">
                                {children.map((sub) => (
                                  <li key={sub.id}>
                                    <Link
                                      href={`/shop?category=${encodeURIComponent(sub.id)}`}
                                      className="text-xs text-mq-text-secondary hover:text-mq-text transition-colors"
                                      onClick={closeMega}
                                    >
                                      {categoryLabel(sub, loc)}
                                    </Link>
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        );
                      })
                    )}
                  </div>
                  <div className="border-l border-mq-border pl-8 hidden lg:block">
                    <h4 className="text-sm font-semibold text-mq-text mb-4">{t("nav.bestSelling")}</h4>
                    <div className="space-y-1">
                      {bestSelling.length === 0 ? (
                        <p className="text-xs text-mq-text-muted">—</p>
                      ) : (
                        bestSelling.map((p) => (
                          <ProductCardMini key={p.id} product={p} />
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeMega === "products" && (
                <div>
                  <div className="flex gap-6 mb-6 border-b border-mq-border pb-3 overflow-x-auto">
                    {roots.slice(0, 6).map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setActiveCategoryId(cat.id)}
                        className={`text-sm font-medium pb-1 border-b-2 transition-colors whitespace-nowrap ${
                          activeCategoryId === cat.id
                            ? "text-mq-gold border-mq-gold"
                            : "text-mq-text-secondary border-transparent hover:text-mq-text"
                        }`}
                      >
                        {categoryLabel(cat, loc)}
                      </button>
                    ))}
                  </div>
                  {productsForMega.length > 0 ? (
                    <ProductCarousel products={productsForMega} />
                  ) : (
                    <p className="text-sm text-mq-text-muted py-6 text-center">
                      No products in this category yet.
                    </p>
                  )}
                </div>
              )}

              {activeMega === "shop" && (
                <div className="grid grid-cols-4 gap-8">
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-mq-text-muted mb-4">{t("mega.productTypes")}</h4>
                    <ul className="space-y-2 text-sm text-mq-text-secondary">
                      <li><Link href="/shop" className="hover:text-mq-gold" onClick={closeMega}>{t("mega.allProducts")}</Link></li>
                      <li><Link href="/shop?sort=new" className="hover:text-mq-gold" onClick={closeMega}>{t("mega.newArrivals")}</Link></li>
                      <li><Link href="/shop?sort=deals" className="hover:text-mq-gold" onClick={closeMega}>{t("mega.onSale")}</Link></li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-mq-text-muted mb-4">{t("mega.pages")}</h4>
                    <ul className="space-y-2 text-sm text-mq-text-secondary">
                      <li><Link href="/cart" className="hover:text-mq-gold" onClick={closeMega}>{t("nav.cart")}</Link></li>
                      <li><Link href="/checkout" className="hover:text-mq-gold" onClick={closeMega}>{t("checkout.title")}</Link></li>
                      <li><Link href="/orders" className="hover:text-mq-gold" onClick={closeMega}>{t("account.myOrders")}</Link></li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-mq-text-muted mb-4">{t("mega.features")}</h4>
                    <ul className="space-y-2 text-sm text-mq-text-secondary">
                      <li><Link href="/shop" className="hover:text-mq-gold" onClick={closeMega}>{t("mega.quickView")}</Link></li>
                      <li><Link href="/shop?sort=popular" className="hover:text-mq-gold" onClick={closeMega}>{t("mega.bestSellers")}</Link></li>
                    </ul>
                  </div>
                  <div className="relative h-48 overflow-hidden">
                    <Image src={heroImages.promo1} alt="MQ Collection" fill className="object-cover" sizes="300px" quality={70} />
                    <div className="absolute inset-0 bg-black/45 flex flex-col justify-end p-5">
                      <p className="text-white text-base font-display">{t("nav.newSeason")}</p>
                      <Link href="/shop" className="mq-btn mq-btn-primary mt-2 w-fit text-xs" onClick={closeMega}>{t("nav.shopNow")}</Link>
                    </div>
                  </div>
                </div>
              )}

              {activeMega === "deals" && (
                newest.length > 0 ? (
                  <ProductCarousel products={newest} />
                ) : (
                  <p className="text-sm text-mq-text-muted py-6 text-center">
                    No products yet.
                  </p>
                )
              )}

              {activeMega === "elements" && (
                <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                  {elementPages.map((page) => (
                    <Link key={page.href} href={page.href} className="text-sm text-mq-text-secondary hover:text-mq-gold py-2 border-b border-mq-border transition-colors" onClick={closeMega}>
                      {t(`nav.${page.key}`)}
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
        <div
          className="lg:hidden fixed inset-x-0 bottom-0 z-[45] flex flex-col min-h-0"
          style={{ top: "calc(var(--mq-topbar-h) + var(--mq-header-h))" }}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative flex flex-col flex-1 min-h-0 bg-mq-surface shadow-[0_-4px_24px_rgba(0,0,0,0.08)]">
            <nav className="flex-1 overflow-y-auto mq-container py-6">
              <div className="space-y-1 mb-8">
                {mainNav.map((item) => (
                  <Link
                    key={item.key}
                    href={item.href}
                    className="flex items-center py-3 text-base font-medium border-b border-mq-border"
                    onClick={() => setMobileOpen(false)}
                  >
                    {t(`nav.${item.key}`)}
                    {item.badge && <NavBadge type={item.badge} />}
                  </Link>
                ))}
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-mq-text-muted mb-3">
                  {t("nav.categories")}
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {roots.map((cat) => (
                    <Link
                      key={cat.id}
                      href={`/shop?category=${encodeURIComponent(cat.id)}`}
                      className="text-sm text-mq-text-secondary hover:text-mq-gold py-2"
                      onClick={() => setMobileOpen(false)}
                    >
                      {categoryLabel(cat, loc)}
                    </Link>
                  ))}
                </div>
              </div>
            </nav>

            <div className="shrink-0 overflow-visible mq-container py-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-mq-border bg-mq-surface space-y-3">
              <RoleSwitcher />
              <div className="flex items-center gap-1 overflow-visible">
                <NotificationBell />
                <UserMenu />
                <LanguageSwitcher menuAlign="start" menuPlacement="above" />
                <button type="button" onClick={toggle} className="mq-theme-toggle mq-icon-btn" aria-label="Toggle theme">
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
                <Link
                  href="/wishlist"
                  className="mq-icon-btn text-mq-text hover:text-mq-gold transition-colors"
                  aria-label={t("nav.wishlist")}
                  onClick={() => setMobileOpen(false)}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
