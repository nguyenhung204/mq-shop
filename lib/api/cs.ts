import { api } from "./client";
import type { PageMeta } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CsCustomerListItem {
  id: string;
  email: string;
  fullName: string | null;
  status: string;
  roles: string[];
  createdAt: string;
}

export interface CsCustomerRecentOrder {
  id: string;
  code: string;
  status: string;
  total: string;
  currency: string;
  createdAt: string;
}

export interface CsCustomerStats {
  totalOrders: number;
  totalRma: number;
}

export interface CsCustomerDetail {
  id: string;
  email: string;
  fullName: string | null;
  status: string;
  roles: string[];
  createdAt: string;
  stats: CsCustomerStats;
  recentOrders: CsCustomerRecentOrder[];
}

export interface CsCustomerOrderItem {
  id: string;
  code: string;
  status: string;
  total: string;
  currency: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export const csApi = {
  /** Search customers by email or name */
  customers: async (query?: {
    q?: string;
    page?: number;
    pageSize?: number;
  }) => {
    return api.get<
      | CsCustomerListItem[]
      | { data: CsCustomerListItem[]; meta?: PageMeta }
    >("/cs/customers", { query, withMeta: true });
  },

  /** Customer detail with stats + recent orders */
  customerDetail: (userId: string) =>
    api.get<CsCustomerDetail>(`/cs/customers/${userId}`),

  /** Full order history for a customer (paginated) */
  customerOrders: (userId: string, query?: { page?: number; pageSize?: number }) =>
    api.get<
      | CsCustomerOrderItem[]
      | { data: CsCustomerOrderItem[]; meta?: PageMeta }
    >(`/cs/customers/${userId}/orders`, { query, withMeta: true }),
};
