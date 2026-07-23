"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useNotifications } from "@/components/providers/NotificationProvider";

function statusLabel(status: string): string {
  if (status === "live") return "Live";
  if (status === "reconnecting") return "Reconnecting…";
  if (status === "offline") return "Offline";
  return "";
}

export function NotificationBell() {
  const { isAuthenticated } = useAuth();
  const {
    items,
    unreadCount,
    loading,
    page,
    meta,
    streamStatus,
    refresh,
    setPage,
    markRead,
    markAllRead,
  } = useNotifications();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const totalPages = meta?.totalPages ?? 0;

  useEffect(() => {
    if (!open) return;
    void refresh(1);
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, refresh]);

  if (!isAuthenticated) return null;

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className="mq-icon-btn relative text-mq-text hover:text-mq-gold transition-colors"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell size={18} strokeWidth={1.75} />
        {unreadCount > 0 && <span className="mq-count-badge">{unreadCount}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-[320px] max-w-[90vw] mq-card z-[80] overflow-hidden shadow-lg">
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-mq-border">
            <div>
              <span className="text-sm font-medium">Notifications</span>
              {streamStatus !== "idle" && (
                <p className="text-[10px] text-mq-text-muted mt-0.5">
                  {statusLabel(streamStatus)}
                  {streamStatus === "live" ? " · live updates" : ""}
                </p>
              )}
            </div>
            <button
              type="button"
              className="text-xs text-mq-text-muted hover:text-mq-text disabled:opacity-40"
              disabled={unreadCount === 0}
              onClick={() => void markAllRead()}
            >
              Mark all read
            </button>
          </div>
          <ul className="max-h-72 overflow-y-auto">
            {loading && items.length === 0 && (
              <li className="px-4 py-6 text-sm text-mq-text-muted text-center">Loading…</li>
            )}
            {!loading && items.length === 0 && (
              <li className="px-4 py-6 text-sm text-mq-text-muted text-center">
                No notifications yet.
              </li>
            )}
            {items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  className={`w-full text-left px-4 py-3 border-b border-mq-border hover:bg-mq-surface-subtle transition-colors ${
                    n.readAt ? "opacity-70" : ""
                  }`}
                  onClick={() => {
                    if (!n.readAt) void markRead(n.id);
                    setOpen(false);
                  }}
                >
                  <div className="flex items-start gap-2">
                    {!n.readAt && (
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-mq-gold shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-mq-text">{n.title}</p>
                      {n.body ? (
                        <p className="text-xs text-mq-text-muted mt-0.5 line-clamp-2">{n.body}</p>
                      ) : null}
                      {n.createdAt ? (
                        <p className="text-[10px] text-mq-text-muted mt-1">
                          {new Date(n.createdAt).toLocaleString()}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
          {totalPages > 1 ? (
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-mq-border bg-mq-surface-subtle">
              <button
                type="button"
                className="text-xs px-2 py-1 rounded-md text-mq-text-muted hover:text-mq-text disabled:opacity-40"
                disabled={page <= 1 || loading}
                onClick={() => setPage(page - 1)}
              >
                Prev
              </button>
              <span className="text-[11px] text-mq-text-muted tabular-nums">
                {page}/{totalPages}
                {typeof meta?.total === "number" ? ` · ${meta.total}` : ""}
              </span>
              <button
                type="button"
                className="text-xs px-2 py-1 rounded-md text-mq-text-muted hover:text-mq-text disabled:opacity-40"
                disabled={page >= totalPages || loading}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
