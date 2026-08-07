"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Controls,
  Background,
  BackgroundVariant,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { NetworkNode } from "@/lib/api/mlm";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { UserNode, type UserNodeData } from "./UserNode";
import { getLayoutedElements } from "./dagre-layout";

/* ─── Types ──────────────────────────────────────────────────────────── */

type RootUserInfo = {
  fullName?: string | null;
  email?: string | null;
  mlmRank?: number | null;
  avatarUrl?: string | null;
};

/* ─── Helpers ────────────────────────────────────────────────────────── */

function getRankLabel(rank: number | null, t: (k: string) => string): string {
  if (rank == null) return t("wallet.rankSeller");
  const key = `wallet.bonusGuide.ranks.${rank}`;
  const label = t(key);
  return label !== key ? label : `Partner Level ${rank}`;
}

/**
 * Build React Flow nodes + edges from flat API nodes.
 * Handles expand/collapse via the `expandedSet`.
 * Supports full-tree mode where nodes have negative depth (upline).
 * The actual tree root is the node whose referrerId is NOT in the nodes list.
 */
function buildFlowElements(
  apiNodes: NetworkNode[],
  rootUserId: string,
  rootUser: RootUserInfo | undefined,
  expandedSet: Set<string>,
  onToggleExpand: (nodeId: string) => void,
  t: (k: string) => string,
): { nodes: Node[]; edges: Edge[] } {
  // Build a lookup set
  const nodeIdSet = new Set(apiNodes.map((n) => n.userId));
  // Ensure rootUserId is included
  nodeIdSet.add(rootUserId);

  // Build a children map using referrerId
  const childrenMap = new Map<string, NetworkNode[]>();
  for (const node of apiNodes) {
    if (node.referrerId && nodeIdSet.has(node.referrerId)) {
      const siblings = childrenMap.get(node.referrerId) ?? [];
      siblings.push(node);
      childrenMap.set(node.referrerId, siblings);
    }
  }

  // Count direct referrals for each user
  const referralCountMap = new Map<string, number>();
  for (const node of apiNodes) {
    if (node.referrerId && nodeIdSet.has(node.referrerId)) {
      referralCountMap.set(node.referrerId, (referralCountMap.get(node.referrerId) ?? 0) + 1);
    }
  }

  // Find the actual tree root: the node whose referrerId is NOT in the set
  // This is typically the topmost ancestor in full-tree mode
  let treeRootId = rootUserId;
  const allNodes = [...apiNodes];
  // Add synthetic root user node if not in apiNodes
  if (!apiNodes.some((n) => n.userId === rootUserId)) {
    allNodes.push({
      userId: rootUserId,
      depth: 0,
      email: rootUser?.email ?? null,
      fullName: rootUser?.fullName ?? null,
      mlmRank: rootUser?.mlmRank ?? null,
      referrerId: null,
      avatarUrl: rootUser?.avatarUrl ?? null,
    });
  }

  // Find topmost ancestor (node with no parent in the set)
  for (const node of allNodes) {
    if (!node.referrerId || !nodeIdSet.has(node.referrerId)) {
      // This is a potential root (no parent in the set)
      if (node.depth < (allNodes.find((n) => n.userId === treeRootId)?.depth ?? 0)) {
        treeRootId = node.userId;
      } else if (node.depth <= 0 && node.userId !== rootUserId) {
        // Upline node with no parent — if deeper (more negative) than current root, use it
        const currentRoot = allNodes.find((n) => n.userId === treeRootId);
        if (!currentRoot || node.depth < (currentRoot.depth ?? 0)) {
          treeRootId = node.userId;
        }
      }
    }
  }
  // If we found upline nodes, the tree root is the topmost ancestor
  const uplineNodes = allNodes.filter((n) => n.depth < 0);
  if (uplineNodes.length > 0) {
    const topmost = uplineNodes.reduce((a, b) => (a.depth < b.depth ? a : b));
    treeRootId = topmost.userId;
  }

  const flowNodes: Node[] = [];
  const flowEdges: Edge[] = [];

  // Pre-compute i18n labels once
  const labels = {
    you: t("wallet.networkTreeYou"),
    referrals: t("wallet.networkTreeReferrals"),
    earnings: t("wallet.networkTreeEarnings"),
    expand: t("wallet.networkTreeExpand"),
    collapse: t("wallet.networkTreeCollapse"),
  };

  // Create tree root node
  const treeRootApiNode = allNodes.find((n) => n.userId === treeRootId);
  const treeRootData: UserNodeData = {
    userId: treeRootId,
    fullName: treeRootApiNode?.fullName ?? (treeRootId === rootUserId ? rootUser?.fullName ?? null : null),
    email: treeRootApiNode?.email ?? (treeRootId === rootUserId ? rootUser?.email ?? null : null),
    avatarUrl: treeRootApiNode?.avatarUrl ?? (treeRootId === rootUserId ? rootUser?.avatarUrl ?? null : null),
    mlmRank: treeRootApiNode?.mlmRank ?? (treeRootId === rootUserId ? rootUser?.mlmRank ?? null : null),
    rankLabel: getRankLabel(treeRootApiNode?.mlmRank ?? (treeRootId === rootUserId ? rootUser?.mlmRank ?? null : null), t),
    referralCount: referralCountMap.get(treeRootId) ?? 0,
    totalEarnings: treeRootApiNode?.totalEarnings ?? "0",
    depth: 0,
    isRoot: treeRootId === rootUserId,
    isExpanded: expandedSet.has(treeRootId),
    hasChildren: (childrenMap.get(treeRootId)?.length ?? 0) > 0,
    onToggleExpand,
    labels,
  };

  flowNodes.push({
    id: treeRootId,
    type: "user",
    position: { x: 0, y: 0 },
    data: treeRootData as unknown as Record<string, unknown>,
  });

  // BFS to add visible nodes (respecting expand/collapse)
  const queue: string[] = [treeRootId];
  const visited = new Set<string>([treeRootId]);

  while (queue.length > 0) {
    const parentId = queue.shift()!;
    const isExpanded = expandedSet.has(parentId);

    if (!isExpanded) continue;

    const children = childrenMap.get(parentId) ?? [];
    for (const child of children) {
      if (visited.has(child.userId)) continue;
      visited.add(child.userId);

      const childHasChildren = (childrenMap.get(child.userId)?.length ?? 0) > 0;
      const isFocusUser = child.userId === rootUserId;

      const nodeData: UserNodeData = {
        userId: child.userId,
        fullName: child.fullName ?? (isFocusUser ? rootUser?.fullName ?? null : null),
        email: child.email ?? (isFocusUser ? rootUser?.email ?? null : null),
        avatarUrl: child.avatarUrl ?? (isFocusUser ? rootUser?.avatarUrl ?? null : null),
        mlmRank: child.mlmRank ?? (isFocusUser ? rootUser?.mlmRank ?? null : null),
        rankLabel: getRankLabel(child.mlmRank ?? (isFocusUser ? rootUser?.mlmRank ?? null : null), t),
        referralCount: referralCountMap.get(child.userId) ?? 0,
        totalEarnings: child.totalEarnings ?? "0",
        depth: child.depth,
        isRoot: isFocusUser,
        isExpanded: expandedSet.has(child.userId),
        hasChildren: childHasChildren,
        onToggleExpand,
        labels,
      };

      flowNodes.push({
        id: child.userId,
        type: "user",
        position: { x: 0, y: 0 },
        data: nodeData as unknown as Record<string, unknown>,
      });

      flowEdges.push({
        id: `${parentId}-${child.userId}`,
        source: parentId,
        target: child.userId,
        type: "smoothstep",
        style: { stroke: "var(--mq-border)", strokeWidth: 2 },
        animated: false,
      });

      queue.push(child.userId);
    }
  }

  return getLayoutedElements(flowNodes, flowEdges, "TB");
}

