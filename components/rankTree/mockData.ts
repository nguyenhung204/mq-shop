// RankTree/mockData.ts

export interface Rank {
  rank: number;
  name: string;
  nameI18n: {
    en: string;
    vi: string;
    'zh-TW': string;
  };
  teamPercent: string;
  referralPercent: string;
  globalFundTier: number | null;
  isActive: boolean;
}

export interface PromotionRule {
  id: number;
  fromRank: number;
  toRank: number;
  mode: 'seller_granted' | 'f1_rank';
  requiredF1Rank: number | null;
  count: number;
  isActive: boolean;
}

/**
 * Mock rank data.
 *
 * Sau này có thể bỏ data này và truyền ranks
 * trực tiếp từ API vào RankTree.
 */
export const MOCK_RANKS: Rank[] = [
  {
    rank: 0,
    name: 'Người mua hàng',
    nameI18n: {
      en: 'Buyer',
      vi: 'Người mua hàng',
      'zh-TW': '買家',
    },
    teamPercent: '0.0000',
    referralPercent: '0.0000',
    globalFundTier: null,
    isActive: true,
  },
  {
    rank: 1,
    name: 'Nhà phân phối',
    nameI18n: {
      en: 'Distributor',
      vi: 'Nhà phân phối',
      'zh-TW': '經銷商',
    },
    teamPercent: '0.0000',
    referralPercent: '5.0000',
    globalFundTier: null,
    isActive: true,
  },
  {
    rank: 2,
    name: 'Nhà phân phối khu vực',
    nameI18n: {
      en: 'Regional Distributor',
      vi: 'Nhà phân phối khu vực',
      'zh-TW': '區域經銷商',
    },
    teamPercent: '0.0000',
    referralPercent: '5.0000',
    globalFundTier: null,
    isActive: true,
  },
  {
    rank: 3,
    name: 'Đại lý',
    nameI18n: {
      en: 'Agency',
      vi: 'Đại lý',
      'zh-TW': '代理商',
    },
    teamPercent: '2.0000',
    referralPercent: '7.0000',
    globalFundTier: null,
    isActive: true,
  },
  {
    rank: 4,
    name: 'Đại lý khu vực',
    nameI18n: {
      en: 'Regional Agency',
      vi: 'Đại lý khu vực',
      'zh-TW': '區域代理商',
    },
    teamPercent: '4.0000',
    referralPercent: '8.0000',
    globalFundTier: null,
    isActive: true,
  },
  {
    rank: 5,
    name: 'Giám đốc',
    nameI18n: {
      en: 'Director',
      vi: 'Giám đốc',
      'zh-TW': '總監',
    },
    teamPercent: '6.0000',
    referralPercent: '9.0000',
    globalFundTier: 5,
    isActive: true,
  },
  {
    rank: 6,
    name: 'Tổng tài',
    nameI18n: {
      en: 'President',
      vi: 'Tổng tài',
      'zh-TW': '總裁',
    },
    teamPercent: '8.0000',
    referralPercent: '10.0000',
    globalFundTier: 6,
    isActive: true,
  },
  {
    rank: 7,
    name: 'Hoàng quan',
    nameI18n: {
      en: 'Crown',
      vi: 'Hoàng quan',
      'zh-TW': '皇冠',
    },
    teamPercent: '10.0000',
    referralPercent: '10.0000',
    globalFundTier: 7,
    isActive: true,
  },
  {
    rank: 8,
    name: 'Hoàng quan 1 sao',
    nameI18n: {
      en: '1-Star Crown',
      vi: 'Hoàng quan 1 sao',
      'zh-TW': '皇冠一星',
    },
    teamPercent: '11.0000',
    referralPercent: '10.0000',
    globalFundTier: 7,
    isActive: true,
  },
  {
    rank: 9,
    name: 'Hoàng quan 2 sao',
    nameI18n: {
      en: '2-Star Crown',
      vi: 'Hoàng quan 2 sao',
      'zh-TW': '皇冠二星',
    },
    teamPercent: '12.0000',
    referralPercent: '10.0000',
    globalFundTier: 7,
    isActive: true,
  },
  {
    rank: 10,
    name: 'Hoàng quan 3 sao',
    nameI18n: {
      en: '3-Star Crown',
      vi: 'Hoàng quan 3 sao',
      'zh-TW': '皇冠三星',
    },
    teamPercent: '13.0000',
    referralPercent: '10.0000',
    globalFundTier: 10,
    isActive: true,
  },
  {
    rank: 11,
    name: 'Hoàng quan 4 sao',
    nameI18n: {
      en: '4-Star Crown',
      vi: 'Hoàng quan 4 sao',
      'zh-TW': '四星皇冠',
    },
    teamPercent: '14.0000',
    referralPercent: '10.0000',
    globalFundTier: 10,
    isActive: false,
  },
  {
    rank: 12,
    name: 'Hoàng quan 5 sao',
    nameI18n: {
      en: '5-Star Crown',
      vi: 'Hoàng quan 5 sao',
      'zh-TW': '五星皇冠',
    },
    teamPercent: '15.0000',
    referralPercent: '10.0000',
    globalFundTier: 10,
    isActive: false,
  },
  {
    rank: 13,
    name: 'Hoàng quan 6 sao',
    nameI18n: {
      en: '6-Star Crown',
      vi: 'Hoàng quan 6 sao',
      'zh-TW': '六星皇冠',
    },
    teamPercent: '16.0000',
    referralPercent: '10.0000',
    globalFundTier: 10,
    isActive: false,
  },
];

