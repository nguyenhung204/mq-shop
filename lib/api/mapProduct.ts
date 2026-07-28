import type { Product } from "@/lib/data/products";
import type {
  ApiProduct as BeProduct,
  ListingCard as BeListing,
  PublicProductDetail,
} from "@/lib/api/types";
import { toRatingNumber } from "@/lib/api/reviews";
import { PRODUCT_FALLBACK_IMAGE } from "@/lib/images";

export type { Product };

function firstImage(images?: BeProduct["images"] | string[]): string {
  if (!images || !images.length) return PRODUCT_FALLBACK_IMAGE;
  const first = images[0];
  return typeof first === "string" ? first : first.url || PRODUCT_FALLBACK_IMAGE;
}

function galleryImages(images?: BeProduct["images"] | string[]): string[] {
  if (!images?.length) return [];
  return images
    .map((img) => (typeof img === "string" ? img : img?.url || ""))
    .filter(Boolean);
}

function reasonText(reason: BeProduct["rejectionReason"]): string | undefined {
  if (!reason) return undefined;
  if (typeof reason === "string") return reason;
  return reason.vi || reason.en || reason["zh-TW"] || undefined;
}

function mapReviewStats(
  ratingAvg: number | string | null | undefined,
  reviewCount: number | null | undefined,
): { rating: number; reviewCount: number } {
  const count = Math.max(0, Number(reviewCount) || 0);
  const rating = count > 0 ? toRatingNumber(ratingAvg) : 0;
  return { rating, reviewCount: count };
}

/** Map public listing card → storefront ProductCard shape. */
export function mapListingCard(p: BeListing, categorySlug = "all"): Product {
  const outOfStock = p.displayMode === "OUT_OF_STOCK_WATERMARK" || p.stock <= 0;
  const minPrice = Number(p.minPrice ?? p.price) || 0;
  const maxPrice = Number(p.maxPrice ?? p.price) || minPrice;
  const stats = mapReviewStats(p.ratingAvg, p.reviewCount);
  return {
    id: p.id,
    slug: p.id,
    name: p.title,
    brand: "MQ",
    price: minPrice,
    minPrice,
    maxPrice,
    image: p.thumbnailUrl || PRODUCT_FALLBACK_IMAGE,
    category: "Shop",
    categorySlug,
    rating: stats.rating,
    reviewCount: stats.reviewCount,
    description: "",
    features: outOfStock ? ["Out of stock"] : [],
    inStock: Math.max(0, p.stock),
    displayMode: p.displayMode,
    watermarkText: p.watermarkText,
    shopId: p.shopId,
    createdAt: p.createdAt,
  };
}

/** Map GET /products/listing/:id → storefront PDP Product. */
export function mapPublicProductDetail(p: PublicProductDetail): Product {
  const variants = (p.variants ?? []).map((v) => ({
    id: v.id,
    sku: v.sku,
    price: Number(v.sellingPrice) || 0,
    availableStock: Math.max(0, v.availableStock ?? 0),
    options: v.options ?? null,
    images: Array.isArray(v.images) ? v.images.filter(Boolean) : [],
  }));
  const firstInStock = variants.find((v) => v.availableStock > 0) ?? variants[0];
  const gallery = galleryImages(p.images);
  const selectedImages =
    firstInStock?.images?.length ? firstInStock.images : gallery;
  const outOfStock =
    p.displayMode === "OUT_OF_STOCK_WATERMARK" ||
    (firstInStock ? firstInStock.availableStock <= 0 : p.stock <= 0);
  const stats = mapReviewStats(p.ratingAvg, p.reviewCount);

  return {
    id: p.id,
    slug: p.id,
    name: p.title,
    brand: "MQ",
    price: firstInStock?.price ?? (Number(p.minPrice ?? p.price) || 0),
    minPrice: Number(p.minPrice ?? p.price) || 0,
    maxPrice: Number(p.maxPrice ?? p.price) || 0,
    image: selectedImages[0] || PRODUCT_FALLBACK_IMAGE,
    images: gallery.length ? gallery : selectedImages,
    category: "Shop",
    categorySlug: p.categoryId || "all",
    rating: stats.rating,
    reviewCount: stats.reviewCount,
    description: p.description || "",
    features: outOfStock ? ["Out of stock"] : [],
    inStock: firstInStock?.availableStock ?? Math.max(0, p.stock),
    displayMode: p.displayMode,
    watermarkText: p.watermarkText,
    variants,
    selectedVariantId: firstInStock?.id,
    shopId: p.shopId,
    shop: p.shop
      ? {
          id: p.shop.id,
          name: p.shop.name,
          logoUrl: p.shop.logoUrl ?? null,
        }
      : p.shop === null
        ? null
        : undefined,
    createdAt: p.createdAt,
  };
}

/** Map BE product (seller/admin/detail) to storefront ProductCard shape. */
export function mapApiProduct(p: BeProduct, locale = "vi"): Product {
  const translation =
    p.translations?.find((t) => t.locale === locale || t.locale === locale.replace("-", "_")) ||
    p.translations?.[0];
  const name = p.title || p.name || translation?.name || p.sku || "Product";
  const priceRaw = p.minPrice ?? p.price ?? p.priceUsd;
  const price = typeof priceRaw === "string" ? Number(priceRaw) : Number(priceRaw ?? 0);
  const stock = typeof p.stock === "number" ? p.stock : p.isOutOfStock ? 0 : 99;
  const outOfStock = stock <= 0 || !!p.isOutOfStock || !!p.restockingOverlay;
  const variants = (p.variants ?? []).map((v) => ({
    id: v.id,
    sku: v.sku,
    price: Number(v.sellingPrice) || 0,
    availableStock: Math.max(0, v.availableStock ?? 0),
    options: v.options ?? null,
    images: Array.isArray(v.images) ? v.images.filter(Boolean) : [],
  }));
  const be = p as BeProduct & {
    ratingAvg?: number | string | null;
    reviewCount?: number | null;
  };
  const stats = mapReviewStats(be.ratingAvg, be.reviewCount);

  return {
    id: p.id,
    slug: p.slug || p.id,
    name,
    brand: "MQ",
    price: Number.isFinite(price) ? price : 0,
    minPrice: p.minPrice ?? (Number.isFinite(price) ? price : undefined),
    maxPrice: p.maxPrice ?? (Number.isFinite(price) ? price : undefined),
    image: firstImage(p.images),
    images: galleryImages(p.images),
    category: "Shop",
    categorySlug: p.categoryId || "all",
    rating: stats.rating,
    reviewCount: stats.reviewCount,
    description: translation?.description || p.description || "",
    features: outOfStock ? ["Out of stock"] : [],
    inStock: stock,
    displayMode: outOfStock ? "OUT_OF_STOCK_WATERMARK" : "NORMAL",
    watermarkText: outOfStock
      ? { vi: "Hết hàng", zh: "缺貨", en: "Out of stock" }
      : null,
    rejectionReason: reasonText(p.rejectionReason),
    status: p.status,
    variants,
    selectedVariantId: variants[0]?.id,
    shopId: p.shopId,
  };
}
