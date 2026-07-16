"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { io, type Socket } from "socket.io-client";
import { getAccessToken, getApiHost } from "@/lib/api/client";
import { notificationApi } from "@/lib/api";
import type { ApiNotification } from "@/lib/api/types";
import { useAuth } from "./AuthProvider";

type NotificationContextValue = {
  items: ApiNotification[];
  unreadCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

function asList(data: ApiNotification[] | { items?: ApiNotification[] }): ApiNotification[] {
  if (Array.isArray(data)) return data;
  return data.items ?? [];
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [items, setItems] = useState<ApiNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!getAccessToken()) {
      setItems([]);
      setUnreadCount(0);
      return;
    }
    setLoading(true);
    try {
      const [all, unread] = await Promise.all([
        notificationApi.list(false),
        notificationApi.list(true),
      ]);
      const list = asList(all);
      const unreadList = asList(unread);
      setItems(list);
      setUnreadCount(unreadList.length);
    } catch {
      /* API may be offline during local UI work */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setItems([]);
      setUnreadCount(0);
      return;
    }
    void refresh();
  }, [isAuthenticated, authLoading, refresh]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const token = getAccessToken();
    if (!token) return;

    let socket: Socket | null = null;
    try {
      socket = io(`${getApiHost()}/notifications`, {
        auth: { token },
        transports: ["websocket"],
        autoConnect: true,
      });

      socket.on("notification", (msg: { notification: ApiNotification; unreadCount: number }) => {
        setItems((prev) => [msg.notification, ...prev.filter((n) => n.id !== msg.notification.id)]);
        setUnreadCount(msg.unreadCount ?? 0);
      });
    } catch {
      /* socket optional when BE down */
    }

    return () => {
      socket?.disconnect();
    };
  }, [isAuthenticated]);

  const markRead = useCallback(async (id: string) => {
    await notificationApi.markRead(id);
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    await notificationApi.markAllRead();
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    setUnreadCount(0);
  }, []);

  const value = useMemo(
    () => ({ items, unreadCount, loading, refresh, markRead, markAllRead }),
    [items, unreadCount, loading, refresh, markRead, markAllRead],
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
