"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { categories, getCategoryBySlug } from "@/lib/data/categories";
import { products } from "@/lib/data/products";
import { ProductCard } from "@/components/ui/ProductCard";
import { Container, PageHero } from "@/components/ui/shared";

export function ShopContent() {
  const searchParams = useSearchParams();
  const categorySlug = searchParams.get("category");
  const sort = searchParams.get("sort");
  const [filterOpen, setFilterOpen] = useState(false);

  const category = categorySlug ? getCategoryBySlug(categorySlug) : null;

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

  return (
    <>
      <PageHero
        title={category ? category.name : "Shop"}
        breadcrumb={[{ label: "Shop" }]}
      />
      <Container className="py-10 md:py-14">
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-mq-border">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setFilterOpen(!filterOpen)}
              className="mq-btn mq-btn-outline text-sm"
            >
              Filter
            </button>
            <span className="text-sm text-mq-text-muted">
              {filtered.length} products
            </span>
          </div>
          <select
            className="border border-mq-border bg-mq-surface px-4 py-2 text-sm text-mq-text outline-none"
            defaultValue={sort ?? ""}
            onChange={(e) => {
              const params = new URLSearchParams(searchParams.toString());
              if (e.target.value) params.set("sort", e.target.value);
              else params.delete("sort");
              window.location.search = params.toString();
            }}
          >
            <option value="">Default sorting</option>
            <option value="popular">Popularity</option>
            <option value="new">Latest</option>
            <option value="deals">On Sale</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
          </select>
        </div>

        <div className="flex gap-8">
          {filterOpen && (
            <aside className="w-[280px] shrink-0 hidden md:block border border-mq-border p-6 h-fit">
              <h3 className="text-sm font-semibold uppercase tracking-wider mb-4">
                Categories
              </h3>
              <ul className="space-y-2">
                <li>
                  <a href="/shop" className="text-sm text-mq-text-secondary hover:text-mq-text">
                    All Products
                  </a>
                </li>
                {categories.map((cat) => (
                  <li key={cat.slug}>
                    <a
                      href={`/shop?category=${cat.slug}`}
                      className={`text-sm hover:text-mq-text ${categorySlug === cat.slug ? "text-mq-text font-medium" : "text-mq-text-secondary"}`}
                    >
                      {cat.name}
                    </a>
                  </li>
                ))}
              </ul>
            </aside>
          )}
          <div className="flex-1 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-10">
            {filtered.map((p) => (
              <div key={p.id} className="w-full">
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        </div>
      </Container>
    </>
  );
}
