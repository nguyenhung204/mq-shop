"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { Check, Plus, X } from "lucide-react";
import type { PayoutStatus, SellerPayout } from "@/lib/api/finance";
import { formatMoney, formatPercent } from "@/lib/api/utils";
import {
  useActiveFinanceConfig,
  useAdminPayouts,
  useApproveSellerPayout,
  useCreateSellerPayout,
  useRejectSellerPayout,
} from "@/lib/queries/finance";
import { useAdminSettlements } from "@/lib/queries/settlements";
import { useAdminShops } from "@/lib/queries/admin";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { AdminActions, AdminIconButton } from "@/components/admin/AdminIconButton";
import { AdminReasonModal } from "@/components/admin/AdminReasonModal";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { AdminCardListSkeleton } from "@/components/ui/Skeleton";
import { getErrorMessage } from "@/lib/queries/utils";

const STATUSES: Array<PayoutStatus | ""> = ["", "PENDING", "COMPLETED", "REJECTED"];

function statusBadgeClass(status: PayoutStatus): string {
  switch (status) {
    case "PENDING":
      return "mq-badge mq-badge-cyan";
    case "COMPLETED":
      return "mq-badge mq-badge-teal";
    case "REJECTED":
      return "mq-badge mq-badge-pink";
    default:
      return "mq-badge mq-badge-muted";
  }
}

function monthBounds(): { start: string; end: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const last = new Date(y, now.getMonth() + 1, 0).getDate();
  return {
    start: `${y}-${m}-01`,
    end: `${y}-${m}-${String(last).padStart(2, "0")}`,
  };
}

function toPeriodStart(date: string): string {
  return new Date(`${date}T00:00:00.000`).toISOString();
}

