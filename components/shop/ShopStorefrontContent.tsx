"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Loader2, Search, Store, X } from "lucide-react";
import { useDebouncedCallback } from "@/lib/hooks/useDebounce";
import { categoryLabel } from "@/lib/api/categoryLabel";
import {
  rootCategories,
  useCatalogCategories,
  useCatalogListingPage,
  useShopStorefront,
} from "@/lib/queries/catalog";
import { getErrorMessage } from "@/lib/queries/utils";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { useRegion } from "@/components/providers/RegionProvider";
import { useDisplayMoney } from "@/components/providers/DisplayMoneyProvider";
import { ProductCard } from "@/components/ui/ProductCard";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { Container } from "@/components/ui/shared";

function parseOptionalNumber(value: string | null): number | undefined {
  if (value == null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export function ShopStorefrontContent() {
  const { t, locale } = useLanguage();
  const { regionCode } = useRegion();
  const params = useParams<{ id: string }>();
  const shopId = params.id;
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const { currency, convert, convertToTwd } = useDisplayMoney();

  const q = searchParams.get("q") || "";
  const categoryId = searchParams.get("category") || undefined;
  const sort = searchParams.get("sort") || "";
  const page = Number(searchParams.get("page") || "1") || 1;
  const minPrice = parseOptionalNumber(searchParams.get("minPrice"));
  const maxPrice = parseOptionalNumber(searchParams.get("maxPrice"));

  const [searchDraft, setSearchDraft] = useState(q);
  const [minDraft, setMinDraft] = useState<number | null>(() =>
    minPrice != null ? Math.round(convert(minPrice) * 100) / 100 : null,
  );
  const [maxDraft, setMaxDraft] = useState<number | null>(() =>
    maxPrice != null ? Math.round(convert(maxPrice) * 100) / 100 : null,
  );

  // Keep controlled drafts in sync when navigating via chips / back-forward.
  useEffect(() => {
    setSearchDraft(q);
    setMinDraft(minPrice != null ? Math.round(convert(minPrice) * 100) / 100 : null);
    setMaxDraft(maxPrice != null ? Math.round(convert(maxPrice) * 100) / 100 : null);
  }, [q, minPrice, maxPrice, convert]);

  // Reset price range when active currency/region changes to prevent cross-currency mismatch
  const prevCurrencyRef = useRef(currency);
  useEffect(() => {
    if (prevCurrencyRef.current !== currency) {
      prevCurrencyRef.current = currency;
      if (minPrice != null || maxPrice != null) {
        setMinDraft(null);
        setMaxDraft(null);
        updateParams({ minPrice: null, maxPrice: null }, { replace: true });
      }
    }
  }, [currency, minPrice, maxPrice]);

  const gridTopRef = useRef<HTMLDivElement>(null);

  const shopQuery = useShopStorefront(shopId);
  const categoriesQuery = useCatalogCategories();
  const listingQuery = useCatalogListingPage({
    shopId,
    q: q || undefined,
    categoryId,
    countryCode: regionCode || undefined,
    minPrice,
    maxPrice,
    page,
    pageSize: 8,
    enabled: Boolean(shopId) && !shopQuery.isError,
  });

  const categories = useMemo(
    () => rootCategories(categoriesQuery.data ?? []),
    [categoriesQuery.data],
  );

  const products = useMemo(() => {
    const items = listingQuery.data?.items ?? [];
    if (sort === "price-low") return [...items].sort((a, b) => a.price - b.price);
    if (sort === "price-high") return [...items].sort((a, b) => b.price - a.price);
    return items;
  }, [listingQuery.data?.items, sort]);

  // Keep page within valid bounds if total pages shrinks after filtering
  useEffect(() => {
    const totalPages = listingQuery.data?.meta?.totalPages;
    if (totalPages != null && totalPages > 0 && page > totalPages) {
      updateParams({ page: totalPages <= 1 ? null : String(totalPages) });
    }
  }, [listingQuery.data?.meta?.totalPages, page]);

  const updateParams = (
    patch: Record<string, string | null>,
    options?: { replace?: boolean },
  ) => {
    const next = new URLSearchParams(searchParams.toString());
    Object.entries(patch).forEach(([key, value]) => {
      if (value == null || value === "") next.delete(key);
      else next.set(key, value);
    });
    if (!("page" in patch)) next.delete("page");
    const qs = next.toString();
    startTransition(() => {
      const url = qs ? `${pathname}?${qs}` : pathname;
      if (options?.replace) {
        router.replace(url, { scroll: false });
      } else {
        router.push(url, { scroll: false });
      }
    });
  };

  const onPageChange = (nextPage: number) => {
    updateParams({ page: nextPage <= 1 ? null : String(nextPage) });
    if (gridTopRef.current) {
      gridTopRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const debouncedSearch = useDebouncedCallback((val: string) => {
    const trimmed = val.trim();
    const currentQ = (searchParams.get("q") || "").trim();
    if (trimmed === currentQ) return;
    updateParams({ q: trimmed || null }, { replace: true });
  }, 400);

  const onSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchDraft(val);
    debouncedSearch.debounced(val);
  };

  const onSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    debouncedSearch.flush(searchDraft);
  };

  const onClearSearch = () => {
    debouncedSearch.cancel();
    setSearchDraft("");
    updateParams({ q: null }, { replace: true });
  };

  const isDebouncing = searchDraft.trim() !== q.trim();
  const isSearching = isDebouncing || (listingQuery.isFetching && Boolean(q));

  const onApplyPrice = (e: FormEvent) => {
    e.preventDefault();
    if (minDraft != null && maxDraft != null && minDraft > maxDraft) return;

    const minTwd =
      minDraft != null ? Math.max(0, convertToTwd(minDraft)) : null;
    const maxTwd =
      maxDraft != null ? Math.max(0, convertToTwd(maxDraft)) : null;

    updateParams({
      minPrice: minTwd != null ? String(Number(minTwd.toFixed(2))) : null,
      maxPrice: maxTwd != null ? String(Number(maxTwd.toFixed(2))) : null,
    });
  };

  const clearFilters = () => {
    debouncedSearch.cancel();
    setSearchDraft("");
    setMinDraft(null);
    setMaxDraft(null);
    startTransition(() => router.push(pathname));
  };

  const shop = shopQuery.data;
  const hasFilters = Boolean(q || categoryId || minPrice != null || maxPrice != null);

  if (shopQuery.isError) {
    return (
      <Container className="py-20 text-center">
        <Store size={36} className="mx-auto text-mq-text-muted mb-4" strokeWidth={1.25} />
        <h1 className="text-xl text-mq-text mb-2">{t("storefront.notFound")}</h1>
        <p className="text-sm text-mq-text-muted mb-6">{t("storefront.notFoundHint")}</p>
        <Link href="/shop" className="mq-btn mq-btn-primary">
          {t("storefront.browseMarketplace")}
        </Link>
      </Container>
    );
  }

  return (
    <div className="mq-storefront">
      <section className="mq-storefront-hero">
        <div className="mq-storefront-banner">
          {shop?.bannerUrl ? (
            <Image
              src={shop.bannerUrl}
              alt=""
              fill
              priority
              className="object-cover"
              sizes="100vw"
            />
          ) : (
            <div className="mq-storefront-banner-fallback" aria-hidden />
          )}
          <div className="mq-storefront-banner-scrim" />
        </div>

        <Container className="relative z-[1] pb-8 md:pb-10">
          <nav className="pt-6 mb-8 text-xs text-white/70">
            <Link href="/shop" className="hover:text-white transition-colors">
              {t("nav.shop")}
            </Link>
            <span className="mx-2 opacity-50">/</span>
            <span className="text-white">{shop?.name ?? "…"}</span>
          </nav>

          <div className="flex flex-col sm:flex-row sm:items-end gap-5 sm:gap-6">
            <div className="mq-storefront-logo">
              {shop?.logoUrl ? (
                <Image
                  src={shop.logoUrl}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="96px"
                />
              ) : (
                <Store size={32} strokeWidth={1.5} className="text-mq-text-muted" />
              )}
            </div>
            <div className="min-w-0 flex-1 pb-1">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/65 mb-1.5">
                {t("storefront.officialShop")}
              </p>
              <h1 className="text-2xl md:text-4xl font-medium text-white tracking-tight truncate">
                {shopQuery.isLoading ? t("storefront.loading") : shop?.name}
              </h1>
              {shop?.countryCode ? (
                <p className="text-sm text-white/70 mt-1.5">
                  {t("storefront.shipsFrom")} {shop.countryCode}
                </p>
              ) : null}
            </div>
            <p className="text-sm text-white/75 sm:pb-2 shrink-0">
              {listingQuery.isLoading
                ? "…"
                : `${listingQuery.data?.meta?.total ?? products.length} ${t("shop.products")}`}
            </p>
          </div>
        </Container>
      </section>

      <Container className="py-8 md:py-12">
        <div ref={gridTopRef} className="mq-storefront-toolbar scroll-mt-20">
          <form onSubmit={onSearchSubmit} className="mq-storefront-search">
            {isSearching ? (
              <Loader2 size={16} className="text-mq-gold animate-spin shrink-0" aria-hidden="true" />
            ) : (
              <Search size={16} strokeWidth={1.75} className="text-mq-text-muted shrink-0" aria-hidden="true" />
            )}
            <input
              type="search"
              value={searchDraft}
              onChange={onSearchInputChange}
              placeholder={t("storefront.searchPlaceholder")}
              aria-label={t("storefront.searchPlaceholder")}
              className="mq-storefront-search-input"
            />
            {searchDraft ? (
              <button
                type="button"
                className="text-mq-text-muted hover:text-mq-text"
                aria-label="Clear"
                onClick={onClearSearch}
              >
                <X size={14} />
              </button>
            ) : null}
          </form>

          <select
            className="mq-input mq-storefront-sort"
            value={sort}
            aria-label={t("shop.sortDefault")}
            onChange={(e) => updateParams({ sort: e.target.value || null })}
          >
            <option value="">{t("shop.sortDefault")}</option>
            <option value="price-low">{t("shop.sortPriceLow")}</option>
            <option value="price-high">{t("shop.sortPriceHigh")}</option>
          </select>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-8 mt-8">
          <aside className="mq-storefront-filters">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-mq-text">
                {t("shop.filter")}
              </h2>
              {hasFilters ? (
                <button
                  type="button"
                  className="text-xs text-mq-text-muted hover:text-mq-text"
                  onClick={clearFilters}
                >
                  {t("storefront.clearFilters")}
                </button>
              ) : null}
            </div>

            <div className="mb-6">
              <p className="text-xs text-mq-text-muted mb-2">{t("nav.categories")}</p>
              <ul className="space-y-1.5">
                <li>
                  <button
                    type="button"
                    className={`mq-storefront-chip ${!categoryId ? "is-active" : ""}`}
                    onClick={() => updateParams({ category: null })}
                  >
                    {t("shop.allProducts")}
                  </button>
                </li>
                {categories.map((cat) => {
                  const label = locale
                    ? categoryLabel(cat, locale)
                    : cat.name || cat.slug;
                  return (
                    <li key={cat.id}>
                      <button
                        type="button"
                        className={`mq-storefront-chip ${
                          categoryId === cat.id ? "is-active" : ""
                        }`}
                        onClick={() => updateParams({ category: cat.id })}
                      >
                        {label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <form onSubmit={onApplyPrice} className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-mq-text-muted">{t("storefront.priceRange")}</p>
                <span className="text-[10px] font-bold text-mq-gold px-1.5 py-0.5 rounded bg-mq-gold/10">
                  {currency}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <CurrencyInput
                  currency={currency}
                  placeholder={t("storefront.minPrice")}
                  value={minDraft}
                  onChange={setMinDraft}
                  min={0}
                />
                <CurrencyInput
                  currency={currency}
                  placeholder={t("storefront.maxPrice")}
                  value={maxDraft}
                  onChange={setMaxDraft}
                  min={0}
                />
              </div>
              <button type="submit" className="mq-btn mq-btn-outline w-full text-sm">
                {t("storefront.applyPrice")}
              </button>
            </form>
          </aside>

          <div className={`min-w-0 ${pending ? "opacity-70 transition-opacity" : ""}`}>
            {listingQuery.isError ? (
              <div className="mq-alert mq-alert-error">
                {getErrorMessage(listingQuery.error, t("storefront.loadFailed"))}
              </div>
            ) : listingQuery.isLoading ? (
              <p className="text-sm text-mq-text-muted py-16 text-center">
                {t("storefront.loadingProducts")}
              </p>
            ) : products.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-sm text-mq-text-muted mb-4">
                  {t("storefront.empty")}
                </p>
                {hasFilters ? (
                  <button
                    type="button"
                    className="mq-btn mq-btn-outline text-sm"
                    onClick={clearFilters}
                  >
                    {t("storefront.clearFilters")}
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="mq-product-grid">
                {products.map((p, i) => (
                  <ProductCard key={p.id} product={p} priority={i < 4} index={i} />
                ))}
              </div>
            )}

            <PaginationBar
              className="mt-10"
              variant="storefront"
              page={page}
              meta={listingQuery.data?.meta}
              onPageChange={onPageChange}
            />
          </div>
        </div>
      </Container>
    </div>
  );
}
