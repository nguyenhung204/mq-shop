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
  const metaUnreadCount = (meta as (PageMeta & { unreadCount?: number }) | undefined)
    ?.unreadCount;
  const unreadCount =
    typeof candidate?.unreadCount === "number"
      ? candidate.unreadCount
      : typeof root?.unreadCount === "number"
        ? root.unreadCount
        : typeof metaUnreadCount === "number"
          ? metaUnreadCount
          : items.filter((n) => !n.readAt).length;

  return { items, unreadCount, meta };
}

export const notificationApi = {
  list: async (query?: {
    page?: number;
    pageSize?: number;
    category?: string;
    unreadOnly?: boolean;
  }) => {
    const raw = await api.get<unknown>("/notifications", {
      query: {
        page: query?.page ?? 1,
        pageSize: query?.pageSize ?? 8,
        category: query?.category,
        unreadOnly: query?.unreadOnly ? true : undefined,
      },
      withMeta: true,
    });
    return parseListPayload(raw);
  },

  markRead: (id: string) => api.post(`/notifications/${id}/read`, {}),

  markAllRead: () => api.post("/notifications/read-all", {}),

  hide: (id: string) => api.delete(`/notifications/${id}`),
};

export type AdminNotificationTarget = {
  type: "USER" | "ROLE" | "ALL" | "SHOP_ROLE";
  value?: string | null;
  shopId?: string | null;
};

export type AdminCatalogItem = {
  type: string;
  mode: "system" | "broadcast";
  category: string;
  source: string;
  title: string;
  body: string;
  actors: string[];
  shopRoles: string[];
  roles: Array<{ role: string; granted: boolean }>;
  allowedSendTargets: Array<"ALL" | "ROLE" | "USER">;
  locked: boolean;
};

export type AdminSentNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  createdAt: string;
  createdBy: string | null;
  recipientCount: number | null;
  targets: AdminNotificationTarget[];
};

export const adminNotificationApi = {
  catalog: () =>
    api.get<{ roles: string[]; items: AdminCatalogItem[] }>(
      "/admin/notifications/catalog",
    ),

  list: (query?: { page?: number; pageSize?: number }) =>
    api.get<unknown>("/admin/notifications", {
      query: {
        page: query?.page ?? 1,
        pageSize: query?.pageSize ?? 20,
      },
      withMeta: true,
    }),

  recipientCount: (query: {
    all?: boolean;
    roles?: string;
    userIds?: string;
  }) =>
    api.get<{ count: number }>("/admin/notifications/recipient-count", {
      query,
    }),

  create: (body: {
    type: string;
    title: string;
    body: string;
    targets: AdminNotificationTarget[];
  }) => api.post<{ id: string; recipientCount: number }>("/admin/notifications", body),
};