/**
 * Promotion rules.
 */
export const MOCK_RULES: PromotionRule[] = [
  {
    id: 14,
    fromRank: 0,
    toRank: 1,
    mode: 'seller_granted',
    requiredF1Rank: null,
    count: 0,
    isActive: true,
  },
  {
    id: 2,
    fromRank: 1,
    toRank: 2,
    mode: 'f1_rank',
    requiredF1Rank: 1,
    count: 2,
    isActive: true,
  },
  {
    id: 3,
    fromRank: 2,
    toRank: 3,
    mode: 'f1_rank',
    requiredF1Rank: 2,
    count: 2,
    isActive: true,
  },
  {
    id: 4,
    fromRank: 3,
    toRank: 4,
    mode: 'f1_rank',
    requiredF1Rank: 3,
    count: 2,
    isActive: true,
  },
  {
    id: 5,
    fromRank: 4,
    toRank: 5,
    mode: 'f1_rank',
    requiredF1Rank: 4,
    count: 2,
    isActive: true,
  },
  {
    id: 6,
    fromRank: 5,
    toRank: 6,
    mode: 'f1_rank',
    requiredF1Rank: 5,
    count: 2,
    isActive: true,
  },
  {
    id: 7,
    fromRank: 6,
    toRank: 7,
    mode: 'f1_rank',
    requiredF1Rank: 6,
    count: 2,
    isActive: true,
  },
  {
    id: 8,
    fromRank: 7,
    toRank: 8,
    mode: 'f1_rank',
    requiredF1Rank: 7,
    count: 3,
    isActive: true,
  },
  {
    id: 9,
    fromRank: 8,
    toRank: 9,
    mode: 'f1_rank',
    requiredF1Rank: 8,
    count: 3,
    isActive: true,
  },
  {
    id: 10,
    fromRank: 9,
    toRank: 10,
    mode: 'f1_rank',
    requiredF1Rank: 9,
    count: 2,
    isActive: true,
  },
  {
    id: 13,
    fromRank: 10,
    toRank: 11,
    mode: 'f1_rank',
    requiredF1Rank: 10,
    count: 2,
    isActive: true,
  },
];

export const MOCK_USER_NAMES = [
  'Seed Seller',
  'Nguyễn Minh Anh',
  'Trần Hoàng Nam',
  'Lê Thu Hà',
  'Phạm Minh Đức',
  'Alex Chen',
  'Marcus Sterling',
  'Jordan V.',
  'Casey Roe',
  'Ava Wright',
  'Daniel Lee',
  'Sophia Nguyen',
];