import { api } from "./client";
import type { PageMeta } from "./types";
import { asArray } from "./utils";

export type SettlementStatus =
  | "PENDING_RECONCILE"
  | "INCLUDED_IN_PAYOUT"
  | "PAID_OUT"
  | "VOIDED";

export type SettlementView = {
  id: string;
  shopId: string;
  orderId: string;
  orderCode: string | null;
  amount: number;
  currency: "TWD";
  status: SettlementStatus;
  createdAt: string;
};

/** Pagination meta after interceptor flatten — totals live on meta. */
export type SettlementPageMeta = PageMeta & {
  pendingTotal?: number;
  status?: SettlementStatus;
  currency?: "TWD";
};

export type SettlementSummary = {
  status?: SettlementStatus;
  pendingTotal: number;
  currency?: "TWD";
};

export type SettlementListResult = {
  items: SettlementView[];
  meta?: SettlementPageMeta;
  summary: SettlementSummary;
};

export type ListSettlementsParams = {
  status?: SettlementStatus;
  page?: number;
  pageSize?: number;
};

export type AdminListSettlementsParams = ListSettlementsParams & {
  shopId?: string;
};

/**
 * Wire (after ResponseInterceptor flatten):
 * { data: SettlementView[], meta: { page, pageSize, total, totalPages, pendingTotal, status?, currency? } }
 *
 * Legacy fallback: { data: { items, meta, summary? } }
 */
function parseSettlementsPayload(raw: unknown): SettlementListResult {
  const root = raw as {
    data?: unknown;
    meta?: SettlementPageMeta;
    items?: SettlementView[];
    summary?: SettlementSummary;
  };

  const nested =
    root?.data && typeof root.data === "object" && !Array.isArray(root.data)
      ? (root.data as {
          items?: SettlementView[];
          meta?: SettlementPageMeta;
          summary?: SettlementSummary;
        })
      : null;

  if (nested && nested.items) {
    const items = asArray<SettlementView>(nested.items);
    const meta = nested.meta ?? root.meta;
    return {
      items,
      meta,
      summary: summaryFrom(meta, nested.summary, items),
    };
  }

  // Primary wire: data = items[], meta carries pendingTotal
  if (Array.isArray(root?.data)) {
    const items = root.data as SettlementView[];
    return {
      items,
      meta: root.meta,
      summary: summaryFrom(root.meta, root.summary, items),
    };
  }

  const items = asArray<SettlementView>(root?.items ?? []);
  return {
    items,
    meta: root?.meta,
    summary: summaryFrom(root?.meta, root?.summary, items),
  };
}

function summaryFrom(
  meta: SettlementPageMeta | undefined,
  summary: SettlementSummary | undefined,
  items: SettlementView[],
): SettlementSummary {
  if (typeof meta?.pendingTotal === "number") {
    return {
      pendingTotal: meta.pendingTotal,
      status: meta.status ?? summary?.status,
      currency: meta.currency ?? summary?.currency ?? "TWD",
    };
  }
  if (typeof summary?.pendingTotal === "number") {
    return {
      pendingTotal: summary.pendingTotal,
      status: summary.status,
      currency: summary.currency ?? "TWD",
    };
  }
  // Last resort: sum current page only (incomplete if multi-page)
  return {
    pendingTotal: items.reduce((s, row) => s + Number(row.amount || 0), 0),
    currency: "TWD",
  };
}

export const settlementApi = {
  list: async (query?: ListSettlementsParams) => {
    const raw = await api.get<unknown>("/settlements", {
      query: {
        ...(query?.status ? { status: query.status } : {}),
        page: query?.page ?? 1,
        pageSize: query?.pageSize ?? 20,
      },
      withMeta: true,
    });
    return parseSettlementsPayload(raw);
  },
};

export const adminSettlementApi = {
  list: async (query?: AdminListSettlementsParams) => {
    const raw = await api.get<unknown>("/admin/settlements", {
      query: {
        ...(query?.status ? { status: query.status } : {}),
        shopId: query?.shopId,
        page: query?.page ?? 1,
        pageSize: query?.pageSize ?? 20,
      },
      withMeta: true,
    });
    return parseSettlementsPayload(raw);
  },
};
