"use client";

import { useEffect, useState } from "react";
import { notFound, useParams } from "next/navigation";
import { catalogApi } from "@/lib/api";
import { mapApiProduct, mapListingCard } from "@/lib/api/mapProduct";
import type { Product } from "@/lib/data/products";
import { ProductPageContent } from "@/components/product/ProductPageContent";

export default function ProductPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        try {
          const detail = await catalogApi.product(slug);
          if (cancelled) return;
          const mapped = mapApiProduct(detail);
          setProduct(mapped);
          const listing = await catalogApi.listing({
            categoryId: detail.categoryId || undefined,
            pageSize: 12,
          });
          if (cancelled) return;
          setRelated(
            listing.items
              .filter((p) => p.id !== detail.id)
              .slice(0, 10)
              .map((p) => mapListingCard(p, detail.categoryId || "all")),
          );
        } catch {
          const listing = await catalogApi.listing({ q: slug, pageSize: 1 });
          const hit = listing.items[0];
          if (!hit) {
            if (!cancelled) setMissing(true);
            return;
          }
          if (cancelled) return;
          setProduct(mapListingCard(hit));
          const more = await catalogApi.listing({ pageSize: 12 });
          if (cancelled) return;
          setRelated(
            more.items
              .filter((p) => p.id !== hit.id)
              .slice(0, 10)
              .map((p) => mapListingCard(p)),
          );
        }
      } catch {
        if (!cancelled) setMissing(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (missing) notFound();
  if (loading || !product) {
    return (
      <div className="mq-container py-20 text-sm text-mq-text-muted">Loading product…</div>
    );
  }

  return <ProductPageContent product={product} related={related} />;
}
