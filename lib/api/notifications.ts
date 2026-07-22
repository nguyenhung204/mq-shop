import { api } from "./client";
import type { ApiNotification, PageMeta } from "./types";
import { asArray } from "./utils";

export type NotificationListResult = {
  items: ApiNotification[];
  unreadCount: number;
  meta?: PageMeta;
};

type ListPayload = {
  items?: ApiNotification[];
  notifications?: ApiNotification[];
  data?: ApiNotification[];
  unreadCount?: number;
  meta?: PageMeta & { unreadCount?: number };
};

function parseListPayload(raw: unknown): NotificationListResult {
  if (Array.isArray(raw)) {
    const items = raw as ApiNotification[];
    return {
      items,
      unreadCount: items.filter((n) => !n.readAt).length,
    };
  }

  const envelope = raw as { data?: unknown; meta?: PageMeta & { unreadCount?: number } };
  const payload = (envelope?.data ?? raw) as ListPayload | ApiNotification[];

  if (Array.isArray(payload)) {
    const items = payload;
    const unreadFromMeta = envelope?.meta?.unreadCount;
    return {
      items,
      unreadCount:
        typeof unreadFromMeta === "number"
          ? unreadFromMeta
          : items.filter((n) => !n.readAt).length,
      meta: envelope?.meta,
    };
  }

  const items = asArray<ApiNotification>(
    payload.items ?? payload.notifications ?? payload.data ?? [],
  );
  const unreadCount =
    typeof payload.unreadCount === "number"
      ? payload.unreadCount
      : typeof envelope?.meta?.unreadCount === "number"
        ? envelope.meta.unreadCount
        : items.filter((n) => !n.readAt).length;

  return {
    items,
    unreadCount,
    meta: payload.meta ?? envelope?.meta,
  };
}

export const notificationApi = {
  list: async (query?: { page?: number; pageSize?: number }) => {
    const raw = await api.get<unknown>("/notifications", {
      query: {
        page: query?.page,
        pageSize: query?.pageSize ?? 50,
      },
      withMeta: true,
    });
    return parseListPayload(raw);
  },

  markRead: (id: string) => api.post(`/notifications/${id}/read`, {}),

  markAllRead: () => api.post("/notifications/read-all", {}),
};