function toPeriodEnd(date: string): string {
  return new Date(`${date}T23:59:59.999`).toISOString();
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function inPeriod(iso: string, start: string, end: string): boolean {
  const t = new Date(iso).getTime();
  return t >= new Date(start).getTime() && t <= new Date(end).getTime();
}

function PayoutsInner() {
  const { t } = useLanguage();
  const bounds = monthBounds();

  const [shopId, setShopId] = useState("");
  const [periodStartDate, setPeriodStartDate] = useState(bounds.start);
  const [periodEndDate, setPeriodEndDate] = useState(bounds.end);
  const [showCreate, setShowCreate] = useState(false);
  const [status, setStatus] = useState<PayoutStatus | "">("");
  const [listShopId, setListShopId] = useState("");
  const [page, setPage] = useState(1);
  const [rejectTarget, setRejectTarget] = useState<SellerPayout | null>(null);
  const [formError, setFormError] = useState("");

  const { data: shopsPage } = useAdminShops("APPROVED", 1, 100);
  const shops = shopsPage?.items ?? [];
  const shopName = (id: string) => shops.find((s) => s.id === id)?.name ?? id.slice(0, 8);

  const { data: active } = useActiveFinanceConfig();

  const periodStartIso = periodStartDate ? toPeriodStart(periodStartDate) : "";
  const periodEndIso = periodEndDate ? toPeriodEnd(periodEndDate) : "";

  const previewEnabled = Boolean(showCreate && shopId && periodStartIso && periodEndIso);
  const {
    data: settlementsData,
    isLoading: settlementsLoading,
    isFetching: settlementsFetching,
  } = useAdminSettlements(
    {
      status: "PENDING_RECONCILE",
      shopId: shopId || undefined,
      page: 1,
      pageSize: 100,
    },
    { enabled: previewEnabled },
  );

  const previewSettlements = useMemo(() => {
    if (!previewEnabled) return [];
    const items = settlementsData?.items ?? [];
    return items.filter((s) => inPeriod(s.createdAt, periodStartIso, periodEndIso));
  }, [previewEnabled, settlementsData?.items, periodStartIso, periodEndIso]);

  const previewGross = previewSettlements.reduce((sum, s) => sum + Number(s.amount || 0), 0);
  const feePercent = active ? Number(active.platformFeePercent) : NaN;
  const estimatedFee =
    Number.isFinite(feePercent) && previewGross > 0
      ? (previewGross * feePercent) / 100
      : null;

  const { data, isLoading, isError, error } = useAdminPayouts({
    shopId: listShopId || undefined,
    status: status || undefined,
    page,
    pageSize: 20,
  });
  const items = data?.items ?? [];
  const meta = data?.meta;

  const createPayout = useCreateSellerPayout();
  const approvePayout = useApproveSellerPayout();
  const rejectPayout = useRejectSellerPayout();

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!shopId || !periodStartDate || !periodEndDate) {
      setFormError(t("admin.payouts.formError"));
      return;
    }
    if (new Date(periodEndDate) < new Date(periodStartDate)) {
      setFormError(t("admin.payouts.periodInvalid"));
      return;
    }
    if (!active) {
      setFormError(t("admin.payouts.needActiveConfig"));
      return;
    }
    if (previewSettlements.length === 0) {
      setFormError(t("admin.payouts.noSettlements"));
      return;
    }
    try {
      await createPayout.mutateAsync({
        shopId,
        periodStart: toPeriodStart(periodStartDate),
        periodEnd: toPeriodEnd(periodEndDate),
      });
      setShowCreate(false);
      setStatus("PENDING");
      setListShopId(shopId);
      setPage(1);
    } catch {
      /* toast maps PAYOUT_NO_SETTLEMENTS etc. */
    }
  };

  return (
    <>
      <AdminPageHeader
        title={t("admin.payouts.title")}
        description={t("admin.payouts.description")}
        actions={
          <button
            type="button"
            className="mq-btn mq-btn-primary shrink-0 whitespace-nowrap"
            onClick={() => {
              setShowCreate((v) => !v);
              setFormError("");
            }}
          >
            <Plus size={16} aria-hidden />
            {showCreate ? t("admin.common.hideForm") : t("admin.payouts.createNew")}
          </button>
        }
      />

      <div className="space-y-5">
        <div className="mq-card p-4 space-y-2">
          <p className="text-xs uppercase tracking-wide text-mq-text-muted">
            {t("admin.payouts.activeFee")}
          </p>
          {active ? (
            <p className="text-sm">
              {t("admin.payouts.platformFee")}:{" "}
              <strong>{formatPercent(active.platformFeePercent)}</strong>
              {" · "}
              {t("admin.payouts.commission")}:{" "}
              <strong>{formatPercent(active.commissionPercent)}</strong>
              {active.gatewayName ? ` · ${active.gatewayName}` : ""}
            </p>
          ) : (
            <p className="text-sm text-mq-text-muted">
              {t("admin.payouts.noActiveFee")}{" "}
              <Link href="/admin/finance/configs" className="underline">
                {t("admin.payouts.openFeeConfig")}
              </Link>
            </p>
          )}
        </div>

        {showCreate && (
          <form className="mq-card p-5 space-y-4" onSubmit={(e) => void onCreate(e)}>
            <h3 className="font-semibold">{t("admin.payouts.createHeading")}</h3>
            <p className="text-sm text-mq-text-muted">{t("admin.payouts.createHint")}</p>
            {formError ? <div className="mq-alert mq-alert-error">{formError}</div> : null}

            <div className="grid sm:grid-cols-3 gap-3">
              <label className="space-y-1 text-sm sm:col-span-3">
                <span className="text-mq-text-muted">{t("admin.common.shop")}</span>
                <select
                  className="mq-input"
                  value={shopId}
                  required
                  onChange={(e) => setShopId(e.target.value)}
                >
                  <option value="">{t("admin.payouts.selectShop")}</option>
                  {shops.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-mq-text-muted">{t("admin.payouts.periodStart")}</span>
                <input
                  type="date"
                  className="mq-input"
                  value={periodStartDate}
                  required
                  onChange={(e) => setPeriodStartDate(e.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-mq-text-muted">{t("admin.payouts.periodEnd")}</span>
                <input
                  type="date"
                  className="mq-input"
                  value={periodEndDate}
                  required
                  onChange={(e) => setPeriodEndDate(e.target.value)}
                />
              </label>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h4 className="text-sm font-medium">{t("admin.payouts.previewTitle")}</h4>
                {previewEnabled && (
                  <span className="text-xs text-mq-text-muted">
                    {settlementsLoading || settlementsFetching
                      ? t("admin.common.loading")
                      : t("admin.common.items", {
                          count: String(previewSettlements.length),
                        })}
                  </span>
                )}
              </div>

              {!shopId ? (
                <p className="text-sm text-mq-text-muted">{t("admin.payouts.previewNeedShop")}</p>
              ) : previewSettlements.length === 0 && !settlementsLoading ? (
                <p className="text-sm text-mq-text-muted">{t("admin.payouts.noSettlements")}</p>
              ) : (
                <ul className="space-y-2 max-h-56 overflow-y-auto">
                  {previewSettlements.map((s) => (
                    <li
                      key={s.id}
                      className="flex flex-wrap justify-between gap-2 text-sm border-b border-mq-border/60 pb-2 last:border-0"
                    >
                      <span className="font-mono">
                        {s.orderCode ?? s.orderId.slice(0, 8)}
                      </span>
                      <span className="tabular-nums">{formatMoney(s.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}

              {previewSettlements.length > 0 && (
                <div className="text-sm space-y-1 pt-2 border-t border-mq-border/60">
                  <p>
                    {t("admin.payouts.gross")}:{" "}
                    <strong className="tabular-nums">{formatMoney(previewGross)}</strong>
                  </p>
                  {estimatedFee != null ? (
                    <p className="text-mq-text-muted">
                      {t("admin.payouts.estimatedFee", {
                        pct: String(feePercent),
                        amount: formatMoney(estimatedFee),
                      })}
                    </p>
                  ) : null}
                  <p className="text-xs text-mq-text-muted">
                    {t("admin.payouts.shippingAfterCreate")}
                  </p>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="mq-btn mq-btn-primary"
              disabled={createPayout.isPending || !active}
            >
              {createPayout.isPending
                ? t("admin.payouts.creating")
                : t("admin.payouts.createBtn")}
            </button>
          </form>
        )}

        <div className="flex flex-wrap gap-3 items-end">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-mq-text-muted text-xs">{t("admin.common.filterStatus")}</span>
            <select
              className="mq-input !w-[11rem] max-w-full"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as PayoutStatus | "");
                setPage(1);
              }}
            >
              {STATUSES.map((s) => (
                <option key={s || "all"} value={s}>
                  {s ? t(`admin.payouts.status.${s}`) : t("admin.common.allStatuses")}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-mq-text-muted text-xs">{t("admin.common.shop")}</span>
            <select
              className="mq-input min-w-[14rem]"
              value={listShopId}
              onChange={(e) => {
                setListShopId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">{t("admin.common.allShops")}</option>
              {shops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {isError && (
          <div className="mq-alert mq-alert-error">
            {getErrorMessage(error, t("admin.common.failed"))}
          </div>
        )}

        {isLoading && <AdminCardListSkeleton count={4} />}

        {!isLoading && items.length === 0 && !isError && (
          <p className="text-sm text-mq-text-muted py-6 text-center">
            {t("admin.payouts.empty")}
          </p>
        )}

        {!isLoading &&
          items.map((payout) => (
            <div
              key={payout.id}
              className="mq-card p-4 flex flex-wrap justify-between gap-3 text-sm"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/admin/payouts/${payout.id}`}
                    className="font-mono font-medium hover:underline"
                  >
                    {payout.id.slice(0, 8)}…
                  </Link>
                  <span className={statusBadgeClass(payout.status)}>
                    {t(`admin.payouts.status.${payout.status}`)}
                  </span>
                </div>
                <p>
                  {shopName(payout.shopId)}
                  {" · "}
                  {formatWhen(payout.periodStart)} → {formatWhen(payout.periodEnd)}
                </p>
                <p className="tabular-nums">
                  {t("admin.payouts.net")}: <strong>{formatMoney(payout.netAmount)}</strong>
                  {" · "}
                  <span className="text-mq-text-muted">
                    {t("admin.payouts.gross")} {formatMoney(payout.grossRevenue)}
                    {" · "}
                    {t("admin.payouts.fee")} {formatMoney(payout.platformFee)}
                    {" · "}
                    {t("admin.payouts.shipping")} {formatMoney(payout.shippingFee)}
                  </span>
                </p>
                {payout.gatewayRef ? (
                  <p className="text-xs text-mq-text-muted font-mono">
                    {t("admin.payouts.gatewayRef")}: {payout.gatewayRef}
                  </p>
                ) : null}
                {payout.status === "REJECTED" && payout.rejectionReason ? (
                  <p className="text-xs text-mq-text-muted">
                    {t("admin.payouts.rejectionReason", {
                      reason: payout.rejectionReason,
                    })}
                  </p>
                ) : null}
              </div>

              {payout.status === "PENDING" ? (
                <AdminActions>
                  <AdminIconButton
                    label={t("admin.common.approve")}
                    icon={Check}
                    tone="approve"
                    disabled={approvePayout.isPending}
                    onClick={() => void approvePayout.mutateAsync(payout.id)}
                  />
                  <AdminIconButton
                    label={t("admin.common.reject")}
                    icon={X}
                    tone="reject"
                    disabled={rejectPayout.isPending}
                    onClick={() => setRejectTarget(payout)}
                  />
                </AdminActions>
              ) : null}
            </div>
          ))}

        {meta && <PaginationBar page={page} meta={meta} onPageChange={setPage} />}
      </div>

      <AdminReasonModal
        open={Boolean(rejectTarget)}
        title={t("admin.payouts.rejectTitle")}
        description={
          rejectTarget
            ? t("admin.payouts.rejectDesc", {
                net: formatMoney(rejectTarget.netAmount),
              })
            : undefined
        }
        confirmLabel={t("admin.payouts.rejectBtn")}
        maxLength={500}
        busy={rejectPayout.isPending}
        onClose={() => setRejectTarget(null)}
        onConfirm={async (reason) => {
          if (!rejectTarget) return;
          await rejectPayout.mutateAsync({ id: rejectTarget.id, reason });
          setRejectTarget(null);
        }}
      />
    </>
  );
}

export default function AdminPayoutsPage() {
  return (
    <AuthGuard
      roles={["ADMIN", "SUPER_ADMIN", "ACCOUNTANT"]}
      permissions={["PAYOUT_SELLER"]}
    >
      <PayoutsInner />
    </AuthGuard>
  );
}
