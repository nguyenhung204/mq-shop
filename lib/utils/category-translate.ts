/**
 * Simple dictionary-based auto-translate for category names.
 * Covers the 26 seeded categories + common e-commerce terms.
 * Falls back to empty string if no match found (user types manually).
 */

type LangTriple = { en: string; vi: string; tw: string };

const DICTIONARY: LangTriple[] = [
  { en: "Electronics", vi: "Điện tử", tw: "電子產品" },
  { en: "Smartphones", vi: "Điện thoại thông minh", tw: "智慧手機" },
  { en: "Laptops", vi: "Máy tính xách tay", tw: "筆記型電腦" },
  { en: "Audio", vi: "Âm thanh", tw: "音響設備" },
  { en: "Accessories", vi: "Phụ kiện", tw: "配件" },
  { en: "Fashion", vi: "Thời trang", tw: "時尚" },
  { en: "Men's Clothing", vi: "Quần áo nam", tw: "男裝" },
  { en: "Women's Clothing", vi: "Quần áo nữ", tw: "女裝" },
  { en: "Shoes", vi: "Giày dép", tw: "鞋類" },
  { en: "Bags & Wallets", vi: "Túi xách & Ví", tw: "包包與皮夾" },
  { en: "Home & Living", vi: "Nhà cửa & Đời sống", tw: "居家生活" },
  { en: "Furniture", vi: "Nội thất", tw: "家具" },
  { en: "Kitchen", vi: "Nhà bếp", tw: "廚房用品" },
  { en: "Decor", vi: "Trang trí", tw: "裝飾品" },
  { en: "Bedding", vi: "Chăn ga gối", tw: "寢具" },
  { en: "Beauty & Health", vi: "Sắc đẹp & Sức khoẻ", tw: "美容保健" },
  { en: "Skincare", vi: "Chăm sóc da", tw: "護膚" },
  { en: "Makeup", vi: "Trang điểm", tw: "彩妝" },
  { en: "Hair Care", vi: "Chăm sóc tóc", tw: "護髮" },
  { en: "Supplements", vi: "Thực phẩm chức năng", tw: "保健食品" },
  { en: "Toys & Kids", vi: "Đồ chơi & Trẻ em", tw: "玩具與兒童" },
  { en: "Educational Toys", vi: "Đồ chơi giáo dục", tw: "教育玩具" },
  { en: "Baby Gear", vi: "Đồ dùng cho bé", tw: "嬰兒用品" },
  { en: "Outdoor Toys", vi: "Đồ chơi ngoài trời", tw: "戶外玩具" },
  { en: "Board Games", vi: "Trò chơi bàn", tw: "桌遊" },
  { en: "Sports & Outdoors", vi: "Thể thao & Ngoài trời", tw: "運動與戶外" },
  // Common generic terms
  { en: "Food & Beverages", vi: "Thực phẩm & Đồ uống", tw: "食品與飲料" },
  { en: "Books", vi: "Sách", tw: "書籍" },
  { en: "Stationery", vi: "Văn phòng phẩm", tw: "文具" },
  { en: "Pets", vi: "Thú cưng", tw: "寵物" },
  { en: "Automotive", vi: "Ô tô & Xe máy", tw: "汽機車" },
  { en: "Jewelry", vi: "Trang sức", tw: "珠寶" },
  { en: "Watches", vi: "Đồng hồ", tw: "手錶" },
];

// Normalized lookup maps for fast matching
const byEn = new Map<string, LangTriple>();
const byVi = new Map<string, LangTriple>();
const byTw = new Map<string, LangTriple>();

for (const entry of DICTIONARY) {
  byEn.set(entry.en.toLowerCase(), entry);
  byVi.set(entry.vi.toLowerCase(), entry);
  byTw.set(entry.tw.toLowerCase(), entry);
}

export type CategoryLang = "en" | "vi" | "tw";

/**
 * Given a category name in one language, attempt to translate to the other two.
 * Returns { en, vi, tw } with empty strings for untranslatable fields.
 */
export function autoTranslateCategory(
  text: string,
  sourceLang: CategoryLang,
): { en: string; vi: string; tw: string } {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return { en: "", vi: "", tw: "" };

  let match: LangTriple | undefined;

  switch (sourceLang) {
    case "en":
      match = byEn.get(normalized);
      break;
    case "vi":
      match = byVi.get(normalized);
      break;
    case "tw":
      match = byTw.get(normalized);
      break;
  }

  if (match) {
    return { en: match.en, vi: match.vi, tw: match.tw };
  }

  // No exact match — return source in its slot, empty for others
  return {
    en: sourceLang === "en" ? text.trim() : "",
    vi: sourceLang === "vi" ? text.trim() : "",
    tw: sourceLang === "tw" ? text.trim() : "",
  };
}
