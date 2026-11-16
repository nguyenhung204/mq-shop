"use client";

import { Fragment, useState } from "react";
import { History, Pencil } from "lucide-react";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { AdminActions, AdminIconButton } from "@/components/admin/AdminIconButton";
import { SettingEditModal } from "@/components/admin/SettingEditModal";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { TableSkeleton } from "@/components/ui/Skeleton";
import type { SystemSetting } from "@/lib/api/settings";
import { settingTexts } from "@/lib/settings/labels";
import { canWriteSettings } from "@/lib/auth/admin-write";
import { formatDateTimeGmt8 } from "@/lib/i18n/gmt8-calendar";
import { toIntlLocale } from "@/lib/i18n/locale-format";
import { useAdminSettings, useSettingHistory, useUpdateSetting } from "@/lib/queries/settings";
import { getErrorMessage } from "@/lib/queries/utils";

function HistoryPanel({ settingKey }: { settingKey: string }) {
  const { t, locale } = useLanguage();
  const { data, isLoading, isError } = useSettingHistory(settingKey);
  const intl = toIntlLocale(locale);
  const show = (v: number | null) => (v == null ? t("admin.settings.unset") : String(v));

  if (isLoading) return <p className="text-xs text-mq-text-muted">{t("admin.common.loading")}</p>;
  if (isError) return <p className="text-xs text-mq-text-muted">{t("admin.common.failed")}</p>;
  if (!data || data.length === 0) {
    return <p className="text-xs text-mq-text-muted">{t("admin.settings.historyEmpty")}</p>;
  }
  return (
    <table className="w-full text-xs">
      <thead className="text-left text-mq-text-muted">
        <tr>
          <th className="py-1 pr-3">{t("admin.settings.historyAt")}</th>
          <th className="py-1 pr-3">{t("admin.settings.historyChange")}</th>
          <th className="py-1 pr-3">{t("admin.common.reason")}</th>
        </tr>
      </thead>
      <tbody>
        {data.map((h) => (
          <tr key={h.id} className="border-t border-mq-border">
            <td className="py-1 pr-3 whitespace-nowrap">{formatDateTimeGmt8(h.at, intl)}</td>
            <td className="py-1 pr-3 whitespace-nowrap">
              {show(h.oldValue)} → {show(h.newValue)}
            </td>
            <td className="py-1 pr-3">{h.reason}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SettingsInner() {
  const { t, locale } = useLanguage();
  const { user } = useAuth();
  const canWrite = canWriteSettings(user);
  const { data, isLoading, isError, error } = useAdminSettings();
  const update = useUpdateSetting();
  const [editing, setEditing] = useState<SystemSetting | null>(null);
  const [openHistory, setOpenHistory] = useState<string | null>(null);
  const intl = toIntlLocale(locale);
  const items = data ?? [];

  const texts = (s: SystemSetting) => settingTexts(t, s);

  return (
    <>
      <AdminPageHeader
        title={t("admin.settings.title")}
        description={canWrite ? t("admin.settings.description") : t("admin.settings.descriptionReadOnly")}
      />
      <div className="space-y-6">
        {isError && (
          <div className="mq-alert mq-alert-error">{getErrorMessage(error, t("admin.common.failed"))}</div>
        )}
        {isLoading ? (
          <TableSkeleton rows={4} cols={5} />
        ) : items.length === 0 ? (
          <p className="text-sm text-mq-text-muted">{t("admin.settings.empty")}</p>
        ) : (
          <div className="mq-table-wrap">
            <table className="w-full text-sm">
              <thead className="bg-mq-surface-subtle text-left">
                <tr>
                  <th className="p-3">{t("admin.settings.setting")}</th>
                  <th className="p-3">{t("admin.settings.value")}</th>
                  <th className="p-3">{t("admin.settings.default")}</th>
                  <th className="p-3">{t("admin.settings.rangeHead")}</th>
                  <th className="p-3">{t("admin.settings.updated")}</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <Fragment key={s.key}>
                    <tr className="border-t border-mq-border align-top">
                      <td className="p-3 max-w-md">
                        <p className="font-medium">{texts(s).label}</p>
                        <p className="text-xs text-mq-text-muted mt-1">{texts(s).description}</p>
                      </td>
                      <td className="p-3">
                        {s.value == null ? (
                          <>
                            <span className="mq-badge mq-badge-muted">{t("admin.settings.unset")}</span>
                            <p className="text-xs text-mq-text-muted mt-1 max-w-xs">{texts(s).nullMeaning}</p>
                          </>
                        ) : (
                          <span className="font-semibold tabular-nums">{s.value}</span>
                        )}
                        {s.isDefault ? (
                          <p className="text-[11px] text-mq-text-muted mt-1">{t("admin.settings.isDefault")}</p>
                        ) : null}
                      </td>
                      <td className="p-3 tabular-nums">
                        {s.default == null ? t("admin.settings.unset") : s.default}
                      </td>
                      <td className="p-3 text-xs whitespace-nowrap">
                        {s.min}–{s.max}
                      </td>
                      <td className="p-3 text-xs text-mq-text-muted whitespace-nowrap">
                        {s.updatedAt ? formatDateTimeGmt8(s.updatedAt, intl) : "—"}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <AdminActions>
                          <AdminIconButton
                            label={t("admin.settings.history")}
                            icon={History}
                            tone="secondary"
                            onClick={() => setOpenHistory(openHistory === s.key ? null : s.key)}
                          />
                          {canWrite ? (
                            <AdminIconButton
                              label={t("admin.settings.edit")}
                              icon={Pencil}
                              tone="approve"
                              onClick={() => setEditing(s)}
                            />
                          ) : null}
                        </AdminActions>
                      </td>
                    </tr>
                    {openHistory === s.key ? (
                      <tr className="border-t border-mq-border bg-mq-surface-subtle">
                        <td colSpan={6} className="p-3">
                          <HistoryPanel settingKey={s.key} />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <SettingEditModal
        open={editing != null}
        setting={editing}
        busy={update.isPending}
        onClose={() => setEditing(null)}
        onConfirm={async (body) => {
          if (!editing) return;
          try {
            await update.mutateAsync({ key: editing.key, body });
            setEditing(null);
          } catch {
            /* toast shown by the hook; keep the modal open for a retry */
          }
        }}
      />
    </>
  );
}

export default function AdminSettingsPage() {
  return (
    <AuthGuard roles={["SUPER_ADMIN", "ADMIN"]} permissions={["CONFIG_SYS"]}>
      <SettingsInner />
    </AuthGuard>
  );
}
