import { api } from "./client";
import type { ApiNotification, PageMeta } from "./types";
import { asArray } from "./utils";

export type NotificationListResult = {
  items: ApiNotification[];
  unreadCount: number;
  meta?: PageMeta;
};

/**
 * Contract (in envelope `data`):
 * {
 *   items: NotificationView[],
 *   meta: { page, pageSize, total, totalPages },
 *   unreadCount: number  // global unread, not page-scoped
 * }
 */
function parseListPayload(raw: unknown): NotificationListResult {
  // withMeta → { data, meta }; data may be the contract object or a bare array
  const root = raw as {
    data?: unknown;
    meta?: PageMeta & { unreadCount?: number };
    items?: ApiNotification[];
    unreadCount?: number;
  };

  const candidate =
    root?.data && typeof root.data === "object" && !Array.isArray(root.data)
      ? (root.data as {
          items?: ApiNotification[];
          meta?: PageMeta;
          unreadCount?: number;
        })
      : root;

  if (Array.isArray(root?.data)) {
    const items = root.data as ApiNotification[];
    return {
      items,
      unreadCount:
        typeof root.meta?.unreadCount === "number"
          ? root.meta.unreadCount
          : items.filter((n) => !n.readAt).length,
      meta: root.meta,
    };
  }

  const items = asArray<ApiNotification>(candidate?.items ?? []);
  const meta = candidate?.meta ?? root?.meta;
  const unreadCount =
    typeof candidate?.unreadCount === "number"
      ? candidate.unreadCount
      : typeof root?.unreadCount === "number"
        ? root.unreadCount
        : typeof (meta as { unreadCount?: number } | undefined)?.unreadCount ===
            "number"
          ? (meta as { unreadCount: number }).unreadCount
          : items.filter((n) => !n.readAt).length;

  return { items, unreadCount, meta };
}

export const notificationApi = {
  list: async (query?: { page?: number; pageSize?: number }) => {
    const raw = await api.get<unknown>("/notifications", {
      query: {
        page: query?.page ?? 1,
        pageSize: query?.pageSize ?? 8,
      },
      withMeta: true,
    });
    return parseListPayload(raw);
  },

  markRead: (id: string) => api.post(`/notifications/${id}/read`, {}),

  markAllRead: () => api.post("/notifications/read-all", {}),
};
