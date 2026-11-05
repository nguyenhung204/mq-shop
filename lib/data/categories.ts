import { categoryImages } from "@/lib/images";

export type Category = {
  slug: string;
  name: string;
  image: string;
  subcategories?: { slug: string; name: string; image?: string }[];
};

export const categories: Category[] = [
  {
    slug: "electronics",
    name: "Electronics",
    image: categoryImages.electronics,
    subcategories: [
      { slug: "phones-accessories", name: "Phones & Accessories", image: categoryImages["phones-accessories"] },
      { slug: "computers-peripherals", name: "Computers & Peripherals", image: categoryImages["computers-peripherals"] },
      { slug: "audio", name: "Audio", image: categoryImages.audio },
    ],
  },
  {
    slug: "fashion",
    name: "Fashion",
    image: categoryImages.fashion,
    subcategories: [
      { slug: "men-fashion", name: "Men", image: categoryImages["men-fashion"] },
      { slug: "women-fashion", name: "Women", image: categoryImages["women-fashion"] },
      { slug: "footwear", name: "Footwear", image: categoryImages.footwear },
    ],
  },
  {
    slug: "home-living",
    name: "Home & Living",
    image: categoryImages["home-living"],
    subcategories: [
      { slug: "furniture", name: "Furniture", image: categoryImages.furniture },
      { slug: "lighting", name: "Lighting", image: categoryImages.lighting },
      { slug: "kitchen", name: "Kitchen", image: categoryImages.kitchen },
    ],
  },
  {
    slug: "beauty",
    name: "Beauty",
    image: categoryImages.beauty,
    subcategories: [
      { slug: "skincare", name: "Skincare", image: categoryImages.skincare },
      { slug: "makeup", name: "Makeup", image: categoryImages.makeup },
    ],
  },
  {
    slug: "toys",
    name: "Toys",
    image: categoryImages.toys,
    subcategories: [
      { slug: "building-toys", name: "Building Sets", image: categoryImages["building-toys"] },
      { slug: "outdoor-toys", name: "Outdoor Toys", image: categoryImages["outdoor-toys"] },
    ],
  },
  {
    slug: "sports",
    name: "Sports & Outdoors",
    image: categoryImages.sports,
    subcategories: [
      { slug: "fitness", name: "Fitness", image: categoryImages.fitness },
      { slug: "camping", name: "Camping", image: categoryImages.camping },
    ],
  },
  {
    slug: "books",
    name: "Books",
    image: categoryImages.books,
    subcategories: [
      { slug: "fiction", name: "Fiction", image: categoryImages.fiction },
      { slug: "education-books", name: "Education", image: categoryImages["education-books"] },
    ],
  },
  {
    slug: "groceries",
    name: "Groceries",
    image: categoryImages.groceries,
    subcategories: [
      { slug: "snacks", name: "Snacks", image: categoryImages.snacks },
      { slug: "beverages", name: "Beverages", image: categoryImages.beverages },
    ],
  },
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
