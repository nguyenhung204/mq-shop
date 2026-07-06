export const topBarLinks = [
  { key: "aboutUs", href: "/about-us" },
  { key: "contactUs", href: "/contact-us" },
  { key: "faqs", href: "/faqs" },
] as const;

export const mainNav = [
  { key: "shop", href: "/shop", badge: null, mega: "shop" },
  { key: "categories", href: "/shop", badge: "sale" as const, mega: "categories" },
  { key: "products", href: "/shop", badge: "hot" as const, mega: "products" },
  { key: "topDeals", href: "/shop?sort=deals", badge: null, mega: "deals" },
  { key: "elements", href: "#", badge: null, mega: "elements" },
] as const;

export const footerColumns = [
  {
    titleKey: "getToKnowUs",
    links: [
      { key: "aboutUs", href: "/about-us" },
      { key: "termsPolicy", href: "/privacy-policy" },
      { key: "careers", href: "/about-us" },
      { key: "contactUs", href: "/contact-us" },
    ],
  },
  {
    titleKey: "information",
    links: [
      { key: "helpCenter", href: "/faqs" },
      { key: "feedback", href: "/contact-us" },
      { key: "faqs", href: "/faqs" },
      { key: "sizeGuide", href: "/faqs" },
      { key: "payments", href: "/faqs" },
    ],
  },
  {
    titleKey: "ordersReturns",
    links: [
      { key: "trackOrder", href: "/my-account" },
      { key: "delivery", href: "/faqs" },
      { key: "services", href: "/contact-us" },
      { key: "returns", href: "/faqs" },
      { key: "exchange", href: "/faqs" },
    ],
  },
] as const;

export const elementPages = [
  { key: "accordion", href: "/accordion" },
  { key: "iconBox", href: "/icon-box" },
  { key: "portfolio", href: "/portfolio" },
  { key: "faqs", href: "/faqs" },
  { key: "gallery", href: "/gallery" },
  { key: "tabs", href: "/tabs" },
  { key: "aboutUs", href: "/about-us" },
  { key: "contactUs", href: "/contact-us" },
] as const;
