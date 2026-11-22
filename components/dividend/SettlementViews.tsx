"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { AutoCreditState, RunOutcome, SettlementItem, SettlementView } from "@/lib/api/dividend-settlements";
import { formatDateTimeGmt8 } from "@/lib/i18n/gmt8-calendar";
import { toIntlLocale } from "@/lib/i18n/locale-format";
import { armedState, formatBps, formatMoney, periodKeyLabel, runOutcomeKey, runQuarterParam } from "@/lib/dividend/settlement";

/** Prominent warning: the switch must not be turned on in a real environment yet. Always shown on the settings screen. */
export function AutoCreditWarning({ compact = false }: { compact?: boolean }) {
  const { t } = useLanguage();
  return (
    <div className="mq-alert mq-alert-error" role="alert" data-testid="auto-credit-warning">
      <p className="font-semibold">{t("dividendSettlements.warning.title")}</p>
      <p className="text-sm">{t("dividendSettlements.warning.body")}</p>
      {compact ? null : <p className="text-sm mt-1">{t("dividendSettlements.warning.order")}</p>}
    </div>
  );
}

/** The armed state from `meta.autoCredit` of GET /admin/dividend/settlements. */
export function AutoCreditStateCard({ state }: { state: AutoCreditState | null }) {
  const { t } = useLanguage();
  const s = armedState(state);
  const tone = s === "armed" ? "mq-badge-orange" : "mq-badge-muted";
  return (
    <div className="mq-card p-4 text-sm space-y-1">
      <p>
        <span className="text-mq-text-muted">{t("dividendSettlements.armed.label")}: </span>
        <span className={`mq-badge ${tone}`}>{t(`dividendSettlements.armed.${s}`)}</span>
      </p>
      {state ? (
        <p className="text-xs text-mq-text-muted">
          {t("dividendSettlements.armed.switch")}: {state.enabled ? t("admin.settings.on") : t("admin.settings.off")} · {t("dividendSettlements.armed.fromQuarter")}:{" "}
          {periodKeyLabel(state.fromQuarter)}
        </p>
      ) : null}
    </div>
  );
}

export function StatusBadge({ status, prefix }: { status: string; prefix: "settlementStatus" | "itemStatus" }) {
  const { t } = useLanguage();
  const key = `dividendSettlements.${prefix}.${status}`;
  const label = t(key) === key ? status : t(key);
  const tone = status === "COMPLETED" || status === "CREDITED" ? "mq-badge-teal" : status === "FAILED" ? "mq-badge-pink" : "mq-badge-muted";
  return <span className={`mq-badge ${tone}`}>{label}</span>;
}

