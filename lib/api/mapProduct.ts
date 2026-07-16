import type { ApiProduct } from "@/lib/api/types";
import type { Product } from "@/lib/data/products";

/** Map BE product to storefront ProductCard shape (mock-compatible). */
export function mapApiProduct(p: ApiProduct, locale = "vi"): Product {
  const translation =
    p.translations?.find((t) => t.locale === locale || t.locale === locale.replace("-", "_")) ||
    p.translations?.[0];
  const name = p.name || translation?.name || p.sku;
  const image = p.images?.[0]?.url || "/images/products/1.jpg";
  const price = typeof p.priceUsd === "string" ? Number(p.priceUsd) : Number(p.priceUsd ?? 0);

  return {
    id: p.id,
    slug: p.slug || p.id,
    name,
    brand: "MQ",
    price: Number.isFinite(price) ? price : 0,
    image,
    category: "Shop",
    categorySlug: p.categoryId || "all",
    rating: 5,
    reviewCount: 0,
    description: translation?.description || p.description || "",
    features: p.isOutOfStock || p.restockingOverlay ? ["Restocking"] : [],
    inStock: p.isOutOfStock ? 0 : 99,
  };
}
