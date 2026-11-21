import { api } from "./client";

export type SettingKey = string;

/** Registry value kind (C1-8). An older API omits it: treat as "int". */
export type SettingKind = "int" | "bool" | "decimal";

/** int and decimal settings are numbers, bool settings are booleans, null = unset (see `nullMeaning`). */
export type SettingValue = number | boolean | null;

export type SystemSetting = {
  key: SettingKey;
  kind?: SettingKind;
  value: SettingValue;
  default: SettingValue;
  isDefault: boolean;
  /** null for a bool setting. */
  min: number | null;
  max: number | null;
  nullable: boolean;
  description: string;
  nullMeaning: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
};

export type SystemSettingHistoryRow = {
  id: string;
  key: SettingKey;
  oldValue: SettingValue;
  newValue: SettingValue;
  changedBy: string | null;
  reason: string;
  at: string;
};

export type UpdateSettingBody = { value: SettingValue; reason: string };

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
