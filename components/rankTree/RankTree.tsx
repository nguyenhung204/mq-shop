// RankTree/RankTree.tsx

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Graph } from '@antv/g6';

import type { RankTreeProps, RankTreeLabels, GroupNode, RankTreeNodeData } from './types';
import {
  generateOverviewTree,
  getInitials,
  getRankColor,
  mockLoadChildren,
  expandGroupNode,
} from './utils';

import './rankTree.css';

// ─── Constants ────────────────────────────────────────────────────────────────

const USER_NODE_WIDTH = 260;
const USER_NODE_HEIGHT = 150;
const GROUP_NODE_WIDTH = 220;
const GROUP_NODE_HEIGHT = 110;

const DEFAULT_LABELS: RankTreeLabels = {
  expand: '+ Expand',
  users: 'users',
  loading: 'Loading...',
  f1Label: 'F1',
  teamLabel: 'TEAM',
};

/** Current labels — set by component before render. */
let activeLabels: RankTreeLabels = DEFAULT_LABELS;

// ─── HTML Renderers ───────────────────────────────────────────────────────────

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * HTML cho user node.
 */
function createUserNodeHTML(data: RankTreeNodeData & { type: 'user' }): string {
  const rankColor = getRankColor(data.rank);
  const initials = getInitials(data.userName);
  const badgeIcon = data.rank >= 7 ? '♛' : '◆';
  const userName = escapeHtml(data.userName);
  const rankName = escapeHtml(data.rankName);

  return `
    <div class="rt-node rt-node--user" data-node-id="${data.id}">
      <div class="rt-node__badge" style="background:${rankColor.background};color:${rankColor.color};border-color:${rankColor.border};">
        <span class="rt-node__badge-icon">${badgeIcon}</span>
        <span>${rankName} (R${data.rank})</span>
      </div>

      <div class="rt-node__profile">
        <div class="rt-node__avatar-wrap">
          <div class="rt-node__avatar">${initials}</div>
          <span class="rt-node__status ${data.isActive ? 'rt-node__status--active' : 'rt-node__status--inactive'}"></span>
        </div>
        <div class="rt-node__info">
          <p class="rt-node__username" title="${userName}">${userName}</p>
          <div class="rt-node__rank-label">${rankName}</div>
        </div>
      </div>

      <div class="rt-node__divider"></div>

      <div class="rt-node__footer">
        <div>
          <div class="rt-node__metric-label">${activeLabels.f1Label}</div>
          <div class="rt-node__metric-value">${data.f1Count}</div>
        </div>
        <div>
          <div class="rt-node__metric-label">${activeLabels.teamLabel}</div>
          <div class="rt-node__metric-value">${data.teamCount}</div>
        </div>
        <div class="rt-node__rank-circle" style="background:${rankColor.background};color:${rankColor.color};border-color:${rankColor.border};">
          ${data.rank}
        </div>
      </div>
    </div>
  `;
}

/**
 * HTML cho group/aggregate node.
 */
function createGroupNodeHTML(data: GroupNode): string {
  const rankColor = getRankColor(data.rank);
  const rankName = escapeHtml(data.rankName);

  return `
    <div class="rt-node rt-node--group" data-node-id="${data.id}">
      <div class="rt-node__badge rt-node__badge--group" style="background:${rankColor.background};color:${rankColor.color};border-color:${rankColor.border};">
        <span>${rankName}</span>
      </div>

      <div class="rt-group__body">
        <div class="rt-group__icon" style="background:${rankColor.background};color:${rankColor.color};border-color:${rankColor.border};">
          R${data.rank}
        </div>
        <div class="rt-group__info">
          <p class="rt-group__title">${rankName} × ${data.count}</p>
          <p class="rt-group__sub">${data.userCount} ${activeLabels.users}</p>
        </div>
      </div>

      <button class="rt-group__expand-btn" data-expand-group="${data.id}" type="button">
        ${activeLabels.expand}
      </button>
    </div>
  `;
}

/**
 * Router: quyết định render user hay group node.
 */
