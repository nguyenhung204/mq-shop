"use client";

import { FormEvent, useEffect, useId, useState } from "react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { centsToDecimalString } from "@/lib/money";
import { validateRefundAmount } from "@/lib/rma/refund-amount";

type Props = {
  open: boolean;
  /** Only platform staff (ADMIN / SUPER_ADMIN) may type an amount; everyone else gets no field. */
  canPartial: boolean;
  /** Order total in integer cents (TWD); null while loading / unknown. */
  orderTotalCents: number | null;
  /** Remaining refundable cents learnt from a server rejection; overrides the order total as the cap. */
  remainingCents?: number | null;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (refundAmount: string | undefined) => void | Promise<void>;
};

export function RmaApproveModal(props: Props) {
  if (!props.open) return null;
  return <RmaApproveForm {...props} />;
}

function RmaApproveForm({ canPartial, orderTotalCents, remainingCents = null, busy = false, onClose, onConfirm }: Props) {
  const { t } = useLanguage();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  const amountId = useId();
  const cap = remainingCents ?? orderTotalCents;
  const live = canPartial ? validateRefundAmount(amount, cap) : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const res = canPartial ? validateRefundAmount(amount, cap) : ({ ok: true, refundAmount: undefined } as const);
    if (!res.ok) {
      setError(`admin.rmaPage.approveModal.errors.${res.error}`);
      return;
    }
    setError(null);
    await onConfirm(res.refundAmount);
  };

  const isPartial = Boolean(live && live.ok && live.partial && live.refundAmount !== undefined);

  return (
    <div className="mq-admin-modal-root" role="presentation">
      <button type="button" className="mq-admin-modal-backdrop" aria-label={t("admin.common.close")} disabled={busy} onClick={onClose} />
      <div className="mq-admin-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="mq-admin-modal-head" style={{ flexDirection: "column", alignItems: "flex-start" }}>
          <h2 id={titleId} className="mq-admin-modal-title">
            {t("admin.rmaPage.approveModal.title")}
          </h2>
          <p className="mq-admin-modal-desc">{t("admin.rmaPage.approveModal.desc")}</p>
        </header>
        <form className="mq-admin-modal-body" onSubmit={(e) => void submit(e)} noValidate>
          {canPartial ? (
            <>
              <label htmlFor={amountId} className="mq-admin-modal-label">
                {t("admin.rmaPage.approveModal.amountLabel")}
              </label>
              <input
                id={amountId}
                className="mq-input"
                inputMode="decimal"
                autoComplete="off"
                value={amount}
                disabled={busy}
                placeholder={cap !== null ? centsToDecimalString(cap) : undefined}
                onChange={(e) => setAmount(e.target.value)}
              />
              <p className="text-[11px] text-mq-text-muted mt-1">
                {cap !== null
                  ? t(remainingCents !== null ? "admin.rmaPage.approveModal.remainingHint" : "admin.rmaPage.approveModal.totalHint", {
                      amount: centsToDecimalString(cap),
                    })
                  : t("admin.rmaPage.approveModal.loadingTotal")}
              </p>
              <p className="text-xs mt-2" role="status">
                {isPartial
                  ? t("admin.rmaPage.approveModal.partialNote", { amount: live && live.ok ? (live.refundAmount ?? "") : "" })
                  : t("admin.rmaPage.approveModal.fullNote")}
              </p>
            </>
          ) : (
            <p className="text-xs">{t("admin.rmaPage.approveModal.fullNote")}</p>
          )}
          {error ? (
            <p className="mq-admin-modal-error" role="alert">
              {t(error)}
            </p>
          ) : null}
          <div className="mq-admin-modal-actions">
            <button type="button" className="mq-btn mq-btn-outline" disabled={busy} onClick={onClose}>
              {t("admin.common.cancel")}
            </button>
            <button type="submit" className="mq-btn mq-btn-primary" disabled={busy}>
              {busy ? t("admin.common.working") : isPartial ? t("admin.rmaPage.approveModal.confirmPartial") : t("admin.rmaPage.approveModal.confirmFull")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
