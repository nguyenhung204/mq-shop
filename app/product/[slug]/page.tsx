"use client";

import { useEffect, useState } from "react";
import { notFound, useParams } from "next/navigation";
import { catalogApi } from "@/lib/api";
import { mapListingCard, mapPublicProductDetail } from "@/lib/api/mapProduct";
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
      setMissing(false);
      try {
        const detail = await catalogApi.productDetail(slug);
        if (cancelled) return;
        setProduct(mapPublicProductDetail(detail));
        const listing = await catalogApi.listing({
          shopId: detail.shopId || undefined,
          categoryId: detail.shopId ? undefined : detail.categoryId || undefined,
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
