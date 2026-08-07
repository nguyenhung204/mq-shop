// RankTree/UserDetailDrawer.tsx

'use client';

import { X } from 'lucide-react';
import type { UserSummary } from './types';
import { getRankColor, getInitials } from './utils';

export interface DrawerLabels {
  title: string;
  status: string;
  active: string;
  inactive: string;
  f1Direct: string;
  totalTeam: string;
  f1List: string;
}

const DEFAULT_DRAWER_LABELS: DrawerLabels = {
  title: 'User Detail',
  status: 'Status',
  active: 'Active',
  inactive: 'Inactive',
  f1Direct: 'Direct F1',
  totalTeam: 'Total team',
  f1List: 'F1',
};

interface UserDetailDrawerProps {
  user: UserSummary | null;
  open: boolean;
  onClose: () => void;
  labels?: DrawerLabels;
}

export function UserDetailDrawer({ user, open, onClose, labels }: UserDetailDrawerProps) {
  if (!open || !user) return null;

  const l = labels ?? DEFAULT_DRAWER_LABELS;
  const rankColor = getRankColor(user.rank);
  const initials = getInitials(user.userName);

  return (
    <>
      {/* Backdrop */}
      <button
        type="button"
        className="rt-drawer__backdrop"
        onClick={onClose}
        aria-label="Close drawer"
      />

      {/* Drawer */}
      <aside className="rt-drawer">
        {/* Header */}
        <div className="rt-drawer__header">
          <h3 className="rt-drawer__title">{l.title}</h3>
          <button
            type="button"
            className="rt-drawer__close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Profile */}
        <div className="rt-drawer__profile">
          <div
            className="rt-drawer__avatar"
            style={{
              background: rankColor.background,
              color: rankColor.color,
              borderColor: rankColor.border,
            }}
          >
            {initials}
          </div>
          <div className="rt-drawer__user-info">
            <p className="rt-drawer__username">{user.userName}</p>
            {user.email && (
              <p className="rt-drawer__email">{user.email}</p>
            )}
            <div className="rt-drawer__rank-badge" style={{
              background: rankColor.background,
              color: rankColor.color,
              borderColor: rankColor.border,
            }}>
              R{user.rank} — {user.rankName}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="rt-drawer__stats">
          <div className="rt-drawer__stat">
            <span className="rt-drawer__stat-label">{l.status}</span>
            <span className={`rt-drawer__stat-value ${user.isActive ? 'rt-drawer__stat-value--active' : 'rt-drawer__stat-value--inactive'}`}>
              {user.isActive ? l.active : l.inactive}
            </span>
          </div>
          <div className="rt-drawer__stat">
            <span className="rt-drawer__stat-label">{l.f1Direct}</span>
            <span className="rt-drawer__stat-value">{user.f1Count}</span>
          </div>
          <div className="rt-drawer__stat">
            <span className="rt-drawer__stat-label">{l.totalTeam}</span>
            <span className="rt-drawer__stat-value">{user.teamCount}</span>
          </div>
        </div>

        {/* Children list */}
        {user.children.length > 0 && (
          <div className="rt-drawer__children">
            <h4 className="rt-drawer__section-title">
              {l.f1List} ({user.children.length})
            </h4>
            <ul className="rt-drawer__children-list">
              {user.children.map((child) => {
                const childColor = getRankColor(child.rank);
                return (
                  <li key={child.id} className="rt-drawer__child-item">
                    <div
                      className="rt-drawer__child-rank"
                      style={{
                        background: childColor.background,
                        color: childColor.color,
                        borderColor: childColor.border,
                      }}
                    >
                      R{child.rank}
                    </div>
                    <div className="rt-drawer__child-info">
                      <span className="rt-drawer__child-name">{child.userName}</span>
                      <span className="rt-drawer__child-rank-name">{child.rankName}</span>
                    </div>
                    <span className={`rt-drawer__child-status ${child.isActive ? 'rt-drawer__child-status--active' : ''}`}>
                      {child.isActive ? '●' : '○'}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </aside>
    </>
  );
}
