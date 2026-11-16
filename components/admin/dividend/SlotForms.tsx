"use client";

import { FormEvent, useId, useState } from "react";
import { AccountPicker } from "@/components/admin/dividend/AccountPicker";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { REASON_MAX } from "@/lib/admin/reason";
import type { SetSlotsBody, SlotHolding, TransferSlotsBody } from "@/lib/api/dividend";
import {
  validateSetSlots,
  validateTransfer,
  type SlotsContext,
  type SlotsFormError,
} from "@/lib/dividend/slots-form";

type CommonProps = {
  quarter: string;
  /** UI3: a locked quarter is read-only. */
  locked: boolean;
  holdings: SlotHolding[];
  busy?: boolean;
};

function errorKey(e: SlotsFormError): string {
  return e.field === "reason"
    ? `admin.common.reasonErrors.${e.code}`
    : `admin.dividend.slots.errors.${e.field}.${e.code}`;
}

function ErrorList({ errors }: { errors: SlotsFormError[] }) {
  const { t } = useLanguage();
  if (errors.length === 0) return null;
  return (
    <ul className="mq-admin-modal-error" role="alert">
      {errors.map((e) => (
        <li key={`${e.field}-${e.code}`}>{t(errorKey(e))}</li>
      ))}
    </ul>
  );
}

function LockedNote({ quarter }: { quarter: string }) {
  const { t } = useLanguage();
  return (
    <p className="mq-alert mq-alert-warn text-sm" role="status">
      {t("admin.dividend.slots.lockedNote", { quarter })}
    </p>
  );
}

