"use client";

import { FormEvent, useEffect, useId, useState } from "react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import type { SettingValue, SystemSetting } from "@/lib/api/settings";
import { REASON_MAX } from "@/lib/admin/reason";
import { AutoCreditWarning } from "@/components/dividend/SettlementViews";
import { SETTING_AUTO_ENABLED, SETTING_FROM_QUARTER } from "@/lib/dividend/settlement";
import { settingTexts } from "@/lib/settings/labels";
import {
  initialSettingFlag,
  initialSettingText,
  settingKind,
  validateSettingEdit,
  type SettingEditError,
} from "@/lib/settings/edit";

type Props = {
  open: boolean;
  setting: SystemSetting | null;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (body: { value: SettingValue; reason: string }) => void | Promise<void>;
};

function errorKey(e: SettingEditError): string {
  return e.field === "value"
    ? `admin.settings.errors.${e.code}`
    : `admin.common.reasonErrors.${e.code}`;
}

export function SettingEditModal({ open, setting, busy = false, onClose, onConfirm }: Props) {
  if (!open || !setting) return null;
  // Mounted fresh on every open, so the form state needs no reset effect.
  return <SettingEditForm key={setting.key} setting={setting} busy={busy} onClose={onClose} onConfirm={onConfirm} />;
}

function SettingEditForm({
  setting,
  busy,
  onClose,
  onConfirm,
}: {
  setting: SystemSetting;
  busy: boolean;
  onClose: () => void;
  onConfirm: Props["onConfirm"];
}) {
  const { t } = useLanguage();
  const kind = settingKind(setting);
  const [raw, setRaw] = useState(initialSettingText({ key: setting.key, kind: setting.kind, value: setting.value }));
  const [flag, setFlag] = useState(initialSettingFlag(setting));
  const [clear, setClear] = useState(false);
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<SettingEditError[]>([]);
  const titleId = useId();
  const valueId = useId();
  const reasonId = useId();
  const errId = useId();
  const a11y = (field: string) => {
    const bad = errors.some((e) => e.field === field);
    return { "aria-invalid": bad || undefined, "aria-describedby": bad ? errId : undefined } as const;
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const res = validateSettingEdit(setting, { raw, clear, reason, flag });
    if (!res.ok) {
      setErrors(res.errors);
      return;
    }
    setErrors([]);
    await onConfirm(res.body);
  };

  const texts = settingTexts(t, setting);

  return (
    <div className="mq-admin-modal-root" role="presentation">
      <button
        type="button"
        className="mq-admin-modal-backdrop"
        aria-label={t("admin.common.close")}
        disabled={busy}
        onClick={onClose}
      />
      <div className="mq-admin-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="mq-admin-modal-head" style={{ flexDirection: "column", alignItems: "flex-start" }}>
          <h2 id={titleId} className="mq-admin-modal-title">
            {t("admin.settings.editTitle", { name: texts.label })}
          </h2>
          {kind === "bool" ? null : (
            <p className="mq-admin-modal-desc">
              {t(setting.key === SETTING_FROM_QUARTER ? "admin.settings.rangeQuarter" : kind === "decimal" ? "admin.settings.rangeDecimal" : "admin.settings.range", {
                min: String(setting.min),
                max: String(setting.max),
              })}
            </p>
          )}
        </header>
        <form className="mq-admin-modal-body" onSubmit={(e) => void submit(e)} noValidate>
          {setting.key === SETTING_AUTO_ENABLED || setting.key === SETTING_FROM_QUARTER ? <AutoCreditWarning compact /> : null}
          {kind === "bool" ? (
            <label htmlFor={valueId} className="flex items-center gap-2 text-sm">
              <input
                id={valueId}
                type="checkbox"
                role="switch"
                checked={flag}
                disabled={busy}
                {...a11y("value")}
                onChange={(e) => setFlag(e.target.checked)}
              />
              <span>{flag ? t("admin.settings.on") : t("admin.settings.off")}</span>
            </label>
          ) : (
            <>
              <label htmlFor={valueId} className="mq-admin-modal-label">
                {t("admin.settings.value")}
              </label>
              <input
                id={valueId}
                className="mq-input"
                inputMode={kind === "decimal" ? "decimal" : setting.key === SETTING_FROM_QUARTER ? "text" : "numeric"}
                autoComplete="off"
                value={raw}
                disabled={clear || busy}
                {...a11y("value")}
                onChange={(e) => setRaw(e.target.value)}
              />
            </>
          )}
          {setting.nullable && kind !== "bool" ? (
            <label className="flex items-start gap-2 text-sm mt-2">
              <input
                type="checkbox"
                checked={clear}
                disabled={busy}
                onChange={(e) => setClear(e.target.checked)}
              />
              <span>
                {t("admin.settings.clearValue")}
                <span className="block text-xs text-mq-text-muted">
                  {texts.nullMeaning}
                </span>
              </span>
            </label>
          ) : null}
          <label htmlFor={reasonId} className="mq-admin-modal-label mt-3">
            {t("admin.common.reason")}
          </label>
          <textarea
            id={reasonId}
            className="mq-input mq-admin-modal-textarea"
            rows={3}
            maxLength={REASON_MAX}
            value={reason}
            disabled={busy}
            {...a11y("reason")}
            placeholder={`3–${REASON_MAX}`}
            onChange={(e) => setReason(e.target.value.slice(0, REASON_MAX))}
          />
          <div className="mq-admin-modal-meta">
            <span>
              {reason.length}/{REASON_MAX}
            </span>
          </div>
          {errors.length > 0 ? (
            <ul id={errId} className="mq-admin-modal-error" role="alert">
              {errors.map((e) => (
                <li key={`${e.field}-${e.code}`}>
                  {t(errorKey(e), { min: String(setting.min), max: String(setting.max) })}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mq-admin-modal-actions">
            <button type="button" className="mq-btn mq-btn-outline" disabled={busy} onClick={onClose}>
              {t("admin.common.cancel")}
            </button>
            <button type="submit" className="mq-btn mq-btn-primary" disabled={busy}>
              {busy ? t("admin.common.working") : t("admin.settings.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
