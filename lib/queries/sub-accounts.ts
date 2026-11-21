"use client";

import { useMemo } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/client";
import {
  adminSubAccountsApi,
  declineSubAccountApi,
  subAccountsApi,
  type AdminCreateSubAccountBody,
  type CreateSubAccountBody,
} from "@/lib/api/sub-accounts";
import { createKeyedRunners } from "@/lib/queries/idempotent-run";
import { tt } from "@/lib/i18n/tt";
import { getErrorMessage } from "@/lib/queries/utils";

export const subAccountKeys = {
  all: ["sub-accounts"] as const,
  list: (page: number) => [...subAccountKeys.all, "list", page] as const,
  invites: (page: number) => [...subAccountKeys.all, "invites", page] as const,
  tree: (id: string, maxDepth: number, limit: number) => [...subAccountKeys.all, "tree", id, maxDepth, limit] as const,
  root: (id: string) => [...subAccountKeys.all, "root", id] as const,
};

/** What the failing call was: only creation has the hourly budget; the other routes are plain rate limits. */
export type SubAccountOp = "create" | "other";

/**
 * Creation is budgeted per hour: a 429 there means "too many sub-accounts created recently". A 429 on withdraw,
 * revoke, invite or discard is the ordinary rate limit and gets the generic "too many requests" text.
 */
export function subAccountErrorText(e: unknown, op: SubAccountOp = "other"): string {
  if (e instanceof ApiError && e.status === 429) return tt(op === "create" ? "subAccounts.errors.budget" : "subAccounts.errors.tooMany");
  if (e instanceof ApiError && e.status === 404 && e.code !== "SUB_ACCOUNT_INVITE_NOT_FOUND") return tt("subAccounts.errors.notFound");
  return getErrorMessage(e, tt("admin.common.failed"));
}

const PAGE_SIZE = 20;

export function useSubAccounts(page: number) {
  return useQuery({
    queryKey: subAccountKeys.list(page),
    queryFn: () => subAccountsApi.list({ page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
}

export function useSubAccountInvites(page: number) {
  return useQuery({
    queryKey: subAccountKeys.invites(page),
    queryFn: () => subAccountsApi.invites({ page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
}

/** Operation keys: one Idempotency-Key lifecycle per (resource, action). */
export const subAccountOpKey = {
  create: "create",
  withdraw: (id: string) => `${id}:withdraw`,
  inviteCreate: "invite:create",
  revoke: (id: string) => `${id}:revoke`,
  adminCreate: (accountId: string) => `${accountId}:create`,
  discard: (id: string) => `${id}:discard`,
} as const;

/** One Idempotency-Key lifecycle per (resource, action): "create", "<id>:withdraw", "invite:create", "<id>:revoke". */
function useRunners() {
  return useMemo(() => createKeyedRunners(), []);
}

function useSettle(runners: ReturnType<typeof createKeyedRunners>) {
  const queryClient = useQueryClient();
  return {
    ok: (key: string, message?: string) => {
      runners.forKey(key).onSuccess();
      void queryClient.invalidateQueries({ queryKey: subAccountKeys.all });
      if (message) toast.success(tt(message));
    },
    fail: (key: string, e: unknown, op: SubAccountOp = "other") => {
      runners.forKey(key).onError(e);
      void queryClient.invalidateQueries({ queryKey: subAccountKeys.all });
      toast.error(subAccountErrorText(e, op));
    },
  };
}

export function useCreateSubAccount() {
  const runners = useRunners();
  const s = useSettle(runners);
  return useMutation({
    mutationFn: (body: CreateSubAccountBody) => runners.forKey(subAccountOpKey.create).run(body, (b, key) => subAccountsApi.create(b, key)),
    onSuccess: () => s.ok(subAccountOpKey.create, "subAccounts.toast.created"),
    onError: (e) => s.fail(subAccountOpKey.create, e, "create"),
  });
}

export function useWithdrawSubAccount() {
  const runners = useRunners();
  const s = useSettle(runners);
  return useMutation({
    mutationFn: (id: string) => runners.forKey(subAccountOpKey.withdraw(id)).run(id, (v, key) => subAccountsApi.withdraw(v, key)),
    onSuccess: (_d, id) => s.ok(subAccountOpKey.withdraw(id), "subAccounts.toast.withdrawn"),
    onError: (e, id) => s.fail(subAccountOpKey.withdraw(id), e),
  });
}

/** The plaintext token is in the mutation result only; it is never put in the query cache. */
export function useCreateInvite() {
  const runners = useRunners();
  const s = useSettle(runners);
  return useMutation({
    mutationFn: () => runners.forKey(subAccountOpKey.inviteCreate).run(null, (_v, key) => subAccountsApi.createInvite(key)),
    onSuccess: () => s.ok(subAccountOpKey.inviteCreate),
    onError: (e) => s.fail(subAccountOpKey.inviteCreate, e),
  });
}

export function useRevokeInvite() {
  const runners = useRunners();
  const s = useSettle(runners);
  return useMutation({
    mutationFn: (id: string) => runners.forKey(subAccountOpKey.revoke(id)).run(id, (v, key) => subAccountsApi.revokeInvite(v, key)),
    onSuccess: (_d, id) => s.ok(subAccountOpKey.revoke(id), "subAccounts.toast.revoked"),
    onError: (e, id) => s.fail(subAccountOpKey.revoke(id), e),
  });
}

export function useSubAccountTree(id: string, maxDepth: number, limit: number) {
  return useQuery({
    queryKey: subAccountKeys.tree(id, maxDepth, limit),
    queryFn: () => adminSubAccountsApi.tree(id, { maxDepth, limit }),
    enabled: Boolean(id),
  });
}

export function useAccountRoot(id: string) {
  return useQuery({ queryKey: subAccountKeys.root(id), queryFn: () => adminSubAccountsApi.root(id), enabled: Boolean(id) });
}

export function useAdminCreateSubAccount(accountId: string) {
  const runners = useRunners();
  const s = useSettle(runners);
  const k = subAccountOpKey.adminCreate(accountId);
  return useMutation({
    mutationFn: (body: AdminCreateSubAccountBody) => runners.forKey(k).run(body, (b, key) => adminSubAccountsApi.create(accountId, b, key)),
    onSuccess: () => s.ok(k, "subAccounts.toast.created"),
    onError: (e) => s.fail(k, e, "create"),
  });
}

export function useDiscardPending() {
  const runners = useRunners();
  const s = useSettle(runners);
  return useMutation({
    mutationFn: (vars: { id: string; reason: string }) =>
      runners.forKey(subAccountOpKey.discard(vars.id)).run(vars, (v, key) => adminSubAccountsApi.discardPending(v.id, { reason: v.reason }, key)),
    onSuccess: (_d, vars) => s.ok(subAccountOpKey.discard(vars.id), "subAccounts.toast.discarded"),
    onError: (e, vars) => s.fail(subAccountOpKey.discard(vars.id), e),
  });
}

export function useDeclineSubAccount() {
  return useMutation({ mutationFn: (body: { email: string; code: string }) => declineSubAccountApi.decline(body) });
}
