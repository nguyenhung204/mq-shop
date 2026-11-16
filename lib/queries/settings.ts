"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/client";
import { createIdempotencyKeyStore } from "@/lib/api/idempotency";
import {
  adminSettingsApi,
  type SettingKey,
  type UpdateSettingBody,
} from "@/lib/api/settings";
import { tt } from "@/lib/i18n/tt";
import { getErrorMessage } from "@/lib/queries/utils";

export const settingsKeys = {
  all: ["admin-settings"] as const,
  list: () => [...settingsKeys.all, "list"] as const,
  history: (key: SettingKey) => [...settingsKeys.all, "history", key] as const,
};

export function useAdminSettings(enabled = true) {
  return useQuery({
    queryKey: settingsKeys.list(),
    queryFn: async () => (await adminSettingsApi.list()).items ?? [],
    enabled,
  });
}

export function useSettingHistory(key: SettingKey | null) {
  return useQuery({
    queryKey: settingsKeys.history(key ?? ""),
    queryFn: async () => (await adminSettingsApi.history(key!, 50)).items ?? [],
    enabled: Boolean(key),
  });
}

export function useUpdateSetting() {
  const queryClient = useQueryClient();
  const idempotency = useMemo(() => createIdempotencyKeyStore(), []);

  return useMutation({
    mutationFn: (vars: { key: SettingKey; body: UpdateSettingBody }) =>
      adminSettingsApi.update(vars.key, vars.body, idempotency.keyFor(vars)),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: settingsKeys.all });
      toast.success(tt(res.changed ? "toast.settingSaved" : "toast.settingUnchanged"));
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === "IDEMPOTENCY_KEY_REUSE_MISMATCH") {
        idempotency.invalidate();
      }
      toast.error(getErrorMessage(e, tt("admin.common.failed")));
    },
  });
}
