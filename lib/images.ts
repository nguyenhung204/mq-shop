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
};

export const categoryImages: Record<string, string> = {
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
