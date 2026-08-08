// RankTree/types.ts

import type { Rank, PromotionRule } from './mockData';

// ─── Node Types ───────────────────────────────────────────────────────────────

/**
 * Một user thực trong cây MLM.
 */
export interface TreeUser {
  id: string;
  parentId: string | null;

  userName: string;
  email?: string;

  rank: number;
  rankName: string;

  /** Số lượng F1 trực tiếp. */
  f1Count: number;

  /** Tổng users trong subtree. */
  teamCount: number;

  isActive: boolean;

  /** Đã load children chưa. */
  childrenLoaded: boolean;

  /** Children IDs (nếu đã load). */
  childrenIds: string[];
}

/**
 * Node nhóm (aggregate) — đại diện cho nhiều user cùng rank
 * chưa được expand.
 *
 * Ví dụ: "R8 × 3 — 9 users"
 */
export interface GroupNode {
  id: string;
  parentId: string;

  type: 'group';

  rank: number;
  rankName: string;

  /** Số user trực tiếp trong group này. */
  count: number;

  /** Tổng user trong subtree (bao gồm con cháu). */
  userCount: number;
}

/**
 * Discriminated union cho tất cả node types
 * hiển thị trên graph.
 */
export type RankTreeNodeData =
  | (TreeUser & { type: 'user' })
  | GroupNode;

// ─── Graph Node/Edge ──────────────────────────────────────────────────────────

export interface GraphNode {
  id: string;
  data: RankTreeNodeData;
  type: 'html';
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'polyline';
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ─── API Response ─────────────────────────────────────────────────────────────

/**
 * Kết quả từ API khi load children.
 */
export interface LoadChildrenResponse {
  parentId: string;
  children: TreeUser[];
  meta: {
    total: number;
    hasMore: boolean;
  };
}

/**
 * Summary cho một user (dùng cho drawer).
 */
export interface UserSummary {
  id: string;
  userName: string;
  email?: string;
  rank: number;
  rankName: string;
  f1Count: number;
  teamCount: number;
  isActive: boolean;
  children: Array<{
    id: string;
    userName: string;
    rank: number;
    rankName: string;
    isActive: boolean;
  }>;
}

// ─── Component Props ──────────────────────────────────────────────────────────

/**
 * Labels i18n cho RankTree (truyền từ page qua props).
 */
export interface RankTreeLabels {
  expand: string;
  users: string;
  loading: string;
  f1Label: string;
  teamLabel: string;
  /** Node-specific labels */
  levelPrefix: string;       // "Cấp" / "Level" / "等級"
  levelLabel: string;        // "Cấp độ" / "Level" / "等級"
  f1Direct: string;          // "F1 TRỰC TIẾP" / "F1 DIRECT" / "F1 直屬"
  totalTeam: string;         // "TỔNG TEAM" / "TOTAL TEAM" / "總團隊"
  unit: string;              // "người" / "members" / "人"
  membersThisLevel: string;  // "thành viên cấp này" / "members at this level" / "此級成員"
  inBranch: string;          // "người trong nhánh" / "in branch" / "分支中"
}

export interface RankTreeProps {
  ranks: Rank[];
  rules: PromotionRule[];

  /**
   * Rank cao nhất của cây (root).
   * @default 10
   */
  rootRank?: number;

  /**
   * Rank thấp nhất muốn hiển thị khi expand.
   * @default 1
   */
  minRank?: number;

  /**
   * Chiều cao component.
   */
  height?: number | string;

  /**
   * i18n labels.
   */
  labels?: RankTreeLabels;

  /**
   * Current locale (e.g. 'vi', 'en', 'zh-TW').
   * Dùng để hiển thị tên rank theo ngôn ngữ.
   */
  locale?: string;

  /**
   * Callback khi admin muốn load children từ API.
   * Nếu không cung cấp, dùng mock data.
   */
  onLoadChildren?: (parentId: string) => Promise<LoadChildrenResponse>;

  /**
   * Callback khi admin click vào user node để xem chi tiết.
   */
  onUserClick?: (userId: string) => void;
}

// ─── Display Mode ─────────────────────────────────────────────────────────────

/**
 * Zoom-dependent display mode.
 */
export type DisplayMode = 'aggregate' | 'summary' | 'detail';

/**
 * Zoom thresholds.
 */
export const ZOOM_THRESHOLDS = {
  /** Dưới 0.4 → aggregate mode. */
  aggregate: 0.4,
  /** 0.4 – 0.8 → summary mode. */
  summary: 0.8,
  /** Trên 0.8 → detail mode. */
} as const;
