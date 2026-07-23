"use client";

import Link from "next/link";
import { useState } from "react";
import { formatMoney } from "@/lib/api/utils";
import { useAdminSettlements } from "@/lib/queries/settlements";
import { useAdminShops } from "@/lib/queries/admin";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { AdminCardListSkeleton } from "@/components/ui/Skeleton";
import { PaginationBar } from "@/components/ui/PaginationBar";

function SettlementsInner() {
  const [shopId, setShopId] = useState("");
  const [page, setPage] = useState(1);
  const { data: shopsPage } = useAdminShops("APPROVED", 1, 100);
  const shops = shopsPage?.items ?? [];

  const { data, isLoading, isError, error } = useAdminSettlements({
    status: "PENDING_RECONCILE",
    shopId: shopId || undefined,
    page,
    pageSize: 20,
  });
  const items = data?.items ?? [];
  const meta = data?.meta;
  const pendingTotal = data?.summary.pendingTotal ?? 0;

  return (
    <>
      <AdminPageHeader
        title="Settlements"
        description="Pending reconcile revenue across shops. Read-only MVP — no payout action yet."
      />
      <div className="space-y-4">
        <div className="flex flex-wrap gap-3 items-end">
          <label className="block text-sm">
            <span className="text-mq-text-muted text-xs">Shop</span>
            <select
              className="mq-input mt-1 min-w-[14rem]"
              value={shopId}
              onChange={(e) => {
                setShopId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All shops</option>
              {shops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mq-card p-4 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-mq-text-muted">
              Pending reconcile total
            </p>
            <p className="text-xl font-medium tabular-nums mt-1">
              {formatMoney(pendingTotal)}
            </p>
          </div>
          {typeof meta?.total === "number" ? (
            <p className="text-sm text-mq-text-muted">{meta.total} entries</p>
          ) : null}
        </div>

        {isLoading && <AdminCardListSkeleton count={6} />}
        {isError && (
          <div className="mq-alert mq-alert-error">
            {error instanceof Error ? error.message : "Failed"}
          </div>
        )}
        {!isLoading && items.length === 0 && !isError && (
          <p className="text-sm text-mq-text-muted py-6 text-center">
            No pending settlements.
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
                  {s.orderCode ?? s.orderId.slice(0, 8)}
                </span>
              </Link>
              <span className="mq-badge mq-badge-cyan ml-2">{s.status}</span>
              <p className="text-xs text-mq-text-muted mt-1">
                Shop {s.shopId.slice(0, 8)}… · {new Date(s.createdAt).toLocaleString()}
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
