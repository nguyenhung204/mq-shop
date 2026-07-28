"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { notificationApi } from "@/lib/api/notifications";
import { openAuthenticatedSse } from "@/lib/api/sse";
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

function applyIncoming(
  incoming: ApiNotification,
  page: number,
  setItems: Dispatch<SetStateAction<ApiNotification[]>>,
  setUnreadCount: Dispatch<SetStateAction<number>>,
  setMeta: Dispatch<SetStateAction<PageMeta | null>>,
) {
  if (!incoming.readAt) setUnreadCount((c) => c + 1);

  // Only prepend onto page 1 so pagination stays consistent.
  if (page === 1) {
    setItems((prev) =>
      [incoming, ...prev.filter((x) => x.id !== incoming.id)].slice(0, NOTIF_PAGE_SIZE),
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
        // Keep ids already toasted via SSE so reconnect refresh does not re-toast.
        for (const n of result.items) seenIds.current.add(n.id);
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

  const handleRealtime = useCallback(
    (n: ApiNotification) => {
      if (!n?.id) return;
      if (seenIds.current.has(n.id)) return;
      seenIds.current.add(n.id);

      const incoming: ApiNotification = { ...n, readAt: n.readAt ?? null };
      applyIncoming(incoming, pageRef.current, setItems, setUnreadCount, setMeta);

      if (isCommissionNotify(incoming)) {
        void queryClient.invalidateQueries({ queryKey: walletKeys.all });
        void queryClient.invalidateQueries({ queryKey: mlmKeys.all });
      }
      if (isRankNotify(incoming)) {
        void refreshUser();
        void queryClient.invalidateQueries({ queryKey: mlmKeys.rankProgress() });
        void queryClient.invalidateQueries({ queryKey: mlmKeys.all });
      }

      toast.info(incoming.title || "Notification", {
        description: incoming.body || undefined,
        duration: 5000,
      });
    },
    [queryClient, refreshUser],
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

  // Authenticated SSE — live push without full page reload
  useEffect(() => {
    if (authLoading || !isAuthenticated) return;

    const ac = new AbortController();
    setStreamStatus("reconnecting");
    let wasLive = false;

    void openAuthenticatedSse(
      "/notifications/stream",
      {
        onOpen: () => {
          setStreamStatus("live");
          // SSE does not replay history — resync after reconnect.
          if (wasLive) void refresh();
          wasLive = true;
        },
        onMessage: (raw) => {
          try {
            const parsed = JSON.parse(raw) as ApiNotification | { data?: ApiNotification };
            const n =
              parsed && typeof parsed === "object" && "id" in parsed
                ? (parsed as ApiNotification)
                : (parsed as { data?: ApiNotification }).data;
            if (n) handleRealtime(n);
          } catch {
            /* ignore malformed payload */
          }
        },
        onError: () => {
          if (!ac.signal.aborted) setStreamStatus("reconnecting");
        },
      },
      ac.signal,
    ).catch(() => {
      if (!ac.signal.aborted) setStreamStatus("offline");
    });

    return () => {
      ac.abort();
      setStreamStatus("idle");
    };
  }, [isAuthenticated, authLoading, handleRealtime, refresh]);

  // Catch-up when tab becomes visible again (SSE may have dropped while hidden).
  useEffect(() => {
    if (!isAuthenticated) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [isAuthenticated, refresh]);

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
