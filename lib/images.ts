/** Local images — served from /public, no external 404s */
const p = (path: string) => path;

/** Default placeholder when API/product has no image URL. */
export const PRODUCT_FALLBACK_IMAGE = p("/images/products/01.jpg");

export const productImages: Record<string, string> = {
  "1": p("/images/products/01.jpg"),
  "2": p("/images/products/02.jpg"),
  "3": p("/images/products/03.jpg"),
  "4": p("/images/products/04.jpg"),
  "5": p("/images/products/05.jpg"),
  "6": p("/images/products/06.jpg"),
  "7": p("/images/products/07.jpg"),
  "8": p("/images/products/08.jpg"),
  "9": p("/images/products/09.jpg"),
  "10": p("/images/products/10.jpg"),
  "11": p("/images/products/11.jpg"),
  "12": p("/images/products/12.jpg"),
  "13": p("/images/products/13.jpg"),
  "14": p("/images/products/14.jpg"),
  "15": p("/images/products/15.jpg"),
  "16": p("/images/products/16.jpg"),
  "17": p("/images/products/17.jpg"),
  "18": p("/images/products/18.jpg"),
  "19": p("/images/products/19.jpg"),
  "20": p("/images/products/20.jpg"),
  "21": p("/images/products/21.jpg"),
  "22": p("/images/products/22.jpg"),
  "23": p("/images/products/23.jpg"),
  "24": p("/images/products/24.jpg"),
  "25": p("/images/products/25.jpg"),
  "26": p("/images/products/26.jpg"),
  "27": p("/images/products/27.jpg"),
  "28": p("/images/products/28.jpg"),
  "29": p("/images/products/29.jpg"),
  "30": p("/images/products/30.jpg"),
  "31": p("/images/products/31.jpg"),
  "32": p("/images/products/32.jpg"),
  "33": p("/images/products/33.jpg"),
  "34": p("/images/products/34.jpg"),
  "35": p("/images/products/35.jpg"),
  "36": p("/images/products/36.jpg"),
};

export const categoryImages: Record<string, string> = {
  // Root categories
  electronics: p("/images/categories/electronics.jpg"),
  fashion: p("/images/categories/fashion.jpg"),
  "home-living": p("/images/categories/home-living.jpg"),
  beauty: p("/images/categories/beauty.jpg"),
  toys: p("/images/categories/toys.jpg"),
  sports: p("/images/categories/sports.jpg"),
  books: p("/images/categories/books.jpg"),
  groceries: p("/images/categories/groceries.jpg"),

  // Subcategories
  "phones-accessories": p("/images/categories/phones-accessories.jpg"),
  "computers-peripherals": p("/images/categories/computers-peripherals.jpg"),
  audio: p("/images/categories/audio.jpg"),
  "men-fashion": p("/images/categories/men-fashion.jpg"),
  "women-fashion": p("/images/categories/women-fashion.jpg"),
  footwear: p("/images/categories/footwear.jpg"),
  furniture: p("/images/categories/furniture.jpg"),
  lighting: p("/images/categories/lighting.jpg"),
  kitchen: p("/images/categories/kitchen.jpg"),
  skincare: p("/images/categories/skincare.jpg"),
  makeup: p("/images/categories/makeup.jpg"),
  "building-toys": p("/images/categories/building-toys.jpg"),
  "outdoor-toys": p("/images/categories/outdoor-toys.jpg"),
  fitness: p("/images/categories/fitness.jpg"),
  camping: p("/images/categories/camping.jpg"),
  fiction: p("/images/categories/fiction.jpg"),
  "education-books": p("/images/categories/education-books.jpg"),
  snacks: p("/images/categories/snacks.jpg"),
  beverages: p("/images/categories/beverages.jpg"),

  // Legacy / fallbacks
  accessories: p("/images/categories/accessories.jpg"),
  apparel: p("/images/categories/apparel.jpg"),
  home: p("/images/categories/home.jpg"),
  tech: p("/images/categories/tech.jpg"),
  essentials: p("/images/categories/essentials.jpg"),
  gifts: p("/images/categories/gifts.jpg"),
};

export const heroImages = {
  slide1: p("/images/hero/slide1.jpg"),
  slide2: p("/images/hero/slide2.jpg"),
  promo1: p("/images/hero/promo1.jpg"),
  promo2: p("/images/hero/promo2.jpg"),
};

export const galleryImages = Array.from({ length: 8 }, (_, i) =>
  p(`/images/gallery/0${i + 1}.jpg`),
);

export const miscImages = {
  about: p("/images/misc/about.jpg"),
  compareBefore: p("/images/misc/compare1.jpg"),
  compareAfter: p("/images/misc/compare2.jpg"),
};

export const portfolioImages = Array.from({ length: 6 }, (_, i) =>
  p(`/images/misc/portfolio0${i + 1}.jpg`),
);
