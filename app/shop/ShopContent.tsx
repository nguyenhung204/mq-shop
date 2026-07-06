"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { categories, getCategoryBySlug } from "@/lib/data/categories";
import { products } from "@/lib/data/products";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { ProductCard } from "@/components/ui/ProductCard";
import { Container, PageHero } from "@/components/ui/shared";

function CategoryFilters({
  categorySlug,
  onSelect,
}: {
  categorySlug: string | null;
  onSelect?: () => void;
}) {
  const { t } = useLanguage();

  return (
    <ul className="space-y-2">
      <li>
        <a
          href="/shop"
          className="text-sm text-mq-text-secondary hover:text-mq-text"
          onClick={onSelect}
        >
          {t("shop.allProducts")}
        </a>
      </li>
      {categories.map((cat) => (
        <li key={cat.slug}>
          <a
            href={`/shop?category=${cat.slug}`}
            className={`text-sm hover:text-mq-text ${categorySlug === cat.slug ? "text-mq-text font-medium" : "text-mq-text-secondary"}`}
            onClick={onSelect}
          >
            {t(`categories.${cat.slug}`)}
          </a>
        </li>
      ))}
    </ul>
  );
}

export function ShopContent() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const categorySlug = searchParams.get("category");
  const sort = searchParams.get("sort");
  const [filterOpen, setFilterOpen] = useState(false);

  const category = categorySlug ? getCategoryBySlug(categorySlug) : null;

  useEffect(() => {
    if (filterOpen) {
      document.body.classList.add("mq-mobile-nav-open");
    } else {
      document.body.classList.remove("mq-mobile-nav-open");
    }
    return () => document.body.classList.remove("mq-mobile-nav-open");
  }, [filterOpen]);

  const filtered = useMemo(() => {
    let list = categorySlug
      ? products.filter((p) => p.categorySlug === categorySlug)
      : [...products];

    if (sort === "deals") {
      list = list.filter((p) => p.salePercent);
    } else if (sort === "new") {
      list = list.filter((p) => p.badge === "new");
    } else if (sort === "popular") {
      list = [...list].sort((a, b) => b.reviewCount - a.reviewCount);
    } else if (sort === "price-low") {
      list = [...list].sort((a, b) => a.price - b.price);
    } else if (sort === "price-high") {
      list = [...list].sort((a, b) => b.price - a.price);
    }

    return list;
  }, [categorySlug, sort]);

  const pageTitle = category
    ? t(`categories.${category.slug}`)
    : t("nav.shop");

  const closeFilter = () => setFilterOpen(false);

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
              {filtered.length} {t("shop.products")}
            </span>
          </div>
          <select
            className="w-full sm:w-auto border border-mq-border bg-mq-surface px-4 py-2 text-sm text-mq-text outline-none"
            defaultValue={sort ?? ""}
            onChange={(e) => {
              const params = new URLSearchParams(searchParams.toString());
              if (e.target.value) params.set("sort", e.target.value);
              else params.delete("sort");
              window.location.search = params.toString();
            }}
          >
            <option value="">{t("shop.sortDefault")}</option>
            <option value="popular">{t("shop.sortPopular")}</option>
            <option value="new">{t("shop.sortLatest")}</option>
            <option value="deals">{t("shop.sortDeals")}</option>
            <option value="price-low">{t("shop.sortPriceLow")}</option>
            <option value="price-high">{t("shop.sortPriceHigh")}</option>
          </select>
        </div>

        {filterOpen && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 bg-black/40 md:hidden"
              aria-label="Close filter"
              onClick={closeFilter}
            />
            <aside className="fixed inset-y-0 left-0 z-50 w-[min(300px,88vw)] md:hidden bg-mq-surface border-r border-mq-border p-6 overflow-y-auto">
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
              <CategoryFilters categorySlug={categorySlug} onSelect={closeFilter} />
            </aside>
          </>
        )}

        <div className="flex gap-8">
          {filterOpen && (
            <aside className="hidden md:block w-[280px] shrink-0 border border-mq-border p-6 h-fit">
              <h3 className="text-sm font-semibold uppercase tracking-wider mb-4">
                {t("nav.categories")}
              </h3>
              <CategoryFilters categorySlug={categorySlug} />
            </aside>
          )}
          <div className="flex-1 min-w-0 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-10">
            {filtered.map((p, i) => (
              <div key={p.id} className="w-full">
                <ProductCard product={p} priority={i < 4} />
              </div>
            ))}
          </div>
        </div>
      </Container>
    </>
  );
}
