// RankTree/utils.ts

import type { PromotionRule, Rank } from './mockData';
import type {
  TreeUser,
  GroupNode,
  RankTreeNodeData,
  GraphNode,
  GraphEdge,
  GraphData,
  LoadChildrenResponse,
} from './types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Generate initials cho avatar.
 */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  return parts
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

/**
 * Màu theo rank.
 */
export function getRankColor(rank: number) {
  if (rank >= 10) {
    return { background: '#fee2e2', color: '#dc2626', border: '#fecaca' };
  }
  if (rank === 9) {
    return { background: '#ffedd5', color: '#ea580c', border: '#fed7aa' };
  }
  if (rank >= 7) {
    return { background: '#fef3c7', color: '#b45309', border: '#fde68a' };
  }
  if (rank >= 5) {
    return { background: '#ede9fe', color: '#7c3aed', border: '#ddd6fe' };
  }
  if (rank >= 3) {
    return { background: '#dbeafe', color: '#2563eb', border: '#bfdbfe' };
  }
  return { background: '#d1fae5', color: '#059669', border: '#a7f3d0' };
}

/**
 * Lấy rank config.
 */
export function findRank(ranks: Rank[], rankNumber: number): Rank | undefined {
  return ranks.find((item) => item.rank === rankNumber);
}

/**
 * Lấy tên rank theo locale.
 */
export function getRankName(rank: Rank | undefined, locale?: string): string {
  if (!rank) return '';
  if (locale && rank.nameI18n) {
    const localized = (rank.nameI18n as Record<string, string>)[locale];
    if (localized) return localized;
  }
  return rank.name;
}

/**
 * Lấy promotion rule cho rank mục tiêu.
 */
export function findPromotionRule(
  rules: PromotionRule[],
  toRank: number,
): PromotionRule | undefined {
  return rules.find(
    (rule) => rule.toRank === toRank && rule.mode === 'f1_rank' && rule.isActive,
  );
}

/**
 * Đếm tổng users trong subtree (recursive) dựa trên rules.
 *
 * Ví dụ: R10 với rule count=2 mỗi level, từ R10 -> minRank=7:
 * R10: 1, R9: 2, R8: 6, R7: 18 => total = 27
 */
export function countSubtreeUsers(
  rank: number,
  minRank: number,
  rules: PromotionRule[],
): number {
  if (rank <= minRank) return 1;

  const rule = findPromotionRule(rules, rank);
  if (!rule || !rule.requiredF1Rank || rule.count <= 0) return 1;

  const childCount = rule.count;
  const childRank = rule.requiredF1Rank;
  const childSubtree = countSubtreeUsers(childRank, minRank, rules);

  return 1 + childCount * childSubtree;
}

// ─── Overview Tree Generation ─────────────────────────────────────────────────