export function SetSlotsForm({
  quarter,
  locked,
  holdings,
  busy = false,
  initialUserId = "",
  onSubmit,
}: CommonProps & {
  initialUserId?: string;
  /** Resolve false when the write failed: the form then keeps what was typed. */
  onSubmit: (body: SetSlotsBody) => void | boolean | Promise<void | boolean>;
}) {
  const { t } = useLanguage();
  const [userId, setUserId] = useState(initialUserId);
  const [slots, setSlots] = useState("");
  const [expiresAtLocal, setExpiresAtLocal] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<SlotsFormError[]>([]);
  const slotsId = useId();
  const expId = useId();
  const reasonId = useId();
  const ctx: SlotsContext = { quarter, locked, holdings };
  const held = holdings.find((h) => h.userId === userId);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const res = validateSetSlots({ userId, slots, expiresAtLocal, reason }, ctx);
    if (!res.ok) {
      setErrors(res.errors);
      return;
    }
    setErrors([]);
    if ((await onSubmit(res.body)) === false) return;
    setSlots("");
    setExpiresAtLocal("");
    setReason("");
  };

  return (
    <form className="rounded-lg border border-mq-border bg-mq-surface p-4 space-y-3" onSubmit={(e) => void submit(e)} noValidate>
      <h2 className="text-sm font-semibold">{t("admin.dividend.slots.setTitle", { quarter })}</h2>
      <p className="text-xs text-mq-text-muted">{t("admin.dividend.slots.setNote")}</p>
      {locked ? <LockedNote quarter={quarter} /> : null}
      <div>
        <span className="mq-admin-modal-label">{t("admin.dividend.slots.account")}</span>
        <AccountPicker
          value={userId}
          onChange={setUserId}
          ariaLabel={t("admin.dividend.slots.account")}
          placeholder={t("admin.dividend.slots.accountPh")}
          disabled={locked || busy}
          known={holdings}
        />
        {userId ? (
          <p className="text-[11px] text-mq-text-muted mt-1">
            {t("admin.dividend.slots.currentSlots", { slots: String(held?.slots ?? 0) })}
          </p>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={slotsId} className="mq-admin-modal-label">
            {t("admin.dividend.slots.slotsAbsolute")}
          </label>
          <input id={slotsId} className="mq-input" inputMode="numeric" autoComplete="off" value={slots} disabled={locked || busy} onChange={(e) => setSlots(e.target.value)} />
          <p className="text-[11px] text-mq-text-muted mt-1">{t("admin.dividend.slots.slotsAbsoluteHint")}</p>
        </div>
        <div>
          <label htmlFor={expId} className="mq-admin-modal-label">
            {t("admin.dividend.slots.expiresAt")}
          </label>
          <input id={expId} type="datetime-local" className="mq-input" value={expiresAtLocal} disabled={locked || busy} onChange={(e) => setExpiresAtLocal(e.target.value)} />
          <p className="text-[11px] text-mq-text-muted mt-1">{t("admin.dividend.slots.expiresAtHint")}</p>
        </div>
      </div>
      <div>
        <label htmlFor={reasonId} className="mq-admin-modal-label">
          {t("admin.common.reason")}
        </label>
        <textarea id={reasonId} className="mq-input mq-admin-modal-textarea" rows={2} maxLength={REASON_MAX} value={reason} disabled={locked || busy} placeholder={`3–${REASON_MAX}`} onChange={(e) => setReason(e.target.value.slice(0, REASON_MAX))} />
      </div>
      <ErrorList errors={errors} />
      <button type="submit" className="mq-btn mq-btn-primary" disabled={locked || busy}>
        {busy ? t("admin.common.working") : t("admin.dividend.slots.setSubmit")}
      </button>
    </form>
  );
}

export function TransferSlotsForm({
  quarter,
  locked,
  holdings,
  busy = false,
  onSubmit,
}: CommonProps & {
  /** Resolve false when the write failed: the form then keeps what was typed. */
  onSubmit: (body: TransferSlotsBody) => void | boolean | Promise<void | boolean>;
}) {
  const { t } = useLanguage();
  const [fromUserId, setFrom] = useState("");
  const [toUserId, setTo] = useState("");
  const [slots, setSlots] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<SlotsFormError[]>([]);
  const slotsId = useId();
  const reasonId = useId();
  const ctx: SlotsContext = { quarter, locked, holdings };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const res = validateTransfer({ fromUserId, toUserId, slots, reason }, ctx);
    if (!res.ok) {
      setErrors(res.errors);
      return;
    }
    setErrors([]);
    if ((await onSubmit(res.body)) === false) return;
    setSlots("");
    setReason("");
  };

  return (
    <form className="rounded-lg border border-mq-border bg-mq-surface p-4 space-y-3" onSubmit={(e) => void submit(e)} noValidate>
      <h2 className="text-sm font-semibold">{t("admin.dividend.slots.transferTitle", { quarter })}</h2>
      <p className="text-xs text-mq-text-muted">{t("admin.dividend.slots.transferNote")}</p>
      {locked ? <LockedNote quarter={quarter} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <span className="mq-admin-modal-label">{t("admin.dividend.slots.from")}</span>
          <AccountPicker value={fromUserId} onChange={setFrom} ariaLabel={t("admin.dividend.slots.from")} placeholder={t("admin.dividend.slots.accountPh")} disabled={locked || busy} known={holdings} />
        </div>
        <div>
          <span className="mq-admin-modal-label">{t("admin.dividend.slots.to")}</span>
          <AccountPicker value={toUserId} onChange={setTo} ariaLabel={t("admin.dividend.slots.to")} placeholder={t("admin.dividend.slots.accountPh")} disabled={locked || busy} known={holdings} />
        </div>
      </div>
      <div>
        <label htmlFor={slotsId} className="mq-admin-modal-label">
          {t("admin.dividend.slots.transferSlots")}
        </label>
        <input id={slotsId} className="mq-input" inputMode="numeric" autoComplete="off" value={slots} disabled={locked || busy} onChange={(e) => setSlots(e.target.value)} />
      </div>
      <div>
        <label htmlFor={reasonId} className="mq-admin-modal-label">
          {t("admin.common.reason")}
        </label>
        <textarea id={reasonId} className="mq-input mq-admin-modal-textarea" rows={2} maxLength={REASON_MAX} value={reason} disabled={locked || busy} placeholder={`3–${REASON_MAX}`} onChange={(e) => setReason(e.target.value.slice(0, REASON_MAX))} />
      </div>
      <ErrorList errors={errors} />
      <button type="submit" className="mq-btn mq-btn-primary" disabled={locked || busy}>
        {busy ? t("admin.common.working") : t("admin.dividend.slots.transferSubmit")}
      </button>
    </form>
  );
}
