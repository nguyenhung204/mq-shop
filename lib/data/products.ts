import { productImages } from "@/lib/images";

export type Product = {
  id: string;
  slug: string;
  name: string;
  brand: string;
  price: number;
  minPrice?: number;
  maxPrice?: number;
  originalPrice?: number;
  image: string;
  images?: string[];
  category: string;
  categorySlug: string;
  rating: number;
  reviewCount: number;
  badge?: "sale" | "new" | "hot";
  salePercent?: number;
  description: string;
  features: string[];
  inStock: number;
  displayMode?: "NORMAL" | "OUT_OF_STOCK_WATERMARK";
  watermarkText?: null | { vi: string; zh: string; en: string };
  rejectionReason?: string;
  status?: string;
  /** Public PDP variants for picker. */
  variants?: Array<{
    id: string;
    sku: string;
    price: number;
    availableStock: number;
    options: Record<string, string> | null;
    images: string[];
  }>;
  selectedVariantId?: string;
  shopId?: string;
  /** From PDP `data.shop` when shop is public. */
  shop?: {
    id: string;
    name: string;
    logoUrl: string | null;
  } | null;
  /** ISO-8601 from listing/PDP when available. */
  createdAt?: string;
  /** Country codes where this product is available (from DB country_codes column). */
  countryCodes?: string[];
};

