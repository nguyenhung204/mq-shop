"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import type {
  InventorySlip,
  InventorySlipStatus,
  InventorySlipType,
  StockLedgerEntry,
} from "@/lib/api/inventory";
import { formatMoney } from "@/lib/api/utils";
import {
  useAdminApproveSlip,
  useAdminInventoryLedger,
  useAdminInventorySlip,
  useAdminInventorySlips,
  useAdminRejectSlip,
} from "@/lib/queries/inventory";
import { useAdminShops } from "@/lib/queries/admin";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { AdminActions, AdminIconButton } from "@/components/admin/AdminIconButton";
import { SlipDetailBody } from "@/components/inventory/SlipDetailBody";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { AdminCardListSkeleton, TableSkeleton } from "@/components/ui/Skeleton";

type TabId = "slips" | "ledger";

const TABS: { id: TabId; label: string }[] = [
  { id: "slips", label: "Slips" },
  { id: "ledger", label: "Ledger" },
];

function statusBadge(status: InventorySlipStatus): string {
  switch (status) {
    case "PENDING":
      return "mq-badge mq-badge-cyan";
    case "APPROVED":
      return "mq-badge mq-badge-teal";
    case "REJECTED":
      return "mq-badge mq-badge-pink";
    default:
      return "mq-badge mq-badge-muted";
  }
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function slipTypeLabel(type: InventorySlipType): string {
  switch (type) {
    case "IN":
      return "IN";
    case "ADJUST_IN":
      return "ADJUST IN";
    case "ADJUST_OUT":
      return "ADJUST OUT";
    default:
      return type;
  }
}

function slipItemsSummary(s: InventorySlip): string {
  const lines = s.items ?? [];
  if (!lines.length) return "No items";
  const first = lines[0];
  const head = `${first.sku} ×${first.quantity}`;
  if (lines.length === 1) return head;
  return `${head} +${lines.length - 1} more`;
}

function SlipsTab() {
  const [status, setStatus] = useState<InventorySlipStatus | "">("PENDING");
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);
  const { data, isLoading, isError, error } = useAdminInventorySlips({
    status: status || undefined,
    page,
    pageSize: 20,
  });
  const detailQuery = useAdminInventorySlip(detailId);
  const items = data?.items ?? [];
  const meta = data?.meta;
  const approveSlip = useAdminApproveSlip();
  const rejectSlip = useAdminRejectSlip();
  const busy = approveSlip.isPending || rejectSlip.isPending;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          className="mq-input max-w-[11rem]"
          value={status}
          aria-label="Filter by status"
          onChange={(e) => {
            setStatus(e.target.value as InventorySlipStatus | "");
            setPage(1);
          }}
        >
          <option value="">All</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      {isError && (
        <div className="mq-alert mq-alert-error">
          {error instanceof Error ? error.message : "Failed"}
        </div>
      )}
      {isLoading ? (
        <AdminCardListSkeleton count={4} />
      ) : items.length === 0 ? (
        <p className="text-sm text-mq-text-muted">No slips for this filter.</p>
      ) : (
        items.map((s: InventorySlip) => (
          <div key={s.id} className="mq-card p-4 space-y-3 text-sm">
            <div className="flex flex-wrap gap-4 items-start justify-between">
              <div className="min-w-[200px] flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="font-medium font-mono text-xs underline-offset-2 hover:underline"
                    onClick={() =>
                      setDetailId((id) => (id === s.id ? null : s.id))
                    }
                  >
                    {s.code}
                  </button>
                  <span className={statusBadge(s.status)}>{s.status}</span>
                  <span className="text-xs text-mq-text-muted">{s.type}</span>
                </div>
                <p className="text-mq-text-secondary">{slipItemsSummary(s)}</p>
                {(s.items?.length ?? 0) > 0 ? (
                  <ul className="text-xs text-mq-text-muted space-y-0.5">
                    {s.items.map((it) => (
                      <li key={it.id}>
                        {it.sku} ×{it.quantity}
                        {it.unitCost != null ? ` @ ${formatMoney(it.unitCost)}` : ""}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {s.warehouseCode ? (
                  <p className="text-xs text-mq-text-muted">Warehouse {s.warehouseCode}</p>
                ) : null}
                {s.locationNote ? (
                  <p className="text-xs text-mq-text-muted">{s.locationNote}</p>
                ) : null}
                <p className="text-xs text-mq-text-muted font-mono">
                  Shop {s.shopId.slice(0, 8)}… · Slip {s.id.slice(0, 8)}…
                </p>
                <p className="text-xs text-mq-text-muted">
                  Created {formatWhen(s.createdAt)}
                  {s.processedAt ? ` · Processed ${formatWhen(s.processedAt)}` : ""}
                </p>
              </div>
              {s.status === "PENDING" ? (
                <AdminActions>
                  <AdminIconButton
                    label="Approve"
                    icon={Check}
                    tone="approve"
                    disabled={busy}
                    onClick={() => void approveSlip.mutateAsync(s.id)}
                  />
                  <AdminIconButton
                    label="Reject"
                    icon={X}
                    tone="reject"
                    disabled={busy}
                    onClick={() => void rejectSlip.mutateAsync(s.id)}
                  />
                </AdminActions>
              ) : null}
            </div>
            {detailId === s.id ? (
              <SlipDetailBody
                slip={detailQuery.data}
                loading={detailQuery.isLoading}
                error={
                  detailQuery.isError
                    ? detailQuery.error instanceof Error
                      ? detailQuery.error.message
                      : "Failed to load"
                    : null
                }
              />
            ) : null}
          </div>
        ))
      )}
      <PaginationBar page={page} meta={meta} onPageChange={setPage} />
    </div>
  );
}

function LedgerTab() {
  const [shopId, setShopId] = useState("");
  const [sku, setSku] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const { data: shopsPage } = useAdminShops("APPROVED", 1, 100);
  const shops = shopsPage?.items ?? [];

  const { data, isLoading, isError, error, isFetching } = useAdminInventoryLedger({
    shopId: shopId || undefined,
    sku: sku || undefined,
    from: from ? new Date(from).toISOString() : undefined,
    to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
    page,
    pageSize: 20,
  });
  const items = data?.items ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-4">
      <p className="text-sm text-mq-text-muted">
        Immutable stock history for a shop. Each approved slip writes one ledger row per item.
        Use <code>quantityAfter</code> as the historical stock figure.
      </p>

      <div className="flex flex-wrap gap-3">
        <select
          className="mq-input max-w-[16rem]"
          value={shopId}
          aria-label="Shop"
          onChange={(e) => {
            setShopId(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Select shop…</option>
          {shops.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <input
          className="mq-input max-w-[10rem]"
          placeholder="SKU filter"
          value={sku}
          disabled={!shopId}
          onChange={(e) => {
            setSku(e.target.value);
            setPage(1);
          }}
        />
        <input
          className="mq-input max-w-[11rem]"
          type="date"
          aria-label="From date"
          value={from}
          disabled={!shopId}
          onChange={(e) => {
            setFrom(e.target.value);
            setPage(1);
          }}
        />
        <input
          className="mq-input max-w-[11rem]"
          type="date"
          aria-label="To date"
          value={to}
          disabled={!shopId}
          onChange={(e) => {
            setTo(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {!shopId ? (
        <p className="text-sm text-mq-text-muted">Select a shop to load its stock ledger.</p>
      ) : isError ? (
        <div className="mq-alert mq-alert-error">
          {error instanceof Error ? error.message : "Failed to load ledger"}
        </div>
      ) : isLoading || (isFetching && !data) ? (
        <TableSkeleton rows={5} cols={6} />
      ) : items.length === 0 ? (
        <p className="text-sm text-mq-text-muted">No ledger entries for this shop.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-mq-text-muted border-b border-mq-border">
                  <th className="py-2 pr-3 font-medium">When</th>
                  <th className="py-2 pr-3 font-medium">SKU</th>
                  <th className="py-2 pr-3 font-medium">Type</th>
                  <th className="py-2 pr-3 font-medium">Qty</th>
                  <th className="py-2 pr-3 font-medium">Before → After</th>
                  <th className="py-2 font-medium">Slip</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row: StockLedgerEntry) => (
                  <tr key={row.id} className="border-b border-mq-border/60">
                    <td className="py-2.5 pr-3 text-xs text-mq-text-muted">
                      {formatWhen(row.recordedAt)}
                    </td>
                    <td className="py-2.5 pr-3 font-medium">{row.sku}</td>
                    <td className="py-2.5 pr-3 text-xs">{slipTypeLabel(row.type)}</td>
                    <td className="py-2.5 pr-3">{row.quantity}</td>
                    <td className="py-2.5 pr-3">
                      {row.quantityBefore} → {row.quantityAfter}
                    </td>
                    <td className="py-2.5 text-xs text-mq-text-muted font-mono">
                      {row.slipId.slice(0, 8)}…
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationBar page={page} meta={meta} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}

function InventoryInner() {
  const [tab, setTab] = useState<TabId>("slips");

  return (
    <>
      <AdminPageHeader
        title="Inventory"
        description="Cross-shop slips inbox and per-shop stock ledger."
      />

      <div className="space-y-5">
        <div
          className="flex flex-wrap gap-1 border-b border-mq-border pb-px"
          role="tablist"
          aria-label="Inventory sections"
        >
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`px-3.5 py-2 text-sm font-medium rounded-t-md transition-colors ${
                  active
                    ? "bg-mq-surface text-mq-text border border-mq-border border-b-mq-surface -mb-px"
                    : "text-mq-text-muted hover:text-mq-text"
                }`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <div role="tabpanel">
          <div hidden={tab !== "slips"}>
            <SlipsTab />
          </div>
          <div hidden={tab !== "ledger"}>
            <LedgerTab />
          </div>
        </div>
      </div>
    </>
  );
}

export default function AdminInventoryPage() {
  return (
    <AuthGuard
      roles={["ADMIN", "SUPER_ADMIN"]}
      permissions={["VIEW_INVENTORY", "EDIT_INVENTORY"]}
    >
      <InventoryInner />
    </AuthGuard>
  );
}
