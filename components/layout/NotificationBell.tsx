"use client";

import Link from "next/link";
import { useState } from "react";
import { Bell } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useNotifications } from "@/components/providers/NotificationProvider";

export function NotificationBell() {
  const { isAuthenticated } = useAuth();
  const { items, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);

  if (!isAuthenticated) return null;

  return (
    <div className="relative">
      <button
        type="button"
        className="mq-icon-btn relative text-mq-text hover:bg-mq-surface-subtle"
        aria-label="Notifications"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell size={18} strokeWidth={1.75} />
        {unreadCount > 0 && <span className="mq-count-badge">{unreadCount}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-[320px] max-w-[90vw] mq-card z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-mq-border">
            <span className="text-sm font-medium">Notifications</span>
            <button
              type="button"
              className="text-xs text-mq-text-muted hover:text-mq-text"
              onClick={() => void markAllRead()}
            >
              Mark all read
            </button>
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {items.length === 0 && (
              <li className="px-4 py-6 text-sm text-mq-text-muted text-center">No notifications</li>
            )}
            {items.slice(0, 12).map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  className={`w-full text-left px-4 py-3 border-b border-mq-border hover:bg-mq-surface-subtle transition-colors ${
                    n.readAt ? "opacity-70" : ""
                  }`}
                  onClick={() => {
                    void markRead(n.id);
                    setOpen(false);
                  }}
                >
                  <p className="text-sm font-medium text-mq-text">{n.title}</p>
                  <p className="text-xs text-mq-text-muted mt-0.5 line-clamp-2">{n.body}</p>
                </button>
              </li>
            ))}
          </ul>
          <div className="px-4 py-2 border-t border-mq-border text-center">
            <Link href="/account" className="text-xs text-mq-text-muted hover:text-mq-text" onClick={() => setOpen(false)}>
              Account
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
