"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { getApiHost } from "@/lib/api/client";
import { notificationApi } from "@/lib/api/notifications";
import type { ApiNotification } from "@/lib/api/types";
import { useAuth } from "./AuthProvider";

const MAX_ITEMS = 50;

type StreamStatus = "idle" | "live" | "reconnecting" | "offline";

type NotificationContextValue = {
  items: ApiNotification[];
  unreadCount: number;
  loading: boolean;
  streamStatus: StreamStatus;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  clear: () => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

function countUnread(list: ApiNotification[]) {
  return list.reduce((n, item) => n + (item.readAt ? 0 : 1), 0);
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [items, setItems] = useState<ApiNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [streamStatus, setStreamStatus] = useState<StreamStatus>("idle");
  const seenIds = useRef<Set<string>>(new Set());
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const result = await notificationApi.list({ page: 1, pageSize: MAX_ITEMS });
      setItems(result.items.slice(0, MAX_ITEMS));
      setUnreadCount(result.unreadCount);
      seenIds.current = new Set(result.items.map((n) => n.id));
    } catch {
      /* keep current inbox on transient failure */
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // REST history on login — admin/buyer do not depend on SSE for inbox
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setItems([]);
      setUnreadCount(0);
      seenIds.current.clear();
      setStreamStatus("idle");
      return;
    }
    void refresh();
  }, [authLoading, isAuthenticated, refresh]);

  // SSE — live events only while the tab is open
  useEffect(() => {
    if (authLoading || !isAuthenticated) return;

    const url = `${getApiHost()}/api/v1/notifications/stream`;
    let source: EventSource;
    try {
      source = new EventSource(url, { withCredentials: true } as EventSourceInit);
    } catch {
      setStreamStatus("offline");
      return;
    }

    setStreamStatus("reconnecting");
    source.onopen = () => setStreamStatus("live");

    source.onmessage = (ev) => {
      try {
        const n = JSON.parse(ev.data) as ApiNotification;
        if (!n?.id) return;
        if (seenIds.current.has(n.id)) return;
        seenIds.current.add(n.id);

        const incoming: ApiNotification = { ...n, readAt: n.readAt ?? null };
        setItems((prev) => [incoming, ...prev.filter((x) => x.id !== incoming.id)].slice(0, MAX_ITEMS));
        if (!incoming.readAt) setUnreadCount((c) => c + 1);

        toast.info(incoming.title || "Notification", {
          description: incoming.body || undefined,
          duration: 5000,
        });
      } catch {
        /* ignore malformed payload */
      }
    };

    source.onerror = () => {
      setStreamStatus(source.readyState === EventSource.CLOSED ? "offline" : "reconnecting");
    };

    return () => {
      source.close();
      setStreamStatus("idle");
    };
  }, [isAuthenticated, authLoading]);

  const markRead = useCallback(async (id: string) => {
    const target = itemsRef.current.find((n) => n.id === id);
    if (!target || target.readAt) return;

    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: now } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));

    try {
      await notificationApi.markRead(id);
    } catch {
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: target.readAt } : n)));
      setUnreadCount((c) => c + 1);
    }
  }, []);

  const markAllRead = useCallback(async () => {
    const snapshot = itemsRef.current;
    if (countUnread(snapshot) === 0) return;

    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? now })));
    setUnreadCount(0);

    try {
      await notificationApi.markAllRead();
    } catch {
      setItems(snapshot);
      setUnreadCount(countUnread(snapshot));
    }
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    setUnreadCount(0);
    seenIds.current.clear();
  }, []);

  const value = useMemo(
    () => ({
      items,
      unreadCount,
      loading,
      streamStatus,
      refresh,
      markRead,
      markAllRead,
      clear,
    }),
    [items, unreadCount, loading, streamStatus, refresh, markRead, markAllRead, clear],
  );

  return (
    <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}
