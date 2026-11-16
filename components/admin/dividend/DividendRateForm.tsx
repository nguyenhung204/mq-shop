"use client";

import { FormEvent, useId, useState } from "react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { REASON_MAX } from "@/lib/admin/reason";
import type { CreateDividendRateBody } from "@/lib/api/dividend";
import { todayGmt8 } from "@/lib/dividend/dates";
import { validateRateForm, type RateFormError } from "@/lib/dividend/rate-form";

type Props = {
  busy?: boolean;
  /** Server "today" (Asia/Taipei) when known; otherwise computed from the clock. */
  today?: string;
  /** Resolve true on success: the form clears only then, so a rejected write keeps what was typed. */
  onSubmit: (body: CreateDividendRateBody) => void | boolean | Promise<void | boolean>;
};

function errorKey(e: RateFormError): string {
  return e.field === "reason"
    ? `admin.common.reasonErrors.${e.code}`
    : `admin.dividend.rates.errors.${e.field}.${e.code}`;
}

export function DividendRateForm({ busy = false, today, onSubmit }: Props) {
  const { t } = useLanguage();
  const [ratePercent, setRatePercent] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<RateFormError[]>([]);
  const rateId = useId();
  const dateId = useId();
  const reasonId = useId();
  const minDate = today ?? todayGmt8();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const res = validateRateForm({ ratePercent, effectiveDate, reason });
    if (!res.ok) {
      setErrors(res.errors);
      return;
    }
    setErrors([]);
    if ((await onSubmit(res.body)) === false) return;
    setRatePercent("");
    setEffectiveDate("");
    setReason("");
  };

  return (
    <form
      className="rounded-lg border border-mq-border bg-mq-surface p-4 space-y-3"
      onSubmit={(e) => void submit(e)}
      noValidate
    >
      <h2 className="text-sm font-semibold">{t("admin.dividend.rates.formTitle")}</h2>
      <p className="text-xs text-mq-text-muted">{t("admin.dividend.rates.formNote")}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={rateId} className="mq-admin-modal-label">
            {t("admin.dividend.rates.ratePercent")}
          </label>
          <input
            id={rateId}
            className="mq-input"
            inputMode="decimal"
            autoComplete="off"
            value={ratePercent}
            disabled={busy}
            onChange={(e) => setRatePercent(e.target.value)}
          />
          <p className="text-[11px] text-mq-text-muted mt-1">{t("admin.dividend.rates.ratePercentHint")}</p>
        </div>
        <div>
          <label htmlFor={dateId} className="mq-admin-modal-label">
            {t("admin.dividend.rates.effectiveDate")}
          </label>
          <input
            id={dateId}
            type="date"
            className="mq-input"
            min={minDate}
            value={effectiveDate}
            disabled={busy}
            onChange={(e) => setEffectiveDate(e.target.value)}
          />
        </div>
      </div>
      <div>
        <label htmlFor={reasonId} className="mq-admin-modal-label">
          {t("admin.common.reason")}
        </label>
        <textarea
          id={reasonId}
          className="mq-input mq-admin-modal-textarea"
          rows={2}
          maxLength={REASON_MAX}
          value={reason}
          disabled={busy}
          placeholder={`3–${REASON_MAX}`}
          onChange={(e) => setReason(e.target.value.slice(0, REASON_MAX))}
        />
      </div>
      {errors.length > 0 ? (
        <ul className="mq-admin-modal-error" role="alert">
          {errors.map((e) => (
            <li key={`${e.field}-${e.code}`}>{t(errorKey(e))}</li>
          ))}
        </ul>
      ) : null}
      <div>
        <button type="submit" className="mq-btn mq-btn-primary" disabled={busy}>
          {busy ? t("admin.common.working") : t("admin.dividend.rates.submit")}
        </button>
      </div>
    </form>
  );
}
