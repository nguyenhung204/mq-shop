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
import type { ApiNotification } from "@/lib/api/types";
import { useAuth } from "./AuthProvider";

const MAX_ITEMS = 50;
const STORAGE_KEY = "mq_sse_notifications";

type StreamStatus = "idle" | "live" | "reconnecting" | "offline";

type NotificationContextValue = {
  items: ApiNotification[];
  unreadCount: number;
  streamStatus: StreamStatus;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clear: () => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

function storageKey(userId: string) {
  return `${STORAGE_KEY}:${userId}`;
}

function loadCached(userId: string): ApiNotification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ApiNotification[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_ITEMS) : [];
  } catch {
    return [];
  }
}

function saveCached(userId: string, items: ApiNotification[]) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(storageKey(userId), JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    /* quota / private mode */
  }
}

function clearCached(userId?: string | null) {
  if (typeof window === "undefined") return;
  if (userId) {
    sessionStorage.removeItem(storageKey(userId));
    return;
  }
  Object.keys(sessionStorage)
    .filter((k) => k.startsWith(`${STORAGE_KEY}:`))
    .forEach((k) => sessionStorage.removeItem(k));
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const userId = user?.id || null;
  const [items, setItems] = useState<ApiNotification[]>([]);
  const [streamStatus, setStreamStatus] = useState<StreamStatus>("idle");
  const seenIds = useRef<Set<string>>(new Set());

  // Restore session cache after login; clear on logout
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !userId) {
      setItems([]);
      seenIds.current.clear();
      setStreamStatus("idle");
      clearCached();
      return;
    }
    const cached = loadCached(userId);
    setItems(cached);
    seenIds.current = new Set(cached.map((n) => n.id));
  }, [isAuthenticated, authLoading, userId]);

  // Persist in-memory list for this tab session (survives F5)
  useEffect(() => {
    if (!userId || !isAuthenticated) return;
    saveCached(userId, items);
  }, [items, userId, isAuthenticated]);

  // SSE after login — cookie JWT via withCredentials
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

        // Stream always sends readAt: null — treat as unread until local mark
        const incoming: ApiNotification = { ...n, readAt: null };

        setItems((prev) => [incoming, ...prev.filter((x) => x.id !== incoming.id)].slice(0, MAX_ITEMS));
        toast.info(incoming.title || "Notification", {
          description: incoming.body || undefined,
          duration: 5000,
        });
      } catch {
        /* ignore malformed payload */
      }
    };

    source.onerror = () => {
      // Browser EventSource auto-reconnects; surface soft status
      setStreamStatus(source.readyState === EventSource.CLOSED ? "offline" : "reconnecting");
    };

    return () => {
      source.close();
      setStreamStatus("idle");
    };
  }, [isAuthenticated, authLoading]);

  const markRead = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((n) =>
        n.id === id && !n.readAt ? { ...n, readAt: new Date().toISOString() } : n,
      ),
    );
  }, []);

  const markAllRead = useCallback(() => {
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? now })));
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    seenIds.current.clear();
    if (userId) clearCached(userId);
  }, [userId]);

  const unreadCount = useMemo(
    () => items.reduce((n, item) => n + (item.readAt ? 0 : 1), 0),
    [items],
  );

  const value = useMemo(
    () => ({ items, unreadCount, streamStatus, markRead, markAllRead, clear }),
    [items, unreadCount, streamStatus, markRead, markAllRead, clear],
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
