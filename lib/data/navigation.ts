export const topBarLinks = [
  { label: "About Us", href: "/about-us" },
  { label: "Contact Us", href: "/contact-us" },
  { label: "FAQs", href: "/faqs" },
];

export const mainNav = [
  {
    label: "Shop",
    href: "/shop",
    badge: null,
    mega: "shop",
  },
  {
    label: "Categories",
    href: "/shop",
    badge: "sale" as const,
    mega: "categories",
  },
  {
    label: "Products",
    href: "/shop",
    badge: "hot" as const,
    mega: "products",
  },
  {
    label: "Top Deals",
    href: "/shop?sort=deals",
    badge: null,
    mega: "deals",
  },
  {
    label: "Elements",
    href: "#",
    badge: null,
    mega: "elements",
  },
];

export const footerColumns = [
  {
    title: "Get To Know Us",
    links: [
      { label: "About Us", href: "/about-us" },
      { label: "Terms & Policy", href: "/privacy-policy" },
      { label: "Careers", href: "/about-us" },
      { label: "Contact Us", href: "/contact-us" },
    ],
  },
  {
    title: "Information",
    links: [
      { label: "Help Center", href: "/faqs" },
      { label: "Feedback", href: "/contact-us" },
      { label: "FAQs", href: "/faqs" },
      { label: "Size Guide", href: "/faqs" },
      { label: "Payments", href: "/faqs" },
    ],
  },
  {
    title: "Orders & Returns",
    links: [
      { label: "Track Order", href: "/my-account" },
      { label: "Delivery", href: "/faqs" },
      { label: "Services", href: "/contact-us" },
      { label: "Returns", href: "/faqs" },
      { label: "Exchange", href: "/faqs" },
    ],
  },
];

export const elementPages = [
  { label: "Accordion", href: "/accordion" },
  { label: "Icon Box", href: "/icon-box" },
  { label: "Portfolio", href: "/portfolio" },
  { label: "FAQs", href: "/faqs" },
  { label: "Gallery", href: "/gallery" },
  { label: "Tabs", href: "/tabs" },
  { label: "About Us", href: "/about-us" },
  { label: "Contact Us", href: "/contact-us" },
];
