"use client";

import { useMemo, useState } from "react";
import { Lock, LockOpen, Pencil } from "lucide-react";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { AccountPicker } from "@/components/admin/dividend/AccountPicker";
import { SetSlotsForm, TransferSlotsForm } from "@/components/admin/dividend/SlotForms";
import { AdminActions, AdminIconButton } from "@/components/admin/AdminIconButton";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { canWriteDividend } from "@/lib/auth/admin-write";
import { currentQuarter, quarterOptions } from "@/lib/dividend/dates";
import { formatDateTimeGmt8 } from "@/lib/i18n/gmt8-calendar";
import { toIntlLocale } from "@/lib/i18n/locale-format";
import {
  useDividendSlots,
  useSetSlots,
  useSlotHistory,
  useTransferSlots,
} from "@/lib/queries/dividend";
import { getErrorMessage } from "@/lib/queries/utils";

function shortId(id: string): string {
  return id.slice(0, 8);
}

function SlotsInner() {
  const { t, locale } = useLanguage();
  const { user } = useAuth();
  const canWrite = canWriteDividend(user);
  const intl = toIntlLocale(locale);
  const [now] = useState(() => new Date());
  const options = useMemo(() => quarterOptions(now, 8, 0), [now]);
  const [quarter, setQuarter] = useState(() => currentQuarter(now));
  const [historyUser, setHistoryUser] = useState("");
  const [setTarget, setSetTarget] = useState("");

  const { data, isLoading, isError, error } = useDividendSlots(quarter);
  const history = useSlotHistory(historyUser);
  const setSlots = useSetSlots();
  const transfer = useTransferSlots();

  const items = useMemo(() => data?.items ?? [], [data?.items]);
  const locked = Boolean(data?.locked);
  const who = useMemo(() => {
    const m = new Map<string, string>();
    for (const h of items) m.set(h.userId, h.email ?? shortId(h.userId));
    return m;
  }, [items]);
  const nameOf = (id: string | null) => (id ? (who.get(id) ?? shortId(id)) : "—");
  const cap = (v: number | null | undefined) => (v == null ? t("admin.dividend.slots.noCap") : String(v));

  return (
    <>
      <AdminPageHeader title={t("admin.dividend.slots.title")} description={t("admin.dividend.slots.description")} />
      <div className="space-y-6">
        {isError && <div className="mq-alert mq-alert-error">{getErrorMessage(error, t("admin.common.failed"))}</div>}
        {!canWrite ? (
          <div className="rounded-lg border border-mq-border bg-mq-surface-subtle p-3 text-sm text-mq-text-secondary">
            {t("admin.dividend.readOnlyNote")}
          </div>
        ) : null}

        <div className="flex flex-wrap items-end gap-4">
          <label className="text-sm">
            <span className="block text-xs text-mq-text-muted mb-1">{t("admin.dividend.quarter")}</span>
            <select className="mq-input" value={quarter} onChange={(e) => setQuarter(e.target.value)}>
              {options.map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
          </label>
          {data ? (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className={locked ? "mq-badge mq-badge-pink" : "mq-badge mq-badge-teal"}>
                {locked ? <Lock size={12} className="inline mr-1" /> : <LockOpen size={12} className="inline mr-1" />}
                {locked ? t("admin.dividend.slots.locked") : t("admin.dividend.slots.open")}
              </span>
              <span className="text-xs text-mq-text-muted">
                {locked
                  ? t("admin.dividend.slots.lockedAt", { date: formatDateTimeGmt8(data.lockAt, intl) })
                  : t("admin.dividend.slots.locksAt", { date: formatDateTimeGmt8(data.lockAt, intl) })}
              </span>
              <span className="text-xs text-mq-text-muted">
                {t("admin.dividend.slots.editWindow", { days: String(data.editWindowDays) })}
              </span>
            </div>
          ) : null}
        </div>

        {data ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-mq-border bg-mq-surface p-3">
              <p className="text-xs text-mq-text-muted">{t("admin.dividend.slots.totalSlots")}</p>
              <p className="text-xl font-semibold tabular-nums">{data.totalSlots}</p>
            </div>
            <div className="rounded-lg border border-mq-border bg-mq-surface p-3">
              <p className="text-xs text-mq-text-muted">{t("admin.dividend.slots.capPerAccount")}</p>
              <p className="text-xl font-semibold tabular-nums">{cap(data.caps.maxSlotsPerAccount)}</p>
            </div>
            <div className="rounded-lg border border-mq-border bg-mq-surface p-3">
              <p className="text-xs text-mq-text-muted">{t("admin.dividend.slots.capTotal")}</p>
              <p className="text-xl font-semibold tabular-nums">{cap(data.caps.maxTotalSlots)}</p>
            </div>
          </div>
        ) : null}

        {isLoading ? (
          <TableSkeleton rows={4} cols={5} />
        ) : items.length === 0 ? (
          <p className="text-sm text-mq-text-muted">{t("admin.dividend.slots.empty")}</p>
        ) : (
          <div className="mq-table-wrap">
            <table className="w-full text-sm">
              <thead className="bg-mq-surface-subtle text-left">
                <tr>
                  <th className="p-3">{t("admin.dividend.slots.account")}</th>
                  <th className="p-3">{t("admin.dividend.slots.colSlots")}</th>
                  <th className="p-3">{t("admin.dividend.slots.colExpires")}</th>
                  <th className="p-3">{t("admin.dividend.slots.colSince")}</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {items.map((h) => (
                  <tr key={h.userId} className="border-t border-mq-border">
                    <td className="p-3">
                      <p className="font-medium">{h.fullName || h.email || shortId(h.userId)}</p>
                      {h.fullName && h.email ? <p className="text-xs text-mq-text-muted">{h.email}</p> : null}
                    </td>
                    <td className="p-3 font-semibold tabular-nums">{h.slots}</td>
                    <td className="p-3 text-xs whitespace-nowrap">{h.expiresAt ? formatDateTimeGmt8(h.expiresAt, intl) : "—"}</td>
                    <td className="p-3 text-xs">{h.sinceQuarter}</td>
                    <td className="p-3">
                      {canWrite && !locked ? (
                        <AdminActions>
                          <AdminIconButton label={t("admin.dividend.slots.setRow")} icon={Pencil} tone="secondary" onClick={() => setSetTarget(h.userId)} />
                        </AdminActions>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {canWrite && data ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <SetSlotsForm
              key={setTarget}
              quarter={quarter}
              locked={locked}
              holdings={items}
              initialUserId={setTarget}
              busy={setSlots.isPending}
              onSubmit={async (body) => {
                try {
                  await setSlots.mutateAsync(body);
                  return true;
                } catch {
                  return false; // toast shown by the hook; keep the form filled
                }
              }}
            />
            <TransferSlotsForm
              quarter={quarter}
              locked={locked}
              holdings={items}
              busy={transfer.isPending}
              onSubmit={async (body) => {
                try {
                  await transfer.mutateAsync(body);
                  return true;
                } catch {
                  return false; // toast shown by the hook; keep the form filled
                }
              }}
            />
          </div>
        ) : null}

        <section className="space-y-3">
          <h2 className="text-sm font-semibold">{t("admin.dividend.slots.historyTitle")}</h2>
          <div className="max-w-md">
            <AccountPicker
              value={historyUser}
              onChange={setHistoryUser}
              ariaLabel={t("admin.dividend.slots.historyFilter")}
              placeholder={t("admin.dividend.slots.historyFilter")}
              known={items}
            />
            {historyUser ? (
              <button type="button" className="text-xs underline mt-1" onClick={() => setHistoryUser("")}>
                {t("admin.dividend.slots.historyClear")}
              </button>
            ) : null}
          </div>
          {history.isLoading ? (
            <TableSkeleton rows={3} cols={6} />
          ) : (history.data ?? []).length === 0 ? (
            <p className="text-sm text-mq-text-muted">{t("admin.dividend.slots.historyEmpty")}</p>
          ) : (
            <div className="mq-table-wrap">
              <table className="w-full text-xs">
                <thead className="bg-mq-surface-subtle text-left">
                  <tr>
                    <th className="p-2">{t("admin.dividend.slots.hWhen")}</th>
                    <th className="p-2">{t("admin.dividend.slots.account")}</th>
                    <th className="p-2">{t("admin.dividend.quarter")}</th>
                    <th className="p-2">{t("admin.dividend.slots.hKind")}</th>
                    <th className="p-2">{t("admin.dividend.slots.colSlots")}</th>
                    <th className="p-2">{t("admin.dividend.slots.colExpires")}</th>
                    <th className="p-2">{t("admin.common.reason")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(history.data ?? []).map((h) => (
                    <tr key={h.id} className="border-t border-mq-border align-top">
                      <td className="p-2 whitespace-nowrap">{formatDateTimeGmt8(h.createdAt, intl)}</td>
                      <td className="p-2">{nameOf(h.userId)}</td>
                      <td className="p-2">{h.quarter}</td>
                      <td className="p-2 whitespace-nowrap">
                        {t(`admin.dividend.slots.kind.${h.kind}`) === `admin.dividend.slots.kind.${h.kind}`
                          ? h.kind
                          : t(`admin.dividend.slots.kind.${h.kind}`)}
                        {h.transferId ? (
                          <span className="block text-mq-text-muted">
                            {t("admin.dividend.slots.transferRef", { id: shortId(h.transferId), other: nameOf(h.counterpartyUserId) })}
                          </span>
                        ) : null}
                      </td>
                      <td className="p-2 font-semibold tabular-nums">{h.slots}</td>
                      <td className="p-2 whitespace-nowrap">{h.expiresAt ? formatDateTimeGmt8(h.expiresAt, intl) : "—"}</td>
                      <td className="p-2 max-w-xs">{h.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

export default function AdminDividendSlotsPage() {
  return (
    <AuthGuard roles={["SUPER_ADMIN", "ADMIN", "ACCOUNTANT"]} permissions={["VIEW_MLM_COMSN"]}>
      <SlotsInner />
    </AuthGuard>
  );
}
