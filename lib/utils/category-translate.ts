/**
 * Simple dictionary-based auto-translate for category names.
 * Covers all 27 seeded categories + common e-commerce terms.
 * Falls back to empty string if no match found (user types manually).
 */

type LangTriple = { en: string; vi: string; tw: string };

const DICTIONARY: LangTriple[] = [
  // ── Root categories ──
  { en: "Electronics", vi: "Điện tử", tw: "電子產品" },
  { en: "Fashion", vi: "Thời trang", tw: "時尚" },
  { en: "Home & Living", vi: "Nhà cửa & đời sống", tw: "居家生活" },
  { en: "Beauty", vi: "Làm đẹp", tw: "美妝" },
  { en: "Toys", vi: "Đồ chơi", tw: "玩具" },
  { en: "Sports & Outdoors", vi: "Thể thao & ngoài trời", tw: "運動與戶外" },
  { en: "Books", vi: "Sách", tw: "書籍" },
  { en: "Groceries", vi: "Thực phẩm", tw: "食品雜貨" },

  // ── Electronics children ──
  { en: "Phones & Accessories", vi: "Điện thoại & phụ kiện", tw: "手機與配件" },
  { en: "Computers & Peripherals", vi: "Máy tính & linh kiện", tw: "電腦與周邊" },
  { en: "Audio", vi: "Âm thanh", tw: "音響設備" },

  // ── Fashion children ──
  { en: "Men", vi: "Nam", tw: "男裝" },
  { en: "Women", vi: "Nữ", tw: "女裝" },
  { en: "Footwear", vi: "Giày dép", tw: "鞋類" },

  // ── Home & Living children ──
  { en: "Furniture", vi: "Nội thất", tw: "傢俱" },
  { en: "Lighting", vi: "Đèn & chiếu sáng", tw: "燈飾照明" },
  { en: "Kitchen", vi: "Nhà bếp", tw: "廚房用品" },

  // ── Beauty children ──
  { en: "Skincare", vi: "Chăm sóc da", tw: "護膚" },
  { en: "Makeup", vi: "Trang điểm", tw: "彩妝" },

  // ── Toys children ──
  { en: "Building Sets", vi: "Lắp ráp", tw: "積木組合" },
  { en: "Outdoor Toys", vi: "Ngoài trời", tw: "戶外玩具" },

  // ── Sports children ──
  { en: "Fitness", vi: "Thể hình", tw: "健身" },
  { en: "Camping", vi: "Cắm trại", tw: "露營" },

  // ── Books children ──
  { en: "Fiction", vi: "Văn học", tw: "小說" },
  { en: "Education", vi: "Giáo dục", tw: "教育" },

  // ── Groceries children ──
  { en: "Snacks", vi: "Đồ ăn vặt", tw: "零食" },
  { en: "Beverages", vi: "Đồ uống", tw: "飲料" },

  // ── Common extras (not seeded but useful) ──
  { en: "Accessories", vi: "Phụ kiện", tw: "配件" },
  { en: "Bags & Wallets", vi: "Túi xách & Ví", tw: "包包與皮夾" },
  { en: "Decor", vi: "Trang trí", tw: "裝飾品" },
  { en: "Bedding", vi: "Chăn ga gối", tw: "寢具" },
  { en: "Hair Care", vi: "Chăm sóc tóc", tw: "護髮" },
  { en: "Supplements", vi: "Thực phẩm chức năng", tw: "保健食品" },
  { en: "Stationery", vi: "Văn phòng phẩm", tw: "文具" },
  { en: "Pets", vi: "Thú cưng", tw: "寵物" },
  { en: "Automotive", vi: "Ô tô & Xe máy", tw: "汽機車" },
  { en: "Jewelry", vi: "Trang sức", tw: "珠寶" },
  { en: "Watches", vi: "Đồng hồ", tw: "手錶" },
  { en: "Food & Beverages", vi: "Thực phẩm & Đồ uống", tw: "食品與飲料" },
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
