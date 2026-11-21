"use client";

import { FormEvent, useId, useState } from "react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { REASON_MAX } from "@/lib/admin/reason";
import type { PaidAtHistoryRow } from "@/lib/api/orders";
import { formatDateTimeGmt8, isoToGmt8DateTimeLocal } from "@/lib/i18n/gmt8-calendar";
import { toIntlLocale } from "@/lib/i18n/locale-format";
import { validatePaidAtEdit, type PaidAtError } from "@/lib/orders/paid-at";

export type PaidAtPanelViewProps = {
  paidAt: string;
  createdAt: string;
  /** SUPER_ADMIN: shows the edit form. */
  canEdit: boolean;
  /** Rows of the history (ADMIN and SUPER_ADMIN); null = not loaded / not allowed. */
  history: PaidAtHistoryRow[] | null;
  historyState?: "loading" | "error" | "ready";
  busy?: boolean;
  /** Clock seam for tests. */
  now?: () => number;
  /** Resolves true when the edit was saved (the form then resets its reason). */
  onSubmit: (body: { paidAt: string; reason: string }) => Promise<boolean> | boolean;
};

export function PaidAtPanelView(props: PaidAtPanelViewProps) {
  const { t, locale } = useLanguage();
  const intl = toIntlLocale(locale);
  const [local, setLocal] = useState(isoToGmt8DateTimeLocal(props.paidAt));
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<PaidAtError[]>([]);
  const dateId = useId();
  const reasonId = useId();
  const errId = useId();
  const bad = (f: string) => errors.some((e) => e.field === f);
  const a11y = (f: string) => ({ "aria-invalid": bad(f) || undefined, "aria-describedby": bad(f) ? errId : undefined }) as const;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const now = props.now ?? Date.now;
    const res = validatePaidAtEdit({ local, reason }, { nowMs: now(), createdAt: props.createdAt, currentPaidAt: props.paidAt });
    if (!res.ok) {
      setErrors(res.errors);
      return;
    }
    setErrors([]);
    if (await props.onSubmit(res.body)) setReason("");
  };

  return (
    <section className="mq-card p-4 space-y-3 text-sm" aria-label={t("orders.paidAt.title")}>
      <h3 className="font-semibold">{t("orders.paidAt.title")}</h3>
      <p className="text-xs text-mq-text-muted">
        {t("orders.paidAt.current", { date: formatDateTimeGmt8(props.paidAt, intl) })}
      </p>
      {props.canEdit ? (
        <form className="space-y-2" onSubmit={(e) => void submit(e)} noValidate>
          <p className="text-xs text-mq-text-muted">{t("orders.paidAt.help")}</p>
          <label htmlFor={dateId} className="block text-xs font-medium">
            {t("orders.paidAt.newDate")}
          </label>
          <input
            id={dateId}
            type="datetime-local"
            className="mq-input max-w-xs"
            value={local}
            disabled={props.busy}
            {...a11y("paidAt")}
            onChange={(e) => setLocal(e.target.value)}
          />
          <label htmlFor={reasonId} className="block text-xs font-medium">
            {t("admin.common.reason")}
          </label>
          <textarea
            id={reasonId}
            className="mq-input"
            rows={2}
            maxLength={REASON_MAX}
            value={reason}
            disabled={props.busy}
            {...a11y("reason")}
            onChange={(e) => setReason(e.target.value.slice(0, REASON_MAX))}
          />
          {errors.length > 0 ? (
            <ul id={errId} className="mq-admin-modal-error" role="alert">
              {errors.map((e) => (
                <li key={`${e.field}-${e.code}`}>
                  {t(e.field === "paidAt" ? `orders.paidAt.errors.${e.code}` : `admin.common.reasonErrors.${e.code}`)}
                </li>
              ))}
            </ul>
          ) : null}
          <button type="submit" className="mq-btn mq-btn-primary text-xs" disabled={props.busy}>
            {props.busy ? t("admin.common.working") : t("orders.paidAt.save")}
          </button>
        </form>
      ) : null}
      {props.history !== null ? (
        <div>
          <h4 className="text-xs font-semibold mb-1">{t("orders.paidAt.historyTitle")}</h4>
          {props.historyState === "loading" ? (
            <p className="text-xs text-mq-text-muted">{t("admin.common.loading")}</p>
          ) : props.historyState === "error" ? (
            <p className="text-xs text-mq-text-muted">{t("admin.common.failed")}</p>
          ) : props.history.length === 0 ? (
            <p className="text-xs text-mq-text-muted">{t("orders.paidAt.historyEmpty")}</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {props.history.map((h) => (
                <li key={h.id} className="border-t border-mq-border pt-1">
                  <span className="whitespace-nowrap">{formatDateTimeGmt8(h.changedAt, intl)}</span>
                  {": "}
                  <span className="whitespace-nowrap">
                    {formatDateTimeGmt8(h.oldPaidAt, intl)} → {formatDateTimeGmt8(h.newPaidAt, intl)}
                  </span>
                  <span className="block text-mq-text-muted">
                    {t("orders.paidAt.by", { user: h.changedBy.slice(0, 8) })} · {h.reason}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
