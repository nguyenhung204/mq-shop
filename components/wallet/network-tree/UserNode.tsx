"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

export type UserNodeData = {
  userId: string;
  fullName: string | null;
  email: string | null;
  avatarUrl?: string | null;
  mlmRank: number | null;
  rankLabel: string;
  referralCount: number;
  totalEarnings: string;
  depth: number;
  isRoot?: boolean;
  isExpanded?: boolean;
  hasChildren?: boolean;
  onToggleExpand?: (nodeId: string) => void;
  /** i18n labels */
  labels: {
    you: string;
    referrals: string;
    earnings: string;
    level: string;
    expand: string;
    collapse: string;
  };
};

function getInitials(name: string | null, email: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return "??";
}

/** Color mapping for MLM rank levels */
function rankColor(rank: number | null): { bg: string; text: string; badge: string } {
  switch (rank) {
    case 0:
      return { bg: "bg-slate-100", text: "text-slate-600", badge: "Seller" };
    case 1:
      return { bg: "bg-emerald-100", text: "text-emerald-700", badge: "Level 1" };
    case 2:
      return { bg: "bg-blue-100", text: "text-blue-700", badge: "Level 2" };
    case 3:
      return { bg: "bg-purple-100", text: "text-purple-700", badge: "Level 3" };
    case 4:
      return { bg: "bg-amber-100", text: "text-amber-700", badge: "Level 4" };
    case 5:
      return { bg: "bg-rose-100", text: "text-rose-700", badge: "Level 5" };
    default:
      return { bg: "bg-gray-100", text: "text-gray-500", badge: "—" };
  }
}

function statusDot(depth: number): string {
  if (depth <= 1) return "bg-green-500";
  if (depth <= 3) return "bg-amber-400";
  return "bg-red-400";
}

function UserNodeComponent({ data }: NodeProps) {
  const d = data as unknown as UserNodeData;
  const displayName = d.fullName || d.email?.split("@")[0] || d.userId.slice(0, 8);
  const initials = getInitials(d.fullName, d.email);

  return (
    <div className="relative">
      {/* Target handle (incoming edge from parent) */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-0 !h-0 !border-0 !bg-transparent"
      />

      {/* YOU badge */}
      {d.isRoot && (
        <div className="absolute -top-7 left-1/2 -translate-x-1/2 z-10">
          <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full bg-mq-gold text-black text-[11px] font-bold shadow-sm">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            {d.labels.you}
          </span>
        </div>
      )}

      {/* Card */}
      <div
        className={`nodrag nopan w-[240px] rounded-2xl border border-mq-border bg-mq-surface-elevated p-4 shadow-sm transition-shadow hover:shadow-md ${
          d.isRoot ? "ring-2 ring-mq-gold/40" : ""
        }`}
      >
        {/* Avatar + Info */}
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            {d.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={d.avatarUrl}
                alt=""
                className="w-11 h-11 rounded-full object-cover border border-mq-border"
              />
            ) : (
              <div className="w-11 h-11 rounded-full bg-mq-surface-subtle border border-mq-border flex items-center justify-center text-mq-text-secondary text-sm font-bold">
                {initials}
              </div>
            )}
            <span
              className={`absolute -bottom-0.5 -left-0.5 w-3 h-3 rounded-full border-2 border-mq-surface-elevated ${statusDot(d.depth)}`}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm text-mq-text truncate leading-tight">{displayName}</p>
            <p className="text-xs text-mq-text-muted truncate">{d.rankLabel}</p>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-mq-border my-3" />

        {/* Stats */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-mq-text-muted font-medium">
              {d.labels.referrals}
            </p>
            <p className="text-base font-bold text-mq-text tabular-nums leading-tight">
              {d.referralCount}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-mq-text-muted font-medium">
              {d.labels.level}
            </p>
            <span
              className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-xs font-bold ${rankColor(d.mlmRank).bg} ${rankColor(d.mlmRank).text}`}
            >
              {d.mlmRank != null ? d.mlmRank : "—"}
            </span>
          </div>
        </div>

        {/* Expand/Collapse button — removed, always show all nodes */}
      </div>

      {/* Source handle (outgoing edge to children) */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-0 !h-0 !border-0 !bg-transparent"
      />
    </div>
  );
}

export const UserNode = memo(UserNodeComponent);
