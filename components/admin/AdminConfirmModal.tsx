"use client";

import { useEffect, useId } from "react";
import { useLanguage } from "@/components/providers/LanguageProvider";

type AdminConfirmModalProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  tone?: "danger" | "warn" | "primary";
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
};

export function AdminConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  tone = "primary",
  busy = false,
  onClose,
  onConfirm,
}: AdminConfirmModalProps) {
  const { t } = useLanguage();
  const titleId = useId();

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
              {t("admin.common.cancel")}
            </button>
            <button
              type="button"
              className={confirmClass}
              disabled={busy}
              onClick={() => void onConfirm()}
            >
              {busy ? t("admin.common.working") : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
