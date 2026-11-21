"use client";

import { useMemo } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  adminRefundCasesApi,
  refundCasesApi,
  type AdminRefundCaseQuery,
  type RefundCaseStatus,
} from "@/lib/api/refund-cases";
import { createKeyedRunners } from "@/lib/queries/idempotent-run";
import { caseRouteErrorKey } from "@/lib/refund-cases/model";
import { tt } from "@/lib/i18n/tt";
import { getErrorMessage } from "@/lib/queries/utils";

export const refundCaseKeys = {
  all: ["refund-cases"] as const,
  buyer: (status: string, page: number) => [...refundCaseKeys.all, "buyer", status, page] as const,
  seller: (status: string, page: number) => [...refundCaseKeys.all, "seller", status, page] as const,
  detail: (id: string) => [...refundCaseKeys.all, "detail", id] as const,
  adminList: (q: object, page: number) => [...refundCaseKeys.all, "admin", JSON.stringify(q), page] as const,
  adminSummary: (q: object) => [...refundCaseKeys.all, "admin-summary", JSON.stringify(q)] as const,
  adminDetail: (id: string) => [...refundCaseKeys.all, "admin-detail", id] as const,
};

const PAGE_SIZE = 20;

/** Translated text of a failed case action (RMA-linked refusals have their own text on these routes). */
function caseErrorText(e: unknown, route: "party" | "override"): string {
  const k = caseRouteErrorKey(e, route);
  return k ? tt(k.key, k.params) : getErrorMessage(e, tt("admin.common.failed"));
}

export function useBuyerRefundCases(status: string, page: number) {
  return useQuery({
    queryKey: refundCaseKeys.buyer(status, page),
    queryFn: () => refundCasesApi.asBuyer({ status: status || undefined, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
}

export function useSellerRefundCases(status: string, page: number) {
  return useQuery({
    queryKey: refundCaseKeys.seller(status, page),
    queryFn: () => refundCasesApi.asSeller({ status: status || undefined, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
}

export function useRefundCaseDetail(id: string, enabled: boolean) {
  return useQuery({
    queryKey: refundCaseKeys.detail(id),
    queryFn: () => refundCasesApi.get(id),
    enabled: enabled && Boolean(id),
  });
}

export type CaseActionVars =
  | { id: string; action: "markPaid"; body: { note?: string; reference?: string } }
  | { id: string; action: "confirm"; body: { note?: string } }
  | { id: string; action: "dispute"; body: { note: string } };

const SUCCESS_TOAST: Record<CaseActionVars["action"], string> = {
  markPaid: "refundCases.toast.markedPaid",
  confirm: "refundCases.toast.confirmed",
  dispute: "refundCases.toast.disputed",
};

/** Buyer confirm / dispute and seller mark-paid. A retry of the same request reuses the Idempotency-Key. */
export function useRefundCaseAction() {
  const queryClient = useQueryClient();
  const runners = useMemo(() => createKeyedRunners(), []);
  return useMutation({
    mutationFn: (vars: CaseActionVars) =>
      runners.forKey(`${vars.id}:${vars.action}`).run(vars, (v, key) => {
        switch (v.action) {
          case "markPaid":
            return refundCasesApi.markPaid(v.id, v.body, key);
          case "confirm":
            return refundCasesApi.confirm(v.id, v.body, key);
          case "dispute":
            return refundCasesApi.dispute(v.id, v.body, key);
        }
      }),
    onSuccess: (_d, vars) => {
      runners.forKey(`${vars.id}:${vars.action}`).onSuccess();
      void queryClient.invalidateQueries({ queryKey: refundCaseKeys.all });
      toast.success(tt(SUCCESS_TOAST[vars.action]));
    },
    onError: (e, vars) => {
      runners.forKey(`${vars.id}:${vars.action}`).onError(e);
      void queryClient.invalidateQueries({ queryKey: refundCaseKeys.all });
      toast.error(caseErrorText(e, "party"));
    },
  });
}

export function useAdminRefundCases(q: Omit<AdminRefundCaseQuery, "page" | "pageSize">, page: number, enabled = true) {
  return useQuery({
    queryKey: refundCaseKeys.adminList(q, page),
    queryFn: () => adminRefundCasesApi.list({ ...q, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useAdminRefundSummary(q: Omit<AdminRefundCaseQuery, "page" | "pageSize">, enabled = true) {
  return useQuery({
    queryKey: refundCaseKeys.adminSummary(q),
    queryFn: () => adminRefundCasesApi.summary(q),
    enabled,
  });
}

export function useAdminRefundCaseDetail(id: string) {
  return useQuery({
    queryKey: refundCaseKeys.adminDetail(id),
    queryFn: () => adminRefundCasesApi.get(id),
    enabled: Boolean(id),
  });
}

export function useOverrideRefundCase() {
  const queryClient = useQueryClient();
  const runners = useMemo(() => createKeyedRunners(), []);
  return useMutation({
    mutationFn: (vars: { id: string; toStatus: RefundCaseStatus; reason: string }) =>
      runners.forKey(`${vars.id}:override`).run(vars, (v, key) =>
        adminRefundCasesApi.override(v.id, { toStatus: v.toStatus, reason: v.reason }, key),
      ),
    onSuccess: (_d, vars) => {
      runners.forKey(`${vars.id}:override`).onSuccess();
      void queryClient.invalidateQueries({ queryKey: refundCaseKeys.all });
      toast.success(tt("refundCases.toast.overridden"));
    },
    onError: (e, vars) => {
      runners.forKey(`${vars.id}:override`).onError(e);
      void queryClient.invalidateQueries({ queryKey: refundCaseKeys.all });
      toast.error(caseErrorText(e, "override"));
    },
  });
}
