"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { catalogApi } from "@/lib/api";
import { categoryLabel } from "@/lib/api/categoryLabel";
import { mapListingCard } from "@/lib/api/mapProduct";
import type { ApiCategory, PageMeta } from "@/lib/api/types";
import type { Product } from "@/lib/data/products";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { ProductCard } from "@/components/ui/ProductCard";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { Container, PageHero } from "@/components/ui/shared";

function CategoryFilters({
  categories,
  categoryId,
  onSelect,
}: {
  categories: ApiCategory[];
  categoryId: string | null;
  onSelect?: () => void;
}) {
  const { t, locale } = useLanguage();

  return (
    <ul className="space-y-2">
      <li>
        <a href="/shop" className="text-sm text-mq-text-secondary hover:text-mq-text" onClick={onSelect}>
          {t("shop.allProducts")}
        </a>
      </li>
      {categories.map((cat) => {
        const label = locale ? categoryLabel(cat, locale) : cat.name || cat.slug;
        return (
          <li key={cat.id}>
            <a
              href={`/shop?category=${encodeURIComponent(cat.id)}`}
              className={`text-sm hover:text-mq-text ${
                categoryId === cat.id ? "text-mq-text font-medium" : "text-mq-text-secondary"
              }`}
              onClick={onSelect}
            >
              {label}
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export function ShopContent() {
  const { t, locale } = useLanguage();
  const searchParams = useSearchParams();
  const categoryId = searchParams.get("category");
  const sort = searchParams.get("sort");
  const q = searchParams.get("q") || "";
  const page = Number(searchParams.get("page") || "1") || 1;
  const [filterOpen, setFilterOpen] = useState(false);
  const [apiProducts, setApiProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [meta, setMeta] = useState<PageMeta | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (filterOpen) document.body.classList.add("mq-mobile-nav-open");
    else document.body.classList.remove("mq-mobile-nav-open");
    return () => document.body.classList.remove("mq-mobile-nav-open");
  }, [filterOpen]);

  useEffect(() => {
    void catalogApi
      .categories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    void catalogApi
      .listing({
        q: q || undefined,
        categoryId: categoryId || undefined,
        page,
        pageSize: 24,
      })
      .then((res) => {
        setApiProducts(
          res.items.map((p) => mapListingCard(p, categoryId || "all")),
        );
        setMeta(res.meta);
      })
      .catch((err: unknown) => {
        setApiProducts([]);
        setMeta(undefined);
        setError(err instanceof Error ? err.message : "Failed to load products");
      })
      .finally(() => setLoading(false));
  }, [q, categoryId, page]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    let list = [...apiProducts];
    if (sort === "price-low") list.sort((a, b) => a.price - b.price);
    else if (sort === "price-high") list.sort((a, b) => b.price - a.price);
    return list;
  }, [apiProducts, sort]);

  const activeCategory = categories.find((c) => c.id === categoryId);
  const pageTitle = activeCategory
    ? locale
      ? categoryLabel(activeCategory, locale)
      : activeCategory.name || activeCategory.slug
    : t("nav.shop");
  const closeFilter = () => setFilterOpen(false);

  const setPage = (next: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next <= 1) params.delete("page");
    else params.set("page", String(next));
    window.location.search = params.toString();
  };

  return (
    <>
      <PageHero title={pageTitle} breadcrumb={[{ label: t("nav.shop") }]} />
      <Container className="py-10 md:py-14">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8 pb-4 border-b border-mq-border">
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => setFilterOpen(!filterOpen)}
              className="mq-btn mq-btn-outline text-sm"
            >
              {t("shop.filter")}
            </button>
            <span className="text-sm text-mq-text-muted">
              {loading
                ? "…"
                : `${meta?.total ?? filtered.length} ${t("shop.products")}`}
            </span>
          </div>
          <select
            className="mq-input w-full sm:w-auto"
            defaultValue={sort ?? ""}
            onChange={(e) => {
              const params = new URLSearchParams(searchParams.toString());
              if (e.target.value) params.set("sort", e.target.value);
              else params.delete("sort");
              window.location.search = params.toString();
            }}
          >
            <option value="">{t("shop.sortDefault")}</option>
            <option value="price-low">{t("shop.sortPriceLow")}</option>
            <option value="price-high">{t("shop.sortPriceHigh")}</option>
          </select>
        </div>

        {error && (
          <div className="mq-alert mq-alert-error mb-6">
            {error}
            <button type="button" className="ml-3 underline text-sm" onClick={load}>
              Retry
            </button>
          </div>
        )}

        {filterOpen && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 bg-black/40 md:hidden"
              aria-label="Close filter"
              onClick={closeFilter}
            />
            <aside className="fixed inset-y-0 left-0 z-50 w-[min(300px,88vw)] md:hidden bg-mq-surface border-r border-mq-border p-6 overflow-y-auto rounded-r-[var(--mq-radius-lg)] shadow-[var(--mq-shadow-lg)]">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-semibold uppercase tracking-wider">
                  {t("nav.categories")}
                </h3>
                <button
                  type="button"
                  onClick={closeFilter}
                  className="mq-icon-btn text-mq-text-muted hover:text-mq-text"
                  aria-label="Close filter"
                >
                  <X size={20} strokeWidth={1.5} />
                </button>
              </div>
              <CategoryFilters
                categories={categories}
                categoryId={categoryId}
                onSelect={closeFilter}
              />
            </aside>
          </>
        )}

        <div className="flex gap-8">
          {filterOpen && (
            <aside className="hidden md:block w-[280px] shrink-0 border border-mq-border p-6 h-fit rounded-[var(--mq-radius-lg)] shadow-[var(--mq-shadow-sm)]">
              <h3 className="text-sm font-semibold uppercase tracking-wider mb-4">
                {t("nav.categories")}
              </h3>
              <CategoryFilters categories={categories} categoryId={categoryId} />
            </aside>
          )}
          <div className="flex-1 min-w-0">
            {loading ? (
              <p className="text-sm text-mq-text-muted py-12">Loading…</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-mq-text-muted py-12">No products found.</p>
            ) : (
              <div className="mq-product-grid">
                {filtered.map((p, i) => (
                  <ProductCard key={p.id} product={p} priority={i < 4} />
                ))}
              </div>
            )}
            <PaginationBar
              className="mt-10"
              page={page}
              meta={meta}
              onPageChange={setPage}
            />
          </div>
        </div>
      </Container>
    </>
  );
}
