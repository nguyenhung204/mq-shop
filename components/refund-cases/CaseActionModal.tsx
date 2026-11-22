"use client";

import { FormEvent, useEffect, useId, useRef, useState } from "react";
import { useDialogFocus } from "@/components/ui/useDialogFocus";
import { useLanguage } from "@/components/providers/LanguageProvider";
import type { RefundCaseStatus } from "@/lib/api/refund-cases";
import { NOTE_MAX, REFERENCE_MAX, overrideTargets, type CaseFormError } from "@/lib/refund-cases/model";
import { buildCaseSubmit, type CaseFormKind, type CaseSubmit } from "@/lib/refund-cases/submit";

type Props = {
  open: boolean;
  kind: CaseFormKind;
  caseId: string;
  currentStatus: RefundCaseStatus;
  /** Source of the case: an RMA-linked case is changed through the return request. */
  source?: "CANCEL" | "RMA";
  busy?: boolean;
  onClose: () => void;
  /** Gets the validated variables; resolves true when the action was accepted (the parent then closes). */
  onSubmit: (submit: Extract<CaseSubmit, { ok: true }>) => void | Promise<void>;
};

export function CaseActionModal(props: Props) {
  if (!props.open) return null;
  return <CaseActionForm key={`${props.caseId}-${props.kind}`} {...props} />;
}

function CaseActionForm({ kind, caseId, currentStatus, source, busy = false, onClose, onSubmit }: Props) {
  const { t } = useLanguage();
  const [note, setNote] = useState("");
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [toStatus, setToStatus] = useState("");
  const [errors, setErrors] = useState<CaseFormError[]>([]);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef);
  const titleId = useId();
  const errId = useId();
  const noteId = useId();
  const refId = useId();
  const reasonId = useId();
  const statusId = useId();
  const textField = kind === "override" ? "reason" : "note";
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
    const res = buildCaseSubmit(kind, caseId, { note, reference, reason, toStatus }, currentStatus);
    if (!res.ok) {
      setErrors(res.errors);
      return;
    }
    setErrors([]);
    await onSubmit(res);
  };

  const requiredText = kind === "dispute" || kind === "override";
  const textValue = textField === "reason" ? reason : note;
  const setText = (v: string) => (textField === "reason" ? setReason(v.slice(0, NOTE_MAX)) : setNote(v.slice(0, NOTE_MAX)));

  return (
    <div className="mq-admin-modal-root" role="presentation">
      <button type="button" className="mq-admin-modal-backdrop" aria-label={t("admin.common.close")} disabled={busy} onClick={onClose} />
      <div ref={dialogRef} className="mq-admin-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="mq-admin-modal-head" style={{ flexDirection: "column", alignItems: "flex-start" }}>
          <h2 id={titleId} className="mq-admin-modal-title">
            {t(`refundCases.modal.${kind}.title`)}
          </h2>
          <p className="mq-admin-modal-desc">{t(`refundCases.modal.${kind}.desc`)}</p>
        </header>
        <form className="mq-admin-modal-body" onSubmit={(e) => void submit(e)} noValidate>
          {kind === "override" ? (
            <>
              <label htmlFor={statusId} className="mq-admin-modal-label">
                {t("refundCases.modal.override.toStatus")}
              </label>
              <select
                id={statusId}
                className="mq-input"
                value={toStatus}
                disabled={busy}
                {...a11y("toStatus")}
                onChange={(e) => setToStatus(e.target.value)}
              >
                <option value="">{t("refundCases.modal.override.pick")}</option>
                {overrideTargets(currentStatus).map((s) => (
                  <option key={s} value={s}>
                    {t(`refundCases.status.${s}`)}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-mq-text-muted mt-1">{t("refundCases.modal.override.internalNote")}</p>
              {source === "RMA" ? <p className="text-[11px] text-mq-text-muted mt-1">{t("refundCases.modal.override.rmaNote")}</p> : null}
            </>
          ) : null}
          {kind === "markPaid" ? (
            <>
              <label htmlFor={refId} className="mq-admin-modal-label">
                {t("refundCases.modal.markPaid.reference")}
              </label>
              <input
                id={refId}
                className="mq-input"
                autoComplete="off"
                maxLength={REFERENCE_MAX}
                value={reference}
                disabled={busy}
                {...a11y("reference")}
                onChange={(e) => setReference(e.target.value.slice(0, REFERENCE_MAX))}
              />
            </>
          ) : null}
          <label htmlFor={textField === "reason" ? reasonId : noteId} className="mq-admin-modal-label mt-3">
            {textField === "reason"
              ? t("admin.common.reason")
              : requiredText
                ? t("refundCases.modal.noteRequired")
                : t("refundCases.modal.noteOptional")}
          </label>
          <textarea
            id={textField === "reason" ? reasonId : noteId}
            className="mq-input mq-admin-modal-textarea"
            rows={3}
            maxLength={NOTE_MAX}
            value={textValue}
            disabled={busy}
            {...a11y(textField)}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="mq-admin-modal-meta">
            <span>
              {textValue.length}/{NOTE_MAX}
            </span>
          </div>
          {errors.length > 0 ? (
            <ul id={errId} className="mq-admin-modal-error" role="alert">
              {errors.map((e) => (
                <li key={`${e.field}-${e.code}`}>{t(`refundCases.modal.errors.${e.field === "reason" ? "note" : e.field}.${e.code}`)}</li>
              ))}
            </ul>
          ) : null}
          <div className="mq-admin-modal-actions">
            <button type="button" className="mq-btn mq-btn-outline" disabled={busy} onClick={onClose}>
              {t("admin.common.cancel")}
            </button>
            <button type="submit" className="mq-btn mq-btn-primary" disabled={busy}>
              {busy ? t("admin.common.working") : t(`refundCases.modal.${kind}.confirm`)}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
