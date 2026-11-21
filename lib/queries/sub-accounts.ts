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

/** Creation is budgeted per hour: a 429 there means "too many sub-accounts created recently", not a generic throttle. */
export function subAccountErrorText(e: unknown): string {
  if (e instanceof ApiError && e.status === 429) return tt("subAccounts.errors.budget");
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
    fail: (key: string, e: unknown) => {
      runners.forKey(key).onError(e);
      void queryClient.invalidateQueries({ queryKey: subAccountKeys.all });
      toast.error(subAccountErrorText(e));
    },
  };
}

export function useCreateSubAccount() {
  const runners = useRunners();
  const s = useSettle(runners);
  return useMutation({
    mutationFn: (body: CreateSubAccountBody) => runners.forKey("create").run(body, (b, key) => subAccountsApi.create(b, key)),
    onSuccess: () => s.ok("create", "subAccounts.toast.created"),
    onError: (e) => s.fail("create", e),
  });
}

export function useWithdrawSubAccount() {
  const runners = useRunners();
  const s = useSettle(runners);
  return useMutation({
    mutationFn: (id: string) => runners.forKey(`${id}:withdraw`).run(id, (v, key) => subAccountsApi.withdraw(v, key)),
    onSuccess: (_d, id) => s.ok(`${id}:withdraw`, "subAccounts.toast.withdrawn"),
    onError: (e, id) => s.fail(`${id}:withdraw`, e),
  });
}

/** The plaintext token is in the mutation result only; it is never put in the query cache. */
export function useCreateInvite() {
  const runners = useRunners();
  const s = useSettle(runners);
  return useMutation({
    mutationFn: () => runners.forKey("invite:create").run(null, (_v, key) => subAccountsApi.createInvite(key)),
    onSuccess: () => s.ok("invite:create"),
    onError: (e) => s.fail("invite:create", e),
  });
}

export function useRevokeInvite() {
  const runners = useRunners();
  const s = useSettle(runners);
  return useMutation({
    mutationFn: (id: string) => runners.forKey(`${id}:revoke`).run(id, (v, key) => subAccountsApi.revokeInvite(v, key)),
    onSuccess: (_d, id) => s.ok(`${id}:revoke`, "subAccounts.toast.revoked"),
    onError: (e, id) => s.fail(`${id}:revoke`, e),
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
  const k = `${accountId}:create`;
  return useMutation({
    mutationFn: (body: AdminCreateSubAccountBody) => runners.forKey(k).run(body, (b, key) => adminSubAccountsApi.create(accountId, b, key)),
    onSuccess: () => s.ok(k, "subAccounts.toast.created"),
    onError: (e) => s.fail(k, e),
  });
}

export function useDiscardPending() {
  const runners = useRunners();
  const s = useSettle(runners);
  return useMutation({
    mutationFn: (vars: { id: string; reason: string }) =>
      runners.forKey(`${vars.id}:discard`).run(vars, (v, key) => adminSubAccountsApi.discardPending(v.id, { reason: v.reason }, key)),
    onSuccess: (_d, vars) => s.ok(`${vars.id}:discard`, "subAccounts.toast.discarded"),
    onError: (e, vars) => s.fail(`${vars.id}:discard`, e),
  });
}

export function useDeclineSubAccount() {
  return useMutation({ mutationFn: (body: { email: string; code: string }) => declineSubAccountApi.decline(body) });
}
