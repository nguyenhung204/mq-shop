"use client";

import { useEffect, useId } from "react";
import { useLanguage } from "@/components/providers/LanguageProvider";

export type ConfirmDialogTone = "danger" | "warn" | "primary";

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: ConfirmDialogTone;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = "primary",
  busy = false,
  onClose,
  onConfirm,
}: ConfirmDialogProps) {
  const { t } = useLanguage();
  const titleId = useId();
  const dismissLabel = cancelLabel ?? t("confirm.dismiss");

  /**
   * Callers usually `await mutateAsync(...)` here. Swallow the rejection so a
   * failed action does not become an `unhandledRejection` — the mutation's own
   * `onError` (or the global mutation cache handler) already toasts it.
   */
  const runConfirm = () => {
    void Promise.resolve()
      .then(onConfirm)
      .catch(() => {});
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  const confirmClass =
    tone === "danger"
      ? "mq-admin-btn mq-admin-btn-danger"
      : tone === "warn"
        ? "mq-admin-btn mq-admin-btn-warn"
        : "mq-btn mq-btn-primary";

  return (
    <div className="mq-admin-modal-root" role="presentation">
      <button
        type="button"
        className="mq-admin-modal-backdrop"
        aria-label={t("admin.common.close")}
        disabled={busy}
        onClick={onClose}
      />
      <div
        className="mq-admin-modal"
        role="alertdialog"
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
        <div className="mq-admin-modal-body">
          <div className="mq-admin-modal-actions">
            <button
              type="button"
              className="mq-btn mq-btn-outline"
              disabled={busy}
              onClick={onClose}
            >
              {dismissLabel}
            </button>
            <button
              type="button"
              className={confirmClass}
              disabled={busy}
              onClick={runConfirm}
            >
              {busy ? t("confirm.working") : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
