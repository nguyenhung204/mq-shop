"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState, useTransition } from "react";
import { Search, Store, X } from "lucide-react";
import { categoryLabel } from "@/lib/api/categoryLabel";
import {
  rootCategories,
  useCatalogCategories,
  useCatalogListingPage,
  useShopStorefront,
} from "@/lib/queries/catalog";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { ProductCard } from "@/components/ui/ProductCard";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { Container } from "@/components/ui/shared";

function parseOptionalNumber(value: string | null): number | undefined {
  if (value == null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export function ShopStorefrontContent() {
  const { t, locale } = useLanguage();
  const params = useParams<{ id: string }>();
  const shopId = params.id;
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const q = searchParams.get("q") || "";
  const categoryId = searchParams.get("category") || undefined;
  const sort = searchParams.get("sort") || "";
  const page = Number(searchParams.get("page") || "1") || 1;
  const minPrice = parseOptionalNumber(searchParams.get("minPrice"));
  const maxPrice = parseOptionalNumber(searchParams.get("maxPrice"));

  const [searchDraft, setSearchDraft] = useState(q);
  const [minDraft, setMinDraft] = useState(
    minPrice != null ? String(minPrice) : "",
  );
  const [maxDraft, setMaxDraft] = useState(
    maxPrice != null ? String(maxPrice) : "",
  );

  // Keep controlled drafts in sync when navigating via chips / back-forward.
  useEffect(() => {
    setSearchDraft(q);
    setMinDraft(minPrice != null ? String(minPrice) : "");
    setMaxDraft(maxPrice != null ? String(maxPrice) : "");
  }, [q, minPrice, maxPrice]);

  const shopQuery = useShopStorefront(shopId);
  const categoriesQuery = useCatalogCategories();
  const listingQuery = useCatalogListingPage({
    shopId,
    q: q || undefined,
    categoryId,
    minPrice,
    maxPrice,
    page,
    pageSize: 24,
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

  const updateParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams.toString());
    Object.entries(patch).forEach(([key, value]) => {
      if (value == null || value === "") next.delete(key);
      else next.set(key, value);
    });
    if (!("page" in patch)) next.delete("page");
    const qs = next.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  };

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    updateParams({ q: searchDraft.trim() || null });
  };

  const onApplyPrice = (e: FormEvent) => {
    e.preventDefault();
    const min = parseOptionalNumber(minDraft);
    const max = parseOptionalNumber(maxDraft);
    if (min != null && max != null && min > max) return;
    updateParams({
      minPrice: min != null ? String(min) : null,
      maxPrice: max != null ? String(max) : null,
    });
  };

  const clearFilters = () => {
    setSearchDraft("");
    setMinDraft("");
    setMaxDraft("");
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
        <div className="mq-storefront-toolbar">
          <form onSubmit={onSearch} className="mq-storefront-search">
            <Search size={16} strokeWidth={1.75} className="text-mq-text-muted shrink-0" />
            <input
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              placeholder={t("storefront.searchPlaceholder")}
              aria-label={t("storefront.searchPlaceholder")}
              className="mq-storefront-search-input"
            />
            {searchDraft ? (
              <button
                type="button"
                className="text-mq-text-muted hover:text-mq-text"
                aria-label="Clear"
                onClick={() => {
                  setSearchDraft("");
                  updateParams({ q: null });
                }}
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
              <p className="text-xs text-mq-text-muted">{t("storefront.priceRange")}</p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="mq-input"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder={t("storefront.minPrice")}
                  value={minDraft}
                  onChange={(e) => setMinDraft(e.target.value)}
                />
                <input
                  className="mq-input"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder={t("storefront.maxPrice")}
                  value={maxDraft}
                  onChange={(e) => setMaxDraft(e.target.value)}
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
                {listingQuery.error instanceof Error
                  ? listingQuery.error.message
                  : t("storefront.loadFailed")}
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
                  <ProductCard key={p.id} product={p} priority={i < 4} />
                ))}
              </div>
            )}

            <PaginationBar
              className="mt-10"
              page={page}
              meta={listingQuery.data?.meta}
              onPageChange={(next) =>
                updateParams({ page: next <= 1 ? null : String(next) })
              }
            />
          </div>
        </div>
      </Container>
    </div>
  );
}
