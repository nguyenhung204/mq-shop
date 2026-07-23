import type { Product } from "@/lib/data/products";
import type {
  ApiProduct as BeProduct,
  ListingCard as BeListing,
  PublicProductDetail,
} from "@/lib/api/types";

export type { Product };

function firstImage(images?: BeProduct["images"] | string[]): string {
  if (!images || !images.length) return "/images/products/1.jpg";
  const first = images[0];
  return typeof first === "string" ? first : first.url || "/images/products/1.jpg";
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

/** Map public listing card → storefront ProductCard shape. */
export function mapListingCard(p: BeListing, categorySlug = "all"): Product {
  const outOfStock = p.displayMode === "OUT_OF_STOCK_WATERMARK" || p.stock <= 0;
  const minPrice = Number(p.minPrice ?? p.price) || 0;
  const maxPrice = Number(p.maxPrice ?? p.price) || minPrice;
  return {
    id: p.id,
    slug: p.id,
    name: p.title,
    brand: "MQ",
    price: minPrice,
    minPrice,
    maxPrice,
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
    shopId: p.shopId,
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

  return {
    id: p.id,
    slug: p.id,
    name: p.title,
    brand: "MQ",
    price: firstInStock?.price ?? (Number(p.minPrice ?? p.price) || 0),
    minPrice: Number(p.minPrice ?? p.price) || 0,
    maxPrice: Number(p.maxPrice ?? p.price) || 0,
    image: selectedImages[0] || "/images/products/1.jpg",
    images: gallery.length ? gallery : selectedImages,
    category: "Shop",
    categorySlug: p.categoryId || "all",
    rating: 5,
    reviewCount: 0,
    description: p.description || "",
    features: outOfStock ? ["Out of stock"] : [],
    inStock: firstInStock?.availableStock ?? Math.max(0, p.stock),
    displayMode: p.displayMode,
    watermarkText: p.watermarkText,
    variants,
    selectedVariantId: firstInStock?.id,
    shopId: p.shopId,
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
    variants,
    selectedVariantId: variants[0]?.id,
    shopId: p.shopId,
  };
}
