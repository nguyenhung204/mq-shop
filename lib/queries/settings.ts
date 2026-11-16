"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createIdempotentRunner } from "@/lib/queries/idempotent-run";
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
  const idempotency = useMemo(() => createIdempotentRunner(), []);

  return useMutation({
    mutationFn: (vars: { key: SettingKey; body: UpdateSettingBody }) =>
      idempotency.run(vars, (v, key) => adminSettingsApi.update(v.key, v.body, key)),
    onSuccess: (res) => {
      idempotency.onSuccess();
      void queryClient.invalidateQueries({ queryKey: settingsKeys.all });
      toast.success(tt(res.changed ? "toast.settingSaved" : "toast.settingUnchanged"));
    },
    onError: (e) => {
      idempotency.onError(e);
      toast.error(getErrorMessage(e, tt("admin.common.failed")));
    },
  });
}
