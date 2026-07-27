import { catalogApi } from "@/lib/api";
import { mapPublicProductDetail } from "@/lib/api/mapProduct";
import type { Product } from "@/lib/data/products";

/** Prefer in-stock variant; fall back to first variant. */
export function pickDefaultVariantId(product: Product): string | undefined {
  const variants = product.variants ?? [];
  if (!variants.length) return product.selectedVariantId;
  const inStock = variants.find((v) => v.availableStock > 0);
  return (inStock ?? variants[0])?.id;
}

export function withDefaultVariant(product: Product): Product {
  const selectedVariantId =
    product.selectedVariantId || pickDefaultVariantId(product);
  if (!selectedVariantId) return product;
  const selected = product.variants?.find((v) => v.id === selectedVariantId);
  return {
    ...product,
    selectedVariantId,
    price: selected?.price ?? product.price,
    image: selected?.images?.[0] || product.image,
    inStock: selected?.availableStock ?? product.inStock,
  };
}

/**
 * Listing cards lack variants/shopId. Resolve via PDP when needed so
 * homepage "Add to cart" can default to the first in-stock SKU.
 */
export async function resolveProductForCart(product: Product): Promise<Product> {
  const hasVariant =
    Boolean(product.selectedVariantId) || Boolean(product.variants?.length);
  const hasShop = Boolean(product.shopId?.trim());
  if (hasVariant && hasShop) {
    return withDefaultVariant(product);
  }

  const detail = await catalogApi.productDetail(product.id);
  return withDefaultVariant(mapPublicProductDetail(detail));
}