export const products: Product[] = [
  {
    id: "1",
    slug: "mq-heritage-leather-tote",
    name: "MQ Heritage Leather Tote",
    brand: "MQ Studio",
    price: 189,
    originalPrice: 249,
    image: productImages["1"],
    category: "Accessories",
    categorySlug: "accessories",
    rating: 4.8,
    reviewCount: 124,
    badge: "sale",
    salePercent: 24,
    description:
      "Handcrafted full-grain leather tote with minimalist silhouette. Designed for everyday carry with reinforced handles and interior organization pockets.",
    features: [
      "Full-grain Italian leather",
      "Interior zip pocket + two slip pockets",
      "Magnetic closure",
      "Dimensions: 14 × 11 × 5 in",
    ],
    inStock: 18,
  },
  {
    id: "2",
    slug: "mq-merino-crew-sweater",
    name: "MQ Merino Crew Sweater",
    brand: "MQ Apparel",
    price: 128,
    image: productImages["2"],
    category: "Apparel",
    categorySlug: "apparel",
    rating: 4.6,
    reviewCount: 89,
    badge: "new",
    description:
      "Ultra-soft merino wool crew neck in a relaxed fit. Temperature-regulating and naturally odor-resistant for year-round wear.",
    features: [
      "100% extrafine merino wool",
      "Ribbed cuffs and hem",
      "Machine washable on gentle cycle",
      "Available in 6 neutral tones",
    ],
    inStock: 42,
  },
  {
    id: "3",
    slug: "mq-ceramic-pour-over-set",
    name: "MQ Ceramic Pour-Over Set",
    brand: "MQ Home",
    price: 76,
    image: productImages["3"],
    category: "Home",
    categorySlug: "home",
    rating: 4.9,
    reviewCount: 203,
    badge: "hot",
    description:
      "Artisan ceramic dripper and carafe set with matte glaze finish. Brews a clean, balanced cup with precise water flow control.",
    features: [
      "Hand-glazed stoneware",
      "Includes dripper, carafe, and bamboo paddle",
      "Dishwasher safe",
      "Serves 2–4 cups",
    ],
    inStock: 31,
  },
  {
    id: "4",
    slug: "mq-wireless-earbuds-pro",
    name: "MQ Wireless Earbuds Pro",
    brand: "MQ Tech",
    price: 159,
    originalPrice: 199,
    image: productImages["4"],
    category: "Tech",
    categorySlug: "tech",
    rating: 4.5,
    reviewCount: 312,
    badge: "sale",
    salePercent: 20,
    description:
      "Premium active noise cancellation with 36-hour total battery life. Spatial audio and multipoint connectivity for seamless switching.",
    features: [
      "ANC with transparency mode",
      "IPX5 water resistance",
      "Wireless charging case",
      "Bluetooth 5.3 multipoint",
    ],
    inStock: 56,
  },
  {
    id: "5",
    slug: "mq-linen-table-runner",
    name: "MQ Linen Table Runner",
    brand: "MQ Home",
    price: 48,
    image: productImages["5"],
    category: "Home",
    categorySlug: "home",
    rating: 4.7,
    reviewCount: 67,
    description:
      "Washed Belgian linen runner with natural texture. Softens with every wash while maintaining its structured drape.",
    features: [
      "100% Belgian linen",
      "Pre-washed for softness",
      "72 × 14 in",
      "OEKO-TEX certified",
    ],
    inStock: 24,
  },
  {
    id: "6",
    slug: "mq-minimalist-watch",
    name: "MQ Minimalist Watch",
    brand: "MQ Studio",
    price: 245,
    image: productImages["6"],
    category: "Accessories",
    categorySlug: "accessories",
    rating: 4.8,
    reviewCount: 156,
    badge: "new",
    description:
      "Swiss movement timepiece with sapphire crystal and vegetable-tanned leather strap. Understated elegance for any occasion.",
    features: [
      "Swiss quartz movement",
      "Sapphire crystal face",
      "5 ATM water resistance",
      "Interchangeable strap system",
    ],
    inStock: 12,
  },
  {
    id: "7",
    slug: "mq-organic-cotton-tee",
    name: "MQ Organic Cotton Tee",
    brand: "MQ Apparel",
    price: 42,
    image: productImages["7"],
    category: "Apparel",
    categorySlug: "apparel",
    rating: 4.4,
    reviewCount: 278,
    description:
      "Heavyweight organic cotton tee with a boxy fit. Garment-dyed for a lived-in feel from day one.",
    features: [
      "240gsm organic cotton",
      "Garment-dyed finish",
      "Reinforced neckline",
      "Unisex sizing",
    ],
    inStock: 88,
  },
  {
    id: "8",
    slug: "mq-scented-candle-trio",
    name: "MQ Scented Candle Trio",
    brand: "MQ Home",
    price: 64,
    originalPrice: 84,
    image: productImages["8"],
    category: "Essentials",
    categorySlug: "essentials",
    rating: 4.9,
    reviewCount: 91,
    badge: "sale",
    salePercent: 24,
    description:
      "Three hand-poured soy candles in signature MQ scents: Cedar & Sage, Bergamot & Vetiver, and Warm Amber.",
    features: [
      "100% soy wax blend",
      "Cotton wicks, 45hr burn each",
      "Recyclable glass vessels",
      "Gift-ready packaging",
    ],
    inStock: 35,
  },
  {
    id: "9",
    slug: "mq-travel-backpack",
    name: "MQ Travel Backpack",
    brand: "MQ Studio",
    price: 198,
    image: productImages["9"],
    category: "Accessories",
    categorySlug: "accessories",
    rating: 4.7,
    reviewCount: 143,
    badge: "hot",
    description:
      "Weather-resistant commuter backpack with padded laptop sleeve and quick-access front pocket. Carry-on compatible.",
    features: [
      "Recycled nylon shell",
      "15\" padded laptop compartment",
      "Luggage pass-through strap",
      "28L capacity",
    ],
    inStock: 22,
  },
  {
    id: "10",
    slug: "mq-gift-box-curated",
    name: "MQ Curated Gift Box",
    brand: "MQ Gifts",
    price: 120,
    image: productImages["10"],
    category: "Gifts",
    categorySlug: "gifts",
    rating: 5.0,
    reviewCount: 48,
    badge: "new",
    description:
      "A thoughtfully curated selection of MQ bestsellers in premium packaging. Perfect for any occasion.",
    features: [
      "Includes 4 signature items",
      "Custom greeting card",
      "Reusable magnetic box",
      "Free gift wrapping",
    ],
    inStock: 15,
  },
  {
    id: "11",
    slug: "mq-desk-lamp-brass",
    name: "MQ Brass Desk Lamp",
    brand: "MQ Home",
    price: 134,
    image: productImages["11"],
    category: "Home",
    categorySlug: "home",
    rating: 4.6,
    reviewCount: 72,
    description:
      "Adjustable brass task lamp with dimmable LED. Warm 2700K light ideal for reading and focused work.",
    features: [
      "Solid brass arm and base",
      "Touch dimmer control",
      "360° adjustable head",
      "Energy-efficient LED",
    ],
    inStock: 19,
  },
  {
    id: "12",
    slug: "mq-silk-scarf",
    name: "MQ Silk Scarf",
    brand: "MQ Apparel",
    price: 88,
    originalPrice: 110,
    image: productImages["12"],
    category: "Apparel",
    categorySlug: "apparel",
    rating: 4.8,
    reviewCount: 54,
    badge: "sale",
    salePercent: 20,
    description:
      "Hand-rolled edge silk twill scarf with abstract MQ monogram print. Versatile styling for any season.",
    features: [
      "100% mulberry silk twill",
      "Hand-rolled edges",
      "90 × 90 cm",
      "Dry clean recommended",
    ],
    inStock: 27,
  },
];

export function getProductBySlug(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

export function getProductsByCategory(categorySlug: string): Product[] {
  return products.filter((p) => p.categorySlug === categorySlug);
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "TWD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(price);
}
