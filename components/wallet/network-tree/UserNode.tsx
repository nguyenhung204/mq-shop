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

function formatCurrency(amount: string | null | undefined): string {
  if (!amount || amount === "0") return "$0.00";
  const num = parseFloat(amount);
  if (isNaN(num)) return "$0.00";
  return `$${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
        className={`w-[240px] rounded-2xl border border-mq-border bg-mq-surface-elevated p-4 shadow-sm transition-shadow hover:shadow-md ${
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
              {d.labels.earnings}
            </p>
            <p className="text-base font-bold text-mq-gold tabular-nums leading-tight">
              {formatCurrency(d.totalEarnings)}
            </p>
          </div>
        </div>

        {/* Expand/Collapse button */}
        {d.hasChildren && (
          <button
            type="button"
            className="nodrag nopan mt-3 w-full flex items-center justify-center gap-1 py-1.5 rounded-lg border border-mq-border text-xs font-medium text-mq-text-muted hover:text-mq-text hover:border-mq-text-muted transition-colors cursor-pointer"
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              d.onToggleExpand?.(d.userId);
            }}
          >
            {d.isExpanded ? (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="18 15 12 9 6 15" />
                </svg>
                {d.labels.collapse}
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
                {d.labels.expand}
              </>
            )}
          </button>
        )}
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
