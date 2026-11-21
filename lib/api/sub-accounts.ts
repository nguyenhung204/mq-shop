import { api } from "./client";
import type { PageMeta } from "./types";
import { parsePage } from "./utils";

/** ACTIVE once the person at the e-mail confirmed (or created by an admin / invite); PENDING_ACTIVATION until then. */
export type SubAccountStatus = "ACTIVE" | "PENDING_ACTIVATION" | "LOCKED" | string;

export type SubAccountItem = {
  id: string;
  email: string;
  fullName: string | null;
  status: SubAccountStatus;
  regionCode: string | null;
  subAccountCount: number;
  createdAt: string;
};

/** Counters live INSIDE meta (the response interceptor flattens {items, meta}). */
export type SubAccountListMeta = PageMeta & { subAccountCount?: number; cap?: number; pendingCount?: number };

export type SubAccountPage = { items: SubAccountItem[]; meta?: SubAccountListMeta };

export type CreateSubAccountBody = { email: string; fullName?: string; regionCode?: string };
export type AdminCreateSubAccountBody = CreateSubAccountBody & { reason: string };

export type CreatedSubAccount = {
  id: string;
  email: string;
  fullName: string | null;
  regionCode: string | null;
  status?: SubAccountStatus;
  parentAccountId: string;
  rootAccountId: string;
  depth: number;
  /** false: the code mail was not sent (e.g. the per-address cap); the person can request a code on the forgot-password page. */
  setupMailSent: boolean;
  createdAt: string;
};

export type InviteStatus = "PENDING" | "USED" | "REVOKED" | "EXPIRED";

export type InviteItem = {
  id: string;
  status: InviteStatus;
  expiresAt: string;
  usedByUserId: string | null;
  usedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

/** `token` is the plaintext, returned ONLY by the creation call; a replay of the same Idempotency-Key returns null. */
export type CreatedInvite = { id: string; token: string | null; expiresAt: string; createdAt: string };

export type TreeItem = SubAccountItem & { parentAccountId: string; depth: number };
export type AccountTree = {
  account: { id: string; email: string; fullName?: string | null } & Record<string, unknown>;
  items: TreeItem[];
  truncated: boolean;
  maxDepth: number;
  limit: number;
};
export type AccountRoot = {
  id: string;
  email: string;
  parentAccountId: string | null;
  rootAccountId: string;
  isSubAccount: boolean;
  depth: number;
  root: { id: string; email: string; fullName: string | null };
};

const idem = (key: string) => ({ headers: { "Idempotency-Key": key } });
const seg = encodeURIComponent;

export const subAccountsApi = {
  list: async (query?: { page?: number; pageSize?: number }): Promise<SubAccountPage> =>
    parsePage<SubAccountItem>(await api.get<unknown>("/sub-accounts", { query, withMeta: true })) as SubAccountPage,
  create: (body: CreateSubAccountBody, key: string) => api.post<CreatedSubAccount>("/sub-accounts", body, idem(key)),
  withdraw: (id: string, key: string) =>
    api.delete<{ id: string; status: string; subAccountSlotReleased: boolean }>(`/sub-accounts/${seg(id)}`, idem(key)),
  invites: async (query?: { page?: number; pageSize?: number }) =>
    parsePage<InviteItem>(await api.get<unknown>("/sub-accounts/invites", { query, withMeta: true })),
  createInvite: (key: string) => api.post<CreatedInvite>("/sub-accounts/invites", undefined, idem(key)),
  revokeInvite: (id: string, key: string) =>
    api.delete<{ id: string; status: string; changed: boolean }>(`/sub-accounts/invites/${seg(id)}`, idem(key)),
};

export const adminSubAccountsApi = {
  tree: (id: string, query?: { maxDepth?: number; limit?: number }) =>
    api.get<AccountTree>(`/admin/accounts/${seg(id)}/sub-accounts`, { query }),
  root: (id: string) => api.get<AccountRoot>(`/admin/accounts/${seg(id)}/root`),
  create: (id: string, body: AdminCreateSubAccountBody, key: string) =>
    api.post<CreatedSubAccount>(`/admin/accounts/${seg(id)}/sub-accounts`, body, idem(key)),
  discardPending: (id: string, body: { reason: string }, key: string) =>
    api.post<{ id: string; status: string; subAccountSlotReleased: boolean }>(`/admin/accounts/${seg(id)}/discard-pending`, body, idem(key)),
};

/** Public: the person at the e-mail refuses the reserved sub-account (code mailed to them). */
export const declineSubAccountApi = {
  decline: (body: { email: string; code: string }) => api.post<{ message?: string }>("/auth/sub-account/decline", body),
};
