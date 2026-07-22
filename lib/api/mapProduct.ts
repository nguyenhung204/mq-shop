import type { Product } from "@/lib/data/products";
import type { ApiProduct as BeProduct, ListingCard as BeListing } from "@/lib/api/types";

export type { Product };

function firstImage(images?: BeProduct["images"]): string {
  if (!images || !images.length) return "/images/products/1.jpg";
  const first = images[0];
  return typeof first === "string" ? first : first.url || "/images/products/1.jpg";
}

function reasonText(reason: BeProduct["rejectionReason"]): string | undefined {
  if (!reason) return undefined;
  if (typeof reason === "string") return reason;
  return reason.vi || reason.en || reason["zh-TW"] || undefined;
}

/** Map public listing card → storefront ProductCard shape. */
export function mapListingCard(p: BeListing, categorySlug = "all"): Product {
  const outOfStock = p.displayMode === "OUT_OF_STOCK_WATERMARK" || p.stock <= 0;
  return {
    id: p.id,
    slug: p.id,
    name: p.title,
    brand: "MQ",
    price: Number(p.price) || 0,
    image: p.thumbnailUrl || "/images/products/1.jpg",
    category: "Shop",
    categorySlug,
    rating: 5,
    reviewCount: 0,
    description: "",
    features: outOfStock ? ["Out of stock"] : [],
    inStock: Math.max(0, p.stock),
    displayMode: p.displayMode,
    watermarkText: p.watermarkText,
  };
}

/** Map BE product (seller/admin/detail) to storefront ProductCard shape. */
export function mapApiProduct(p: BeProduct, locale = "vi"): Product {
  const translation =
    p.translations?.find((t) => t.locale === locale || t.locale === locale.replace("-", "_")) ||
    p.translations?.[0];
  const name = p.title || p.name || translation?.name || p.sku || "Product";
  const priceRaw = p.price ?? p.priceUsd;
  const price = typeof priceRaw === "string" ? Number(priceRaw) : Number(priceRaw ?? 0);
  const stock = typeof p.stock === "number" ? p.stock : p.isOutOfStock ? 0 : 99;
  const outOfStock = stock <= 0 || !!p.isOutOfStock || !!p.restockingOverlay;

  return {
    id: p.id,
    slug: p.slug || p.id,
    name,
    brand: "MQ",
    price: Number.isFinite(price) ? price : 0,
    image: firstImage(p.images),
    category: "Shop",
    categorySlug: p.categoryId || "all",
    rating: 5,
    reviewCount: 0,
    description: translation?.description || p.description || "",
    features: outOfStock ? ["Out of stock"] : [],
    inStock: stock,
    displayMode: outOfStock ? "OUT_OF_STOCK_WATERMARK" : "NORMAL",
    watermarkText: outOfStock
      ? { vi: "Hết hàng", zh: "缺貨", en: "Out of stock" }
      : null,
    rejectionReason: reasonText(p.rejectionReason),
    status: p.status,
  };
}
