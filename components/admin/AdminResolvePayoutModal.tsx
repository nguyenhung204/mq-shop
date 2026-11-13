"use client";

import { FormEvent, useEffect, useId, useState } from "react";
import type { PayoutRequestStatus } from "@/lib/api/wallet";
import { useLanguage } from "@/components/providers/LanguageProvider";
import {
  RESOLVE_GATEWAY_REF_MAX,
  RESOLVE_NOTE_MAX,
  validateResolveForm,
  type ResolveOutcome,
} from "@/lib/wallet/payout-resolve";

type Props = {
  open: boolean;
  status: PayoutRequestStatus;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (body: {
    outcome: ResolveOutcome;
    gatewayRef?: string;
    note: string;
  }) => void | Promise<void>;
};

/**
 * Confirm dialog for manually resolving a PROCESSING / PAID_UNRECONCILED wallet payout.
 * Mount it only while open so the form state resets on each use.
 */
export function AdminResolvePayoutModal({ open, status, busy = false, onClose, onConfirm }: Props) {
  const { t } = useLanguage();
  const [outcome, setOutcome] = useState<ResolveOutcome>("COMPLETED");
  const [gatewayRef, setGatewayRef] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
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

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const err = validateResolveForm({ status, outcome, gatewayRef, note });
    if (err) {
      setError(t(`admin.walletPayouts.resolveErrors.${err}`));
      return;
    }
    setError("");
    const ref = gatewayRef.trim();
    await onConfirm({ outcome, ...(ref ? { gatewayRef: ref } : {}), note: note.trim() });
  };

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
        <header
          className="mq-admin-modal-head"
          style={{ flexDirection: "column", alignItems: "flex-start" }}
        >
          <h2 id={titleId} className="mq-admin-modal-title">
            {t("admin.walletPayouts.resolveTitle")}
          </h2>
          <p className="mq-admin-modal-desc">{t("admin.walletPayouts.resolveDesc")}</p>
        </header>
        <form className="mq-admin-modal-body" onSubmit={(e) => void submit(e)}>
          <fieldset className="space-y-2 text-sm">
            {(["COMPLETED", "FAILED"] as const).map((o) => (
              <label key={o} className="flex items-start gap-2">
                <input
                  type="radio"
                  name="resolve-outcome"
                  className="mt-1"
                  checked={outcome === o}
                  disabled={busy}
                  onChange={() => setOutcome(o)}
                />
                <span>
                  <strong>{t(`admin.walletPayouts.outcome.${o}`)}</strong>
                  <br />
                  <span className="text-mq-text-muted">
                    {t(`admin.walletPayouts.outcomeConsequence.${o}`)}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>

          <label className="mq-admin-modal-label">
            {outcome === "COMPLETED" && status === "PROCESSING"
              ? t("admin.walletPayouts.gatewayRefRequiredLabel")
              : t("admin.walletPayouts.gatewayRefOptionalLabel")}
          </label>
          <input
            className="mq-input"
            value={gatewayRef}
            maxLength={RESOLVE_GATEWAY_REF_MAX}
            disabled={busy}
            onChange={(e) => setGatewayRef(e.target.value)}
          />

          <label className="mq-admin-modal-label">{t("admin.walletPayouts.resolveNote")}</label>
          <textarea
            className="mq-input mq-admin-modal-textarea"
            rows={3}
            maxLength={RESOLVE_NOTE_MAX}
            value={note}
            disabled={busy}
            placeholder={`3–${RESOLVE_NOTE_MAX}`}
            onChange={(e) => setNote(e.target.value.slice(0, RESOLVE_NOTE_MAX))}
          />
          <div className="mq-admin-modal-meta">
            <span>
              {note.length}/{RESOLVE_NOTE_MAX}
            </span>
            {error ? <span className="mq-admin-modal-error">{error}</span> : null}
          </div>
          <div className="mq-admin-modal-actions">
            <button type="button" className="mq-btn mq-btn-outline" disabled={busy} onClick={onClose}>
              {t("admin.common.cancel")}
            </button>
            <button type="submit" className="mq-btn mq-btn-primary" disabled={busy}>
              {busy ? t("admin.common.working") : t("admin.walletPayouts.resolveConfirm")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
