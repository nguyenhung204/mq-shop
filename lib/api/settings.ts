import { api } from "./client";

export type SettingKey = string;

export type SystemSetting = {
  key: SettingKey;
  /** null = unset (see `nullMeaning`). */
  value: number | null;
  default: number | null;
  isDefault: boolean;
  min: number;
  max: number;
  nullable: boolean;
  description: string;
  nullMeaning: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
};

export type SystemSettingHistoryRow = {
  id: string;
  key: SettingKey;
  oldValue: number | null;
  newValue: number | null;
  changedBy: string | null;
  reason: string;
  at: string;
};

export type UpdateSettingBody = { value: number | null; reason: string };

export type UpdateSettingResult = SystemSetting & { changed: boolean };

export const adminSettingsApi = {
  list: () => api.get<{ items: SystemSetting[] }>("/admin/settings"),

  history: (key: SettingKey, limit = 50) =>
    api.get<{ items: SystemSettingHistoryRow[] }>(
      `/admin/settings/${encodeURIComponent(key)}/history`,
      { query: { limit } },
    ),

  /** SUPER_ADMIN only. Idempotency-Key is sent on every write (UI6). */
  update: (key: SettingKey, body: UpdateSettingBody, idempotencyKey: string) =>
    api.put<UpdateSettingResult>(`/admin/settings/${encodeURIComponent(key)}`, body, {
      headers: { "Idempotency-Key": idempotencyKey },
    }),
};