export function SettlementTable({ items }: { items: SettlementView[] }) {
  const { t, locale } = useLanguage();
  const intl = toIntlLocale(locale);
  return (
    <div className="mq-table-wrap">
      <table className="w-full text-sm">
        <thead className="bg-mq-surface-subtle text-left">
          <tr>
            <th className="p-3">{t("dividendSettlements.col.quarter")}</th>
            <th className="p-3">{t("dividendSettlements.col.status")}</th>
            <th className="p-3">{t("dividendSettlements.col.pool")}</th>
            <th className="p-3">{t("dividendSettlements.col.remainder")}</th>
            <th className="p-3">{t("dividendSettlements.col.paid")}</th>
            <th className="p-3">{t("dividendSettlements.col.items")}</th>
            <th className="p-3" />
          </tr>
        </thead>
        <tbody>
          {items.map((s) => (
            <tr key={s.id} className="border-t border-mq-border align-top">
              <td className="p-3 font-medium">{periodKeyLabel(s.quarter)}</td>
              <td className="p-3">
                <StatusBadge status={s.status} prefix="settlementStatus" />
              </td>
              <td className="p-3 tabular-nums whitespace-nowrap">{formatMoney(s.pool, intl)} TWD</td>
              <td className="p-3 tabular-nums whitespace-nowrap">{formatMoney(s.remainder, intl)} TWD</td>
              <td className="p-3 tabular-nums whitespace-nowrap">{formatMoney(s.paidTotal, intl)} TWD</td>
              <td className="p-3 text-xs">
                {s.counts
                  ? t("dividendSettlements.counts", { credited: String(s.counts.credited), pending: String(s.counts.pending), skipped: String(s.counts.skippedZero + s.counts.skippedNoWallet), total: String(s.itemCount) })
                  : String(s.itemCount)}
              </td>
              <td className="p-3">
                <Link href={`/admin/dividend/settlements/${encodeURIComponent(s.quarter)}`} className="mq-btn mq-btn-outline text-xs">
                  {t("dividendSettlements.open")}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Snapshot facts of one settlement: pool, remainder, paid, retained, fx rate, point peg, tax. */
export function SettlementFacts({ s }: { s: SettlementView }) {
  const { t, locale } = useLanguage();
  const intl = toIntlLocale(locale);
  const row = (label: string, value: string) => (
    <p>
      <span className="text-mq-text-muted">{label}: </span>
      <span className="tabular-nums">{value}</span>
    </p>
  );
  return (
    <div className="mq-card p-4 grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
      <p>
        <span className="text-mq-text-muted">{t("dividendSettlements.col.status")}: </span>
        <StatusBadge status={s.status} prefix="settlementStatus" />
      </p>
      {row(t("dividendSettlements.col.pool"), `${formatMoney(s.pool, intl)} TWD`)}
      {row(t("dividendSettlements.col.remainder"), `${formatMoney(s.remainder, intl)} TWD`)}
      {row(t("dividendSettlements.col.paid"), `${formatMoney(s.paidTotal, intl)} TWD`)}
      {row(t("dividendSettlements.facts.retained"), s.companyRetained ? `${formatMoney(s.companyRetained, intl)} TWD` : "—")}
      {row(t("dividendSettlements.facts.slots"), String(s.totalSlots))}
      {row(t("dividendSettlements.facts.fx"), String(s.fxRateTwdUsd))}
      {row(t("dividendSettlements.facts.peg"), String(s.pointUsdValue))}
      {row(t("dividendSettlements.facts.tax"), formatBps(s.taxBps))}
      {row(t("dividendSettlements.facts.lockAt"), formatDateTimeGmt8(s.lockAt, intl))}
      {row(t("dividendSettlements.facts.snapshotAt"), formatDateTimeGmt8(s.snapshotAt, intl))}
      {row(t("dividendSettlements.facts.finishedAt"), s.finishedAt ? formatDateTimeGmt8(s.finishedAt, intl) : "—")}
      {s.status === "FAILED" && s.meta && typeof s.meta.failedReason === "string" ? (
        <p className="sm:col-span-2 text-mq-accent-orange">
          {t("dividendSettlements.facts.failedReason")}: {s.meta.failedReason}
        </p>
      ) : null}
    </div>
  );
}

/** Items of a settlement (staff view) or of the owner (`owner`: no account columns). Amounts from integer cents text. */
export function ItemsTable({ items, owner = false }: { items: SettlementItem[]; owner?: boolean }) {
  const { t, locale } = useLanguage();
  const intl = toIntlLocale(locale);
  return (
    <div className="mq-table-wrap">
      <table className="w-full text-sm">
        <thead className="bg-mq-surface-subtle text-left">
          <tr>
            {owner ? <th className="p-3">{t("dividendSettlements.col.quarter")}</th> : <th className="p-3">{t("dividendSettlements.col.account")}</th>}
            <th className="p-3">{t("dividendSettlements.col.slots")}</th>
            <th className="p-3">{t("dividendSettlements.col.amount")}</th>
            <th className="p-3">{t("dividendSettlements.col.points")}</th>
            <th className="p-3">{t("dividendSettlements.col.status")}</th>
            <th className="p-3">{t("dividendSettlements.col.walletTx")}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id} className="border-t border-mq-border align-top">
              <td className="p-3">
                {owner ? (
                  <Link href={`/dividend-credits/${encodeURIComponent(i.id)}`} className="underline">
                    {periodKeyLabel(i.quarter)}
                  </Link>
                ) : (
                  <>
                    <p>{i.fullName ?? "—"}</p>
                    <p className="text-xs text-mq-text-muted">{i.email ?? i.userId ?? ""}</p>
                  </>
                )}
              </td>
              <td className="p-3 tabular-nums">{i.slots}</td>
              <td className="p-3 tabular-nums whitespace-nowrap">{formatMoney(i.amountTwd, intl)} TWD</td>
              <td className="p-3 tabular-nums whitespace-nowrap">{i.points}</td>
              <td className="p-3 space-y-1">
                <StatusBadge status={i.status} prefix="itemStatus" />
                {i.status === "SKIPPED_NO_WALLET" && i.meta?.reason ? (
                  <p className="text-xs text-mq-text-muted">{t(`dividendSettlements.skipReason.${i.meta.reason}`)}</p>
                ) : null}
                {i.creditedAt ? <p className="text-xs text-mq-text-muted">{formatDateTimeGmt8(i.creditedAt, intl)}</p> : null}
              </td>
              <td className="p-3 text-xs break-all">{i.walletTxId ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Result lines of a finished run. */
export function RunResult({ r }: { r: RunOutcome }) {
  const { t } = useLanguage();
  return (
    <div className="mq-alert mq-alert-success" role="status">
      <p className="font-semibold">
        {periodKeyLabel(r.quarter)}: {t(runOutcomeKey(r.outcome))}
      </p>
      <p className="text-sm">{t("dividendSettlements.run.result", { credited: String(r.credited), skipped: String(r.skipped), pending: String(r.pending), errors: String(r.errors) })}</p>
      {r.outcome === "PARTIAL" ? <p className="text-sm">{t("dividendSettlements.run.partialHint")}</p> : null}
    </div>
  );
}

/**
 * Run-now (SUPER_ADMIN only; the page decides). `fixedQuarter` = the detail page; without it the form asks for a
 * quarter. The run is synchronous: the confirmation says so.
 */
export function RunPanel({
  fixedQuarter,
  busy,
  onRun,
}: {
  fixedQuarter?: string;
  busy: boolean;
  onRun: (quarter: string) => Promise<void> | void;
}) {
  const { t } = useLanguage();
  const [raw, setRaw] = useState("");
  const [error, setError] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = fixedQuarter ?? runQuarterParam(raw);
    if (!q) {
      setError(true);
      return;
    }
    setError(false);
    setPending(q);
  };
  return (
    <form className="mq-card p-4 space-y-2 text-sm" onSubmit={submit} noValidate aria-label={t("dividendSettlements.run.title")}>
      <h2 className="font-semibold">{t("dividendSettlements.run.title")}</h2>
      <p className="text-xs text-mq-text-muted">{t("dividendSettlements.run.explain")}</p>
      {fixedQuarter ? null : (
        <label className="block space-y-1 max-w-xs">
          <span className="text-xs text-mq-text-muted">{t("dividendSettlements.run.quarter")}</span>
          <input className="mq-input" value={raw} placeholder="2026Q4" autoComplete="off" disabled={busy} aria-invalid={error || undefined} onChange={(e) => setRaw(e.target.value)} />
        </label>
      )}
      {error ? (
        <p className="mq-admin-modal-error" role="alert">
          {t("dividendSettlements.run.badQuarter")}
        </p>
      ) : null}
      <button type="submit" className="mq-btn mq-btn-primary text-xs" disabled={busy}>
        {busy ? t("dividendSettlements.run.running") : t("dividendSettlements.run.button")}
      </button>
      <ConfirmDialog
        open={pending !== null}
        title={t("dividendSettlements.run.confirmTitle", { quarter: periodKeyLabel(pending) })}
        description={t("dividendSettlements.run.confirmDesc")}
        confirmLabel={t("dividendSettlements.run.button")}
        tone="warn"
        busy={busy}
        onClose={() => setPending(null)}
        onConfirm={async () => {
          const q = pending;
          setPending(null);
          if (q) await onRun(q);
        }}
      />
    </form>
  );
}

/**
 * Deliberate confirmation before the automatic dividend credit is turned ON: repeats the warning, says whether the
 * first quarter is set, and only enables the confirm button once the checkbox is ticked.
 */
export function EnableAutoCreditConfirm({
  open,
  fromQuarterLabel,
  busy = false,
  onClose,
  onConfirm,
}: {
  open: boolean;
  /** "2026 Q4", or null when the first quarter is not set. */
  fromQuarterLabel: string | null;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  if (!open) return null;
  return <EnableForm fromQuarterLabel={fromQuarterLabel} busy={busy} onClose={onClose} onConfirm={onConfirm} />;
}

function EnableForm({ fromQuarterLabel, busy, onClose, onConfirm }: { fromQuarterLabel: string | null; busy: boolean; onClose: () => void; onConfirm: () => void | Promise<void> }) {
  const { t } = useLanguage();
  const [understood, setUnderstood] = useState(false);
  return (
    <div className="mq-admin-modal-root" role="presentation" style={{ zIndex: 120 }}>
      <button type="button" className="mq-admin-modal-backdrop" aria-label={t("admin.common.close")} disabled={busy} onClick={onClose} />
      <div className="mq-admin-modal" role="alertdialog" aria-modal="true" aria-label={t("dividendSettlements.enableConfirm.title")}>
        <header className="mq-admin-modal-head" style={{ flexDirection: "column", alignItems: "flex-start" }}>
          <h2 className="mq-admin-modal-title">{t("dividendSettlements.enableConfirm.title")}</h2>
        </header>
        <div className="mq-admin-modal-body space-y-3">
          <AutoCreditWarning />
          <p className="text-sm" data-testid="from-quarter-state">
            {fromQuarterLabel
              ? t("dividendSettlements.enableConfirm.fromSet", { quarter: fromQuarterLabel })
              : t("dividendSettlements.enableConfirm.fromNotSet")}
          </p>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={understood} disabled={busy} onChange={(e) => setUnderstood(e.target.checked)} />
            <span>{t("dividendSettlements.enableConfirm.check")}</span>
          </label>
          <div className="mq-admin-modal-actions">
            <button type="button" className="mq-btn mq-btn-outline" disabled={busy} onClick={onClose}>
              {t("admin.common.cancel")}
            </button>
            <button type="button" className="mq-btn mq-btn-primary" disabled={busy || !understood} onClick={() => void onConfirm()}>
              {busy ? t("admin.common.working") : t("dividendSettlements.enableConfirm.confirm")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
