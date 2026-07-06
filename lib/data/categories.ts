import { categoryImages } from "@/lib/images";

export type Category = {
  slug: string;
  name: string;
  image: string;
  subcategories?: { slug: string; name: string }[];
};

export const categories: Category[] = [
  {
    slug: "accessories",
    name: "Accessories",
    image: categoryImages.accessories,
    subcategories: [
      { slug: "bags", name: "Bags" },
      { slug: "watches", name: "Watches" },
      { slug: "jewelry", name: "Jewelry" },
      { slug: "belts", name: "Belts" },
    ],
  },
  {
    slug: "apparel",
    name: "Apparel",
    image: categoryImages.apparel,
    subcategories: [
      { slug: "tops", name: "Tops" },
      { slug: "outerwear", name: "Outerwear" },
      { slug: "knitwear", name: "Knitwear" },
      { slug: "scarves", name: "Scarves" },
    ],
  },
  {
    slug: "home",
    name: "Home",
    image: categoryImages.home,
    subcategories: [
      { slug: "kitchen", name: "Kitchen" },
      { slug: "lighting", name: "Lighting" },
      { slug: "textiles", name: "Textiles" },
      { slug: "decor", name: "Decor" },
    ],
  },
  {
    slug: "tech",
    name: "Tech",
    image: categoryImages.tech,
    subcategories: [
      { slug: "audio", name: "Audio" },
      { slug: "chargers", name: "Chargers" },
      { slug: "cases", name: "Cases" },
      { slug: "smart-home", name: "Smart Home" },
    ],
  },
  {
    slug: "essentials",
    name: "Essentials",
    image: categoryImages.essentials,
    subcategories: [
      { slug: "candles", name: "Candles" },
      { slug: "care", name: "Care" },
      { slug: "wellness", name: "Wellness" },
      { slug: "travel", name: "Travel" },
    ],
  },
  {
    slug: "gifts",
    name: "Gifts",
    image: categoryImages.gifts,
    subcategories: [
      { slug: "gift-sets", name: "Gift Sets" },
      { slug: "under-50", name: "Under $50" },
      { slug: "under-100", name: "Under $100" },
      { slug: "corporate", name: "Corporate" },
    ],
  },
];

export function getCategoryBySlug(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}
