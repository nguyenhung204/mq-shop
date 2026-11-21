"use client";

import { FormEvent, useId, useState } from "react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import type { InviteItem, SubAccountItem } from "@/lib/api/sub-accounts";
import { formatDateTimeGmt8 } from "@/lib/i18n/gmt8-calendar";
import { toIntlLocale } from "@/lib/i18n/locale-format";
import { BUSINESS_REGION_CODES } from "@/lib/i18n/regions";
import { translateStatus } from "@/lib/i18n/status";
import { REASON_MAX } from "@/lib/admin/reason";
import {
  EMAIL_MAX,
  NAME_MAX,
  PENDING_DAYS,
  buildInviteLink,
  canRevoke,
  inviteReveal,
  isPendingAccount,
  validateCreate,
  type CreateBody,
  type CreateFormError,
} from "@/lib/sub-accounts/model";

/** Create form shared by the owner (`admin` false) and staff on behalf of an account (`admin` true, reason required). */
export function CreateSubAccountForm({
  admin,
  busy = false,
  atCap = false,
  onSubmit,
}: {
  admin: boolean;
  busy?: boolean;
  /** Owner already holds the maximum: creation is blocked here (the API would answer 409 SUB_ACCOUNT_LIMIT). */
  atCap?: boolean;
  /** Resolves true when it was accepted (the form is then cleared). */
  onSubmit: (body: CreateBody & { reason?: string }) => Promise<boolean> | boolean;
}) {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [regionCode, setRegionCode] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<CreateFormError[]>([]);
  const ids = { email: useId(), name: useId(), region: useId(), reason: useId(), err: useId() };
  const bad = (f: string) => errors.some((e) => e.field === f);
  const a11y = (f: string) => ({ "aria-invalid": bad(f) || undefined, "aria-describedby": bad(f) ? ids.err : undefined }) as const;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const res = validateCreate({ email, fullName, regionCode, reason }, admin);
    if (!res.ok) {
      setErrors(res.errors);
      return;
    }
    setErrors([]);
    if (await onSubmit(res.body)) {
      setEmail("");
      setFullName("");
      setRegionCode("");
      setReason("");
    }
  };

  return (
    <form className="mq-card p-4 space-y-3 text-sm" onSubmit={(e) => void submit(e)} noValidate aria-label={t("subAccounts.create.title")}>
      <h2 className="font-semibold">{t("subAccounts.create.title")}</h2>
      <p className="text-xs text-mq-text-muted">{t(admin ? "subAccounts.create.adminExplain" : "subAccounts.create.ownerExplain")}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1" htmlFor={ids.email}>
          <span className="text-xs text-mq-text-muted">{t("subAccounts.create.email")}</span>
          <input id={ids.email} type="email" className="mq-input" maxLength={EMAIL_MAX} autoComplete="off" value={email} disabled={busy} {...a11y("email")} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="space-y-1" htmlFor={ids.name}>
          <span className="text-xs text-mq-text-muted">{t("subAccounts.create.fullName")}</span>
          <input id={ids.name} className="mq-input" maxLength={NAME_MAX} autoComplete="off" value={fullName} disabled={busy} {...a11y("fullName")} onChange={(e) => setFullName(e.target.value)} />
        </label>
        <label className="space-y-1" htmlFor={ids.region}>
          <span className="text-xs text-mq-text-muted">{t("subAccounts.create.region")}</span>
          <select id={ids.region} className="mq-input" value={regionCode} disabled={busy} {...a11y("regionCode")} onChange={(e) => setRegionCode(e.target.value)}>
            <option value="">{t("subAccounts.create.regionDefault")}</option>
            {BUSINESS_REGION_CODES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>
      {admin ? (
        <label className="block space-y-1" htmlFor={ids.reason}>
          <span className="text-xs text-mq-text-muted">{t("admin.common.reason")}</span>
          <textarea id={ids.reason} className="mq-input" rows={2} maxLength={REASON_MAX} value={reason} disabled={busy} {...a11y("reason")} onChange={(e) => setReason(e.target.value.slice(0, REASON_MAX))} />
        </label>
      ) : null}
      {atCap ? <p className="text-xs text-mq-accent-orange">{t("subAccounts.create.atCap")}</p> : null}
      {errors.length > 0 ? (
        <ul id={ids.err} className="mq-admin-modal-error" role="alert">
          {errors.map((e) => (
            <li key={`${e.field}-${e.code}`}>{t(e.field === "reason" ? `admin.common.reasonErrors.${e.code}` : `subAccounts.create.errors.${e.field}.${e.code}`)}</li>
          ))}
        </ul>
      ) : null}
      <button type="submit" className="mq-btn mq-btn-primary text-xs" disabled={busy || (atCap && !admin)}>
        {busy ? t("admin.common.working") : t("subAccounts.create.submit")}
      </button>
    </form>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useLanguage();
  const tone = status === "ACTIVE" ? "mq-badge-teal" : status === "PENDING_ACTIVATION" ? "mq-badge-orange" : "mq-badge-muted";
  return <span className={`mq-badge ${tone}`}>{translateStatus(t, "user", status)}</span>;
}

/** Own direct sub-accounts (owner) or the rows of the admin tree; a pending one can be withdrawn / discarded. */
export function SubAccountTable({
  items,
  busy = false,
  actionLabelKey,
  onAction,
  indent,
}: {
  items: Array<SubAccountItem & { indent?: number }>;
  busy?: boolean;
  /** Label of the per-row action shown on PENDING_ACTIVATION rows (withdraw for the owner, discard for staff). */
  actionLabelKey?: string;
  onAction?: (item: SubAccountItem) => void;
  indent?: boolean;
}) {
  const { t, locale } = useLanguage();
  const intl = toIntlLocale(locale);
  return (
    <div className="mq-table-wrap">
      <table className="w-full text-sm">
        <thead className="bg-mq-surface-subtle text-left">
          <tr>
            <th className="p-3">{t("subAccounts.col.email")}</th>
            <th className="p-3">{t("subAccounts.col.name")}</th>
            <th className="p-3">{t("subAccounts.col.status")}</th>
            <th className="p-3">{t("subAccounts.col.region")}</th>
            <th className="p-3">{t("subAccounts.col.created")}</th>
            <th className="p-3" />
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id} className="border-t border-mq-border align-top">
              <td className="p-3" style={indent ? { paddingLeft: `${0.75 + (i.indent ?? 0) * 1.25}rem` } : undefined}>
                {i.email}
              </td>
              <td className="p-3">{i.fullName ?? "—"}</td>
              <td className="p-3 space-y-1">
                <StatusBadge status={i.status} />
                {isPendingAccount(i.status) ? <p className="text-xs text-mq-text-muted">{t("subAccounts.pendingHint", { days: String(PENDING_DAYS) })}</p> : null}
              </td>
              <td className="p-3">{i.regionCode ?? "—"}</td>
              <td className="p-3 text-xs text-mq-text-muted whitespace-nowrap">{formatDateTimeGmt8(i.createdAt, intl)}</td>
              <td className="p-3">
                {onAction && actionLabelKey && isPendingAccount(i.status) ? (
                  <button type="button" className="mq-btn mq-btn-outline text-xs" disabled={busy} onClick={() => onAction(i)}>
                    {t(actionLabelKey)}
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The one-time invite link. The plaintext token exists only in the response of the creation call: it is shown
 * here once, can be copied, and is never shown again (a replayed request returns no token at all).
 */
export function NewInviteBox({
  created,
  origin,
  onDismiss,
}: {
  created: { token: string | null; expiresAt?: string } | undefined;
  origin: string;
  onDismiss: () => void;
}) {
  const { t, locale } = useLanguage();
  const [copied, setCopied] = useState<"idle" | "ok" | "failed">("idle");
  const reveal = inviteReveal(created);
  if (reveal.kind === "none") return null;
  if (reveal.kind === "replayed") {
    return (
      <div className="mq-alert mq-alert-error" role="status">
        <p>{t("subAccounts.invites.replayed")}</p>
        <button type="button" className="mq-btn mq-btn-outline text-xs mt-2" onClick={onDismiss}>
          {t("subAccounts.invites.dismiss")}
        </button>
      </div>
    );
  }
  const link = buildInviteLink(origin, reveal.token);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied("ok");
    } catch {
      setCopied("failed");
    }
  };
  return (
    <div className="mq-card p-4 space-y-2 text-sm" role="status">
      <p className="font-semibold">{t("subAccounts.invites.newTitle")}</p>
      <p className="text-xs text-mq-accent-orange">{t("subAccounts.invites.onceWarning")}</p>
      <input className="mq-input" readOnly value={link} aria-label={t("subAccounts.invites.link")} onFocus={(e) => e.currentTarget.select()} />
      {created?.expiresAt ? <p className="text-xs text-mq-text-muted">{t("subAccounts.invites.expires", { date: formatDateTimeGmt8(created.expiresAt, toIntlLocale(locale)) })}</p> : null}
      <div className="flex gap-2">
        <button type="button" className="mq-btn mq-btn-primary text-xs" onClick={() => void copy()}>
          {t("subAccounts.invites.copy")}
        </button>
        <button type="button" className="mq-btn mq-btn-outline text-xs" onClick={onDismiss}>
          {t("subAccounts.invites.dismiss")}
        </button>
      </div>
      {copied === "ok" ? <p className="text-xs" role="status">{t("subAccounts.invites.copied")}</p> : null}
      {copied === "failed" ? <p className="text-xs text-mq-accent-orange" role="alert">{t("subAccounts.invites.copyFailed")}</p> : null}
    </div>
  );
}

/** Invite list: status, expiry, revoke on PENDING ones. The token itself is never in this list. */
export function InviteTable({ items, busy = false, onRevoke }: { items: InviteItem[]; busy?: boolean; onRevoke: (i: InviteItem) => void }) {
  const { t, locale } = useLanguage();
  const intl = toIntlLocale(locale);
  if (items.length === 0) return <p className="text-sm text-mq-text-muted">{t("subAccounts.invites.empty")}</p>;
  return (
    <div className="mq-table-wrap">
      <table className="w-full text-sm">
        <thead className="bg-mq-surface-subtle text-left">
          <tr>
            <th className="p-3">{t("subAccounts.col.status")}</th>
            <th className="p-3">{t("subAccounts.col.created")}</th>
            <th className="p-3">{t("subAccounts.invites.expiresCol")}</th>
            <th className="p-3" />
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id} className="border-t border-mq-border">
              <td className="p-3">
                <span className="mq-badge mq-badge-muted">{t(`subAccounts.invites.status.${i.status}`)}</span>
              </td>
              <td className="p-3 text-xs whitespace-nowrap">{formatDateTimeGmt8(i.createdAt, intl)}</td>
              <td className="p-3 text-xs whitespace-nowrap">{formatDateTimeGmt8(i.expiresAt, intl)}</td>
              <td className="p-3">
                {canRevoke(i.status) ? (
                  <button type="button" className="mq-btn mq-btn-outline text-xs" disabled={busy} onClick={() => onRevoke(i)}>
                    {t("subAccounts.invites.revoke")}
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