function createNodeHTML(nodeData: RankTreeNodeData): string {
  if (nodeData.type === 'group') {
    return createGroupNodeHTML(nodeData);
  }
  return createUserNodeHTML(nodeData);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RankTree({
  ranks,
  rules,
  rootRank = 10,
  minRank = 1,
  height = 700,
  labels,
  locale,
  onLoadChildren,
  onUserClick,
}: RankTreeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<Graph | null>(null);
  const destroyedRef = useRef(false);
  const [expanding, setExpanding] = useState<string | null>(null);

  // Set active labels for HTML renderers
  activeLabels = labels ?? DEFAULT_LABELS;

  /**
   * Handle expand group node.
   *
   * Strategy: build new full data (nodes + edges), then set it all at once
   * via graph.setData() + graph.render(). This avoids issues with G6 v5
   * auto-removing edges when nodes are removed, and ordering problems
   * with addNodeData/removeNodeData.
   */
  const handleExpandGroup = useCallback(
    async (groupNodeId: string) => {
      const graph = graphRef.current;
      if (!graph || expanding) return;

      // Find the group node data from current graph data
      let nodeModel;
      try {
        nodeModel = graph.getNodeData(groupNodeId);
      } catch {
        // Node already removed or graph destroyed
        return;
      }
      if (!nodeModel) return;

      const groupData = nodeModel.data as unknown as GroupNode;
      if (!groupData || groupData.type !== 'group') return;

      setExpanding(groupNodeId);

      try {
        let children;

        if (onLoadChildren) {
          const response = await onLoadChildren(groupData.parentId);
          children = response.children;
        } else {
          const response = mockLoadChildren(
            groupData.parentId,
            groupData.rank + 1,
            ranks,
            rules,
            minRank,
            locale,
          );
          children = response.children;
        }

        // Guard: graph may have been destroyed during await
        if (graphRef.current !== graph) return;

        // Calculate expansion
        const { removeNodeId, addNodes, addEdges } = expandGroupNode(
          groupData,
          children,
          ranks,
          rules,
          minRank,
          locale,
        );

        // Get current graph data
        const currentNodes = graph.getNodeData();
        const currentEdges = graph.getEdgeData();

        // Build new data set:
        // 1. Remove the group node
        const newNodes = currentNodes.filter((n) => n.id !== removeNodeId);
        // 2. Remove edges connected to the group node
        const newEdges = currentEdges.filter(
          (e) => e.source !== removeNodeId && e.target !== removeNodeId,
        );

        // 3. Add new user nodes
        for (const n of addNodes) {
          newNodes.push({ id: n.id, data: n.data, type: 'html' });
        }

        // 4. Add new edges
        for (const e of addEdges) {
          newEdges.push({ id: e.id, source: e.source, target: e.target, type: 'polyline' });
        }

        // Set data and re-render
        graph.setData({ nodes: newNodes, edges: newEdges });
        await graph.render();

        // Guard again after render
        if (graphRef.current === graph) {
          graph.fitView();
        }
      } catch (err) {
        console.error('[RankTree] Expand failed:', err);
      } finally {
        setExpanding(null);
      }
    },
    [expanding, onLoadChildren, ranks, rules, minRank, locale],
  );

  /**
   * Click handler delegation.
   */
  const handleContainerClick = useCallback(
    (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Check expand button click
      const expandBtn = target.closest('[data-expand-group]') as HTMLElement | null;
      if (expandBtn) {
        const groupId = expandBtn.getAttribute('data-expand-group');
        if (groupId) {
          handleExpandGroup(groupId);
          return;
        }
      }

      // Check user node click
      const userNode = target.closest('.rt-node--user') as HTMLElement | null;
      if (userNode && onUserClick) {
        const nodeId = userNode.getAttribute('data-node-id');
        if (nodeId) {
          onUserClick(nodeId);
        }
      }
    },
    [handleExpandGroup, onUserClick],
  );

  /**
   * Initialize G6 graph.
   */
  useEffect(() => {
    if (!containerRef.current) return;

    // Destroy previous graph
    if (graphRef.current) {
      graphRef.current.destroy();
      graphRef.current = null;
    }

    destroyedRef.current = false;

    // Generate overview data (chỉ ~10 nodes)
    const { nodes, edges } = generateOverviewTree(ranks, rules, rootRank, minRank, locale);

    const graph = new Graph({
      container: containerRef.current,
      autoResize: true,
      animation: false,

      data: {
        nodes: nodes.map((n) => ({
          id: n.id,
          data: n.data,
          type: 'html',
        })),
        edges,
      },

      node: {
        type: 'html',
        style: {
          size: (datum) => {
            const d = datum.data as unknown as RankTreeNodeData;
            if (d.type === 'group') {
              return [GROUP_NODE_WIDTH, GROUP_NODE_HEIGHT];
            }
            return [USER_NODE_WIDTH, USER_NODE_HEIGHT];
          },
          dx: (datum) => {
            const d = datum.data as unknown as RankTreeNodeData;
            if (d.type === 'group') return -GROUP_NODE_WIDTH / 2;
            return -USER_NODE_WIDTH / 2;
          },
          dy: (datum) => {
            const d = datum.data as unknown as RankTreeNodeData;
            if (d.type === 'group') return -GROUP_NODE_HEIGHT / 2;
            return -USER_NODE_HEIGHT / 2;
          },
          innerHTML: (datum) => {
            const d = datum.data as unknown as RankTreeNodeData;
            return createNodeHTML(d);
          },
        },
      },

      edge: {
        type: 'polyline',
        style: {
          stroke: '#cbd5e1',
          lineWidth: 1.5,
          radius: 0,
        },
      },

      layout: {
        type: 'compact-box',
        direction: 'TB',
        getWidth: (datum: Record<string, unknown>) => {
          const d = datum.data as unknown as RankTreeNodeData;
          if (d?.type === 'group') return GROUP_NODE_WIDTH;
          return USER_NODE_WIDTH;
        },
        getHeight: (datum: Record<string, unknown>) => {
          const d = datum.data as unknown as RankTreeNodeData;
          if (d?.type === 'group') return GROUP_NODE_HEIGHT;
          return USER_NODE_HEIGHT;
        },
        getHGap: () => 40,
        getVGap: () => 60,
      },

      behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element'],
    });

    graphRef.current = graph;

    // Render async — guard against unmount
    graph.render().then(() => {
      if (!destroyedRef.current && graphRef.current === graph) {
        graph.fitView();
      }
    }).catch(() => {
      // Graph destroyed during render — safe to ignore
    });

    return () => {
      destroyedRef.current = true;
      if (graphRef.current === graph) {
        graph.destroy();
        graphRef.current = null;
      }
    };
  }, [ranks, rules, rootRank, minRank, locale]);

  /**
   * Attach click delegation to container.
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('click', handleContainerClick);
    return () => {
      container.removeEventListener('click', handleContainerClick);
    };
  }, [handleContainerClick]);

  // ─── Toolbar ──────────────────────────────────────────────────────────────

  const handleZoomIn = () => graphRef.current?.zoomBy(1.2);
  const handleZoomOut = () => graphRef.current?.zoomBy(0.8);
  const handleFitView = () => graphRef.current?.fitView();

  return (
    <div className="rank-tree" style={{ height }}>
      {/* Toolbar */}
      <div className="rank-tree__toolbar">
        <button
          type="button"
          className="rank-tree__toolbar-button"
          onClick={handleZoomOut}
          title="Thu nhỏ"
        >
          −
        </button>
        <button
          type="button"
          className="rank-tree__toolbar-button"
          onClick={handleFitView}
          title="Fit view"
        >
          ⛶
        </button>
        <button
          type="button"
          className="rank-tree__toolbar-button"
          onClick={handleZoomIn}
          title="Phóng to"
        >
          +
        </button>
      </div>

      {/* Loading indicator */}
      {expanding && (
        <div className="rank-tree__loading">
          {labels?.loading ?? 'Loading...'}
        </div>
      )}

      {/* G6 Canvas */}
      <div ref={containerRef} className="rank-tree__canvas" />
    </div>
  );
}
