"use client";

import Link from "next/link";
import { useState } from "react";
import type { SettlementStatus } from "@/lib/api/settlements";
import { formatMoney } from "@/lib/api/utils";
import { useAdminSettlements } from "@/lib/queries/settlements";
import { useAdminShops } from "@/lib/queries/admin";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { translateStatus } from "@/lib/i18n/status";
import { AdminCardListSkeleton } from "@/components/ui/Skeleton";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { getErrorMessage } from "@/lib/queries/utils";
import { LedgerTwdNote } from "@/components/finance/LedgerTwdNote";

const STATUSES: Array<SettlementStatus | ""> = [
  "",
  "PENDING_RECONCILE",
  "INCLUDED_IN_PAYOUT",
  "PAID_OUT",
  "VOIDED",
];

function statusBadgeClass(status: SettlementStatus): string {
  switch (status) {
    case "PENDING_RECONCILE":
      return "mq-badge mq-badge-cyan";
    case "INCLUDED_IN_PAYOUT":
      return "mq-badge mq-badge-orange";
    case "PAID_OUT":
      return "mq-badge mq-badge-teal";
    case "VOIDED":
      return "mq-badge mq-badge-muted";
    default:
      return "mq-badge mq-badge-muted";
  }
}

function SettlementsInner() {
  const { t } = useLanguage();
  const [shopId, setShopId] = useState("");
  const [status, setStatus] = useState<SettlementStatus | "">("PENDING_RECONCILE");
  const [page, setPage] = useState(1);
  const { data: shopsPage } = useAdminShops("APPROVED", 1, 100);
  const shops = shopsPage?.items ?? [];
  const shopName = (id: string) => shops.find((s) => s.id === id)?.name ?? t("admin.common.shop");

  const { data, isLoading, isError, error } = useAdminSettlements({
    status: status || undefined,
    shopId: shopId || undefined,
    page,
    pageSize: 20,
  });
  const items = data?.items ?? [];
  const meta = data?.meta;
  const pendingTotal = data?.summary.pendingTotal ?? 0;
  const showPendingTotal = !status || status === "PENDING_RECONCILE";

  return (
    <>
      <AdminPageHeader
        title={t("admin.settlements.title")}
        description={t("admin.settlements.description")}
        actions={
          <Link href="/admin/payouts" className="mq-btn mq-btn-outline shrink-0 whitespace-nowrap">
            {t("admin.settlementsPage.openPayouts")}
          </Link>
        }
      />
      <div className="space-y-4">
        <LedgerTwdNote />
        <div className="flex flex-wrap gap-3 items-end">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-mq-text-muted text-xs">{t("admin.common.filterStatus")}</span>
            <select
              className="mq-input !w-[16rem] max-w-full"
              value={status}
              aria-label={t("admin.common.filterStatus")}
              onChange={(e) => {
                setStatus(e.target.value as SettlementStatus | "");
                setPage(1);
              }}
            >
              {STATUSES.map((s) => (
                <option key={s || "all"} value={s}>
                  {s === "" ? t("admin.common.allStatuses") : translateStatus(t, "settlement", s)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-mq-text-muted text-xs">{t("admin.common.shop")}</span>
            <select
              className="mq-input min-w-[14rem]"
              value={shopId}
              aria-label={t("admin.common.shop")}
              onChange={(e) => {
                setShopId(e.target.value);
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

        {showPendingTotal ? (
          <div className="mq-card p-4 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-mq-text-muted">
                {t("admin.settlementsPage.pendingTotal")}
              </p>
              <p className="text-xl font-medium tabular-nums mt-1">
                {formatMoney(pendingTotal)}
              </p>
            </div>
            {typeof meta?.total === "number" ? (
              <p className="text-sm text-mq-text-muted">
                {t("admin.common.items", { count: String(meta.total) })}
              </p>
            ) : null}
          </div>
        ) : typeof meta?.total === "number" ? (
          <p className="text-sm text-mq-text-muted">
            {t("admin.common.items", { count: String(meta.total) })}
          </p>
        ) : null}

        {isLoading && <AdminCardListSkeleton count={6} />}
        {isError && (
          <div className="mq-alert mq-alert-error">
            {getErrorMessage(error, t("admin.common.failed"))}
          </div>
        )}
        {!isLoading && items.length === 0 && !isError && (
          <p className="text-sm text-mq-text-muted py-6 text-center">
            {t("admin.settlementsPage.empty")}
          </p>
        )}
        {items.map((s) => (
          <div
            key={s.id}
            className="mq-card p-4 flex flex-wrap items-center justify-between gap-3 text-sm"
          >
            <div className="min-w-0">
              <Link href={`/orders/${s.orderId}`} className="hover:underline">
                <span className="font-mono font-medium">
                  {s.orderCode ?? t("orders.detail.title")}
                </span>
              </Link>
              <span className={`${statusBadgeClass(s.status)} ml-2`}>{translateStatus(t, "settlement", s.status)}</span>
              <p className="text-xs text-mq-text-muted mt-1">
                {shopName(s.shopId)} · {new Date(s.createdAt).toLocaleString()}
              </p>
            </div>
            <span className="tabular-nums font-medium">{formatMoney(s.amount)}</span>
          </div>
        ))}
        <PaginationBar page={page} meta={meta} onPageChange={setPage} />
      </div>
    </>
  );
}

export default function AdminSettlementsPage() {
  return (
    <AuthGuard
      roles={["ADMIN", "SUPER_ADMIN", "ACCOUNTANT"]}
      permissions={["VIEW_TRANSACT"]}
    >
      <SettlementsInner />
    </AuthGuard>
  );
}
