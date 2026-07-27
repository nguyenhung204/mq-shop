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
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getApiHost } from "@/lib/api/client";
import { notificationApi } from "@/lib/api/notifications";
import type { ApiNotification, PageMeta } from "@/lib/api/types";
import { mlmKeys, walletKeys } from "@/lib/queries/wallet";
import { useAuth } from "./AuthProvider";

/** Page size for the header dropdown. */
export const NOTIF_PAGE_SIZE = 8;

type StreamStatus = "idle" | "live" | "reconnecting" | "offline";

type NotificationContextValue = {
  items: ApiNotification[];
  unreadCount: number;
  loading: boolean;
  page: number;
  meta: PageMeta | null;
  streamStatus: StreamStatus;
  refresh: (page?: number) => Promise<void>;
  setPage: (page: number) => void;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  clear: () => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

/** Match BE titles from commission / MLM rank notifies (010). */
function isCommissionNotify(n: ApiNotification): boolean {
  const title = (n.title || "").toLowerCase();
  const type = (n.type || "").toLowerCase();
  if (type.includes("commission") || type.includes("mlm")) return true;
  return (
    title.includes("commission credited") ||
    title.includes("bonus credited") ||
    title.includes("referral bonus") ||
    title.includes("loyalty bonus") ||
    title.includes("global bonus") ||
    title.includes("team commission") ||
    title.includes("commission not credited")
  );
}

function isRankNotify(n: ApiNotification): boolean {
  const title = (n.title || "").toLowerCase();
  return (
    title.includes("mlm rank") ||
    title.includes("rank updated") ||
    title.includes("rank upgraded")
  );
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading: authLoading, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const [items, setItems] = useState<ApiNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPageState] = useState(1);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [streamStatus, setStreamStatus] = useState<StreamStatus>("idle");
  const seenIds = useRef<Set<string>>(new Set());
  const itemsRef = useRef(items);
  const pageRef = useRef(page);
  itemsRef.current = items;
  pageRef.current = page;

  const refresh = useCallback(
    async (nextPage?: number) => {
      if (!isAuthenticated) return;
      const target = nextPage ?? pageRef.current;
      setLoading(true);
      try {
        const result = await notificationApi.list({
          page: target,
          pageSize: NOTIF_PAGE_SIZE,
        });
        setItems(result.items);
        setUnreadCount(result.unreadCount);
        setMeta(result.meta ?? null);
        setPageState(result.meta?.page ?? target);
        seenIds.current = new Set(result.items.map((n) => n.id));
      } catch {
        /* keep current inbox on transient failure */
      } finally {
        setLoading(false);
      }
    },
    [isAuthenticated],
  );

  const setPage = useCallback(
    (next: number) => {
      setPageState(next);
      void refresh(next);
    },
    [refresh],
  );

  // REST history on login
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setItems([]);
      setUnreadCount(0);
      setMeta(null);
      setPageState(1);
      seenIds.current.clear();
      setStreamStatus("idle");
      return;
    }
    void refresh(1);
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
        if (!incoming.readAt) setUnreadCount((c) => c + 1);

        // Only prepend onto page 1 so pagination stays consistent.
        if (pageRef.current === 1) {
          setItems((prev) =>
            [incoming, ...prev.filter((x) => x.id !== incoming.id)].slice(
              0,
              NOTIF_PAGE_SIZE,
            ),
          );
          setMeta((prev) =>
            prev
              ? {
                  ...prev,
                  total: prev.total + 1,
                  totalPages: Math.max(
                    1,
                    Math.ceil((prev.total + 1) / (prev.pageSize || NOTIF_PAGE_SIZE)),
                  ),
                }
              : prev,
          );
        }

        if (isCommissionNotify(incoming)) {
          void queryClient.invalidateQueries({ queryKey: walletKeys.all });
          void queryClient.invalidateQueries({ queryKey: mlmKeys.all });
        }
        // Rank updates are event-driven (no hourly FE poll).
        // Toast "MLM rank upgraded/updated" → profile + rank-progress.
        if (isRankNotify(incoming)) {
          void refreshUser();
          void queryClient.invalidateQueries({ queryKey: mlmKeys.rankProgress() });
          void queryClient.invalidateQueries({ queryKey: mlmKeys.all });
        }

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
  }, [isAuthenticated, authLoading, queryClient, refreshUser]);

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
    if (unreadCount === 0) return;
    const snapshot = itemsRef.current;
    const prevUnread = unreadCount;

    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? now })));
    setUnreadCount(0);

    try {
      await notificationApi.markAllRead();
    } catch {
      setItems(snapshot);
      setUnreadCount(prevUnread);
    }
  }, [unreadCount]);

  const clear = useCallback(() => {
    setItems([]);
    setUnreadCount(0);
    setMeta(null);
    setPageState(1);
    seenIds.current.clear();
  }, []);

  const value = useMemo(
    () => ({
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
      clear,
    }),
    [
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
      clear,
    ],
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
