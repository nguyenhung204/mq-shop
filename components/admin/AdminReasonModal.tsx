"use client";

import { FormEvent, useEffect, useId, useState } from "react";

type AdminReasonModalProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  /** Reject requires min 1 char; violation may allow empty. */
  required?: boolean;
  /** Max reason length (shop reject 150, product reject 500). */
  maxLength?: number;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
};

export function AdminReasonModal({
  open,
  title,
  description,
  confirmLabel,
  required = true,
  maxLength = 150,
  busy = false,
  onClose,
  onConfirm,
}: AdminReasonModalProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const titleId = useId();
  const inputId = useId();

  useEffect(() => {
    if (!open) return;
    setReason("");
    setError("");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  const trimmed = reason.trim();
  const canSubmit = required
    ? trimmed.length >= 1 && trimmed.length <= maxLength
    : trimmed.length <= maxLength;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (required && trimmed.length < 1) {
      setError(`Reason is required (1–${maxLength} characters).`);
      return;
    }
    if (trimmed.length > maxLength) {
      setError(`Reason must be at most ${maxLength} characters.`);
      return;
    }
    setError("");
    await onConfirm(trimmed);
  };

  return (
    <div className="mq-admin-modal-root" role="presentation">
      <button
        type="button"
        className="mq-admin-modal-backdrop"
        aria-label="Close"
        disabled={busy}
        onClick={onClose}
      />
      <div
        className="mq-admin-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header
          className="mq-admin-modal-head"
          style={{ flexDirection: "column", alignItems: "flex-start" }}
        >
          <h2 id={titleId} className="mq-admin-modal-title">
            {title}
          </h2>
          {description ? <p className="mq-admin-modal-desc">{description}</p> : null}
        </header>
        <form className="mq-admin-modal-body" onSubmit={(e) => void submit(e)}>
          <label htmlFor={inputId} className="mq-admin-modal-label">
            Reason {required ? "" : "(optional)"}
          </label>
          <textarea
            id={inputId}
            className="mq-input mq-admin-modal-textarea"
            rows={4}
            maxLength={maxLength}
            value={reason}
            autoFocus
            placeholder={`1–${maxLength} characters`}
            onChange={(e) => setReason(e.target.value.slice(0, maxLength))}
          />
          <div className="mq-admin-modal-meta">
            <span>
              {reason.length}/{maxLength}
            </span>
            {error ? <span className="mq-admin-modal-error">{error}</span> : null}
          </div>
          <div className="mq-admin-modal-actions">
            <button
              type="button"
              className="mq-btn mq-btn-outline"
              disabled={busy}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="mq-btn mq-btn-primary"
              disabled={busy || !canSubmit}
            >
              {busy ? "Working…" : confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
