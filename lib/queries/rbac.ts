"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/client";
import {
  adminRbacApi,
  type PutRbacOverridesBody,
  type RbacOverrideRow,
} from "@/lib/api/rbac";
import { tt } from "@/lib/i18n/tt";
import { getErrorMessage } from "@/lib/queries/utils";

export const rbacKeys = {
  all: ["rbac"] as const,
  matrix: () => [...rbacKeys.all, "matrix"] as const,
  overrides: () => [...rbacKeys.all, "overrides"] as const,
};

export function useRbacMatrix(enabled = true) {
  return useQuery({
    queryKey: rbacKeys.matrix(),
    queryFn: () => adminRbacApi.getMatrix(),
    enabled,
  });
}

export function useRbacOverrides(enabled = true) {
  return useQuery({
    queryKey: rbacKeys.overrides(),
    queryFn: async (): Promise<RbacOverrideRow[]> => {
      const data = await adminRbacApi.listOverrides();
      return Array.isArray(data) ? data : [];
    },
    enabled,
  });
}

function toastRbacError(e: unknown, fallbackKey: string) {
  if (e instanceof ApiError) {
    if (e.code === "RBAC_MATRIX_LOCKOUT") {
      toast.error(tt("toast.rbacMatrixLockout"));
      return;
    }
    if (e.code === "RBAC_MATRIX_INVALID") {
      toast.error(tt("toast.rbacMatrixInvalid"));
      return;
    }
    if (e.code === "FORBIDDEN" || e.status === 403) {
      toast.error(tt("toast.accessDenied"));
      return;
    }
  }
  toast.error(getErrorMessage(e, tt(fallbackKey)));
}

export function usePutRbacOverrides() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: PutRbacOverridesBody) => adminRbacApi.putOverrides(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: rbacKeys.all });
      toast.success(tt("toast.rbacMatrixSaved"));
    },
    onError: (e) => toastRbacError(e, "toast.rbacMatrixSaveFailed"),
  });
}

export function useResetRbacMatrix() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => adminRbacApi.resetMatrix(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: rbacKeys.all });
      toast.success(tt("toast.rbacMatrixReset"));
    },
    onError: (e) => toastRbacError(e, "toast.rbacMatrixResetFailed"),
  });
}