const MOCK_NAMES = [
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

let globalNameSeq = 0;

function nextMockName(): string {
  const name = MOCK_NAMES[globalNameSeq % MOCK_NAMES.length];
  globalNameSeq += 1;
  return name;
}

/**
 * Tạo overview tree ban đầu.
 *
 * Chỉ render:
 * - Root node (user)
 * - F1 trực tiếp của root (user nodes)
 * - Group nodes cho children của mỗi F1
 *
 * Tổng nodes khi mới mở: ~10–20 (root + F1s + group nodes)
 *
 * Ví dụ R10:
 *   R10 (user)
 *   ├── R9-A (user)
 *   │   └── [R8 × 3 — 18 users] (group)
 *   └── R9-B (user)
 *       └── [R8 × 3 — 18 users] (group)
 */
export function generateOverviewTree(
  ranks: Rank[],
  rules: PromotionRule[],
  rootRank = 10,
  minRank = 1,
  locale?: string,
): GraphData {
  globalNameSeq = 0;

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // --- Root user ---
  const rootRankData = findRank(ranks, rootRank);
  const rootRule = findPromotionRule(rules, rootRank);

  const rootId = `user-root-r${rootRank}`;
  const rootF1Count = rootRule?.count ?? 0;
  const rootTeamCount = countSubtreeUsers(rootRank, minRank, rules);

  const rootUser: TreeUser = {
    id: rootId,
    parentId: null,
    userName: nextMockName(),
    rank: rootRank,
    rankName: getRankName(rootRankData, locale) || `Rank ${rootRank}`,
    f1Count: rootF1Count,
    teamCount: rootTeamCount,
    isActive: rootRankData?.isActive ?? true,
    childrenLoaded: true,
    childrenIds: [],
  };

  const rootNodeData: RankTreeNodeData = { ...rootUser, type: 'user' };
  nodes.push({ id: rootId, data: rootNodeData, type: 'html' });

  // --- F1 của root ---
  if (rootRule && rootRule.requiredF1Rank != null && rootRule.count > 0) {
    const f1Rank = rootRule.requiredF1Rank;
    const f1Count = rootRule.count;
    const f1RankData = findRank(ranks, f1Rank);
    const f1Rule = findPromotionRule(rules, f1Rank);

    for (let i = 0; i < f1Count; i += 1) {
      const f1Id = `user-f1-r${f1Rank}-${i}`;
      const f1ChildCount = f1Rule?.count ?? 0;
      const f1TeamCount = countSubtreeUsers(f1Rank, minRank, rules);

      const f1User: TreeUser = {
        id: f1Id,
        parentId: rootId,
        userName: nextMockName(),
        rank: f1Rank,
        rankName: getRankName(f1RankData, locale) || `Rank ${f1Rank}`,
        f1Count: f1ChildCount,
        teamCount: f1TeamCount,
        isActive: f1RankData?.isActive ?? true,
        childrenLoaded: false,
        childrenIds: [],
      };

      rootUser.childrenIds.push(f1Id);

      const f1NodeData: RankTreeNodeData = { ...f1User, type: 'user' };
      nodes.push({ id: f1Id, data: f1NodeData, type: 'html' });
      edges.push({
        id: `edge-${rootId}-${f1Id}`,
        source: rootId,
        target: f1Id,
        type: 'polyline',
      });

      // --- Group node cho children của F1 ---
      if (f1Rule && f1Rule.requiredF1Rank != null && f1Rule.count > 0 && f1Rank > minRank) {
        const childRank = f1Rule.requiredF1Rank;
        const childCount = f1Rule.count;
        const childRankData = findRank(ranks, childRank);
        const childUserCount = childCount * countSubtreeUsers(childRank, minRank, rules);

        const groupId = `group-${f1Id}-r${childRank}`;

        const groupNode: GroupNode = {
          id: groupId,
          parentId: f1Id,
          type: 'group',
          rank: childRank,
          rankName: getRankName(childRankData, locale) || `Rank ${childRank}`,
          count: childCount,
          userCount: childUserCount,
        };

        nodes.push({ id: groupId, data: groupNode, type: 'html' });
        edges.push({
          id: `edge-${f1Id}-${groupId}`,
          source: f1Id,
          target: groupId,
          type: 'polyline',
        });
      }
    }
  }

  return { nodes, edges };
}

// ─── Mock Load Children ───────────────────────────────────────────────────────

/**
 * Mock implementation cho lazy-load children.
 *
 * Khi admin click expand vào một group node hoặc user node,
 * hàm này trả về danh sách children (user nodes).
 *
 * Trong production, thay bằng API call:
 * GET /admin/mlm/tree/:userId/children
 */
export function mockLoadChildren(
  parentId: string,
  parentRank: number,
  ranks: Rank[],
  rules: PromotionRule[],
  minRank: number,
  locale?: string,
): LoadChildrenResponse {
  const rule = findPromotionRule(rules, parentRank);

  if (!rule || !rule.requiredF1Rank || rule.count <= 0) {
    return {
      parentId,
      children: [],
      meta: { total: 0, hasMore: false },
    };
  }

  const childRank = rule.requiredF1Rank;
  const childCount = rule.count;
  const childRankData = findRank(ranks, childRank);
  const childRule = findPromotionRule(rules, childRank);

  const children: TreeUser[] = [];

  for (let i = 0; i < childCount; i += 1) {
    const childId = `user-${parentId}-r${childRank}-${i}-${Math.random().toString(36).slice(2, 8)}`;
    const teamCount = countSubtreeUsers(childRank, minRank, rules);

    children.push({
      id: childId,
      parentId,
      userName: nextMockName(),
      rank: childRank,
      rankName: getRankName(childRankData, locale) || `Rank ${childRank}`,
      f1Count: childRule?.count ?? 0,
      teamCount,
      isActive: childRankData?.isActive ?? true,
      childrenLoaded: false,
      childrenIds: [],
    });
  }

  return {
    parentId,
    children,
    meta: { total: childCount, hasMore: false },
  };
}

// ─── Graph Mutation Helpers ───────────────────────────────────────────────────

/**
 * Expand: thay một group node bằng user nodes thực + group nodes con.
 *
 * Trả về nodes/edges mới cần thêm vào graph,
 * và group node ID cần xóa.
 */
export function expandGroupNode(
  groupNode: GroupNode,
  children: TreeUser[],
  ranks: Rank[],
  rules: PromotionRule[],
  minRank: number,
  locale?: string,
): {
  removeNodeId: string;
  addNodes: GraphNode[];
  addEdges: GraphEdge[];
} {
  const addNodes: GraphNode[] = [];
  const addEdges: GraphEdge[] = [];

  for (const child of children) {
    const childNodeData: RankTreeNodeData = { ...child, type: 'user' };
    addNodes.push({ id: child.id, data: childNodeData, type: 'html' });
    addEdges.push({
      id: `edge-${groupNode.parentId}-${child.id}`,
      source: groupNode.parentId,
      target: child.id,
      type: 'polyline',
    });

    // Tạo group node cho children của child nếu còn levels
    const childRule = findPromotionRule(rules, child.rank);
    if (childRule && childRule.requiredF1Rank != null && childRule.count > 0 && child.rank > minRank) {
      const grandchildRank = childRule.requiredF1Rank;
      const grandchildCount = childRule.count;
      const grandchildRankData = findRank(ranks, grandchildRank);
      const grandchildUserCount = grandchildCount * countSubtreeUsers(grandchildRank, minRank, rules);

      const subGroupId = `group-${child.id}-r${grandchildRank}`;

      const subGroup: GroupNode = {
        id: subGroupId,
        parentId: child.id,
        type: 'group',
        rank: grandchildRank,
        rankName: getRankName(grandchildRankData, locale) || `Rank ${grandchildRank}`,
        count: grandchildCount,
        userCount: grandchildUserCount,
      };

      addNodes.push({ id: subGroupId, data: subGroup, type: 'html' });
      addEdges.push({
        id: `edge-${child.id}-${subGroupId}`,
        source: child.id,
        target: subGroupId,
        type: 'polyline',
      });
    }
  }

  return {
    removeNodeId: groupNode.id,
    addNodes,
    addEdges,
  };
}