/* ─── Node Types ─────────────────────────────────────────────────────── */

const nodeTypes = { user: UserNode };

/* ─── Main Component ─────────────────────────────────────────────────── */

function NetworkTreeFlowInner({
  apiNodes,
  rootUserId,
  rootUser,
  initialExpandAll,
  className,
}: {
  apiNodes: NetworkNode[];
  rootUserId: string;
  rootUser?: RootUserInfo;
  initialExpandAll?: boolean;
  className?: string;
}) {
  const { t } = useLanguage();

  // Expand/collapse state
  // In full-tree mode (initialExpandAll), expand all nodes by default
  const [expandedSet, setExpandedSet] = useState<Set<string>>(() => {
    if (initialExpandAll) {
      const all = new Set(apiNodes.map((n) => n.userId));
      all.add(rootUserId);
      return all;
    }
    return new Set([rootUserId]);
  });

  const onToggleExpand = useCallback((nodeId: string) => {
    setExpandedSet((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  // Build nodes + edges (recomputes on expand/collapse)
  const { nodes, edges } = useMemo(
    () => buildFlowElements(apiNodes, rootUserId, rootUser, expandedSet, onToggleExpand, t),
    [apiNodes, rootUserId, rootUser, expandedSet, onToggleExpand, t],
  );

  return (
    <div className={className ?? "w-full h-[600px] rounded-2xl border border-mq-border overflow-hidden bg-mq-surface-subtle"}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.2}
        maxZoom={1.5}
        defaultEdgeOptions={{
          type: "smoothstep",
          style: { stroke: "var(--mq-border)", strokeWidth: 2 },
        }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag
        zoomOnScroll
      >
        <Controls
          showInteractive={false}
          className="!rounded-xl !border-mq-border !shadow-sm"
        />
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--mq-border)" />
      </ReactFlow>
    </div>
  );
}

/* ─── Export with Provider ────────────────────────────────────────────── */

export function NetworkTreeFlow({
  nodes,
  rootUserId,
  rootUser,
  expandAll,
  className,
}: {
  nodes: NetworkNode[];
  rootUserId: string;
  totalDownline?: number;
  rootUser?: RootUserInfo;
  /** If true, expand all nodes initially (useful for admin full-tree view) */
  expandAll?: boolean;
  /** Custom class for the container div (default: h-[600px] with border) */
  className?: string;
}) {
  const { t } = useLanguage();

  if (nodes.length === 0) {
    return (
      <p className="text-sm text-mq-text-muted text-center py-6">
        {t("wallet.networkEmpty")}
      </p>
    );
  }

  return (
    <ReactFlowProvider>
      <NetworkTreeFlowInner
        apiNodes={nodes}
        rootUserId={rootUserId}
        rootUser={rootUser}
        initialExpandAll={expandAll}
        className={className}
      />
    </ReactFlowProvider>
  );
}
