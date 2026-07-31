"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, X } from "lucide-react";
import type {
  InventorySlip,
  InventorySlipStatus,
  StockLedgerEntry,
  StockLedgerType,
} from "@/lib/api/inventory";
import { formatMoney } from "@/lib/api/utils";
import {
  useAdminApproveSlip,
  useAdminInventoryLedger,
  useAdminInventorySlip,
  useAdminInventorySlips,
  useAdminRejectSlip,
  useWarehouses,
} from "@/lib/queries/inventory";
import { useAdminShops } from "@/lib/queries/admin";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { AdminActions, AdminIconButton } from "@/components/admin/AdminIconButton";
import { SlipDetailBody } from "@/components/inventory/SlipDetailBody";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { translateStatus } from "@/lib/i18n/status";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { AdminCardListSkeleton, TableSkeleton } from "@/components/ui/Skeleton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { getErrorMessage } from "@/lib/queries/utils";

type TabId = "slips" | "ledger";

const TAB_IDS: TabId[] = ["slips", "ledger"];

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

function slipTypeLabel(
  type: StockLedgerType,
  t: (key: string, vars?: Record<string, string>) => string,
): string {
  return translateStatus(t, "inventorySlipType", type);
}

function slipItemsSummary(
  s: InventorySlip,
  t: (key: string, vars?: Record<string, string>) => string,
): string {
  const lines = s.items ?? [];
  if (!lines.length) return t("admin.inventoryPage.noItems");
  const first = lines[0];
  const head = `${first.sku} ×${first.quantity}`;
  if (lines.length === 1) return head;
  return `${head} ${t("admin.inventoryPage.more", { n: String(lines.length - 1) })}`;
}

function SlipsTab({ initialSlipId }: { initialSlipId?: string | null }) {
  const { t } = useLanguage();
  const [status, setStatus] = useState<InventorySlipStatus | "">("");
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(initialSlipId ?? null);
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
  const [rejectSlipId, setRejectSlipId] = useState<string | null>(null);
  const busy = approveSlip.isPending || rejectSlip.isPending;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          className="mq-input max-w-[11rem]"
          value={status}
          aria-label={t("admin.common.filterStatus")}
          onChange={(e) => {
            setStatus(e.target.value as InventorySlipStatus | "");
            setPage(1);
          }}
        >
          <option value="">{t("admin.common.all")}</option>
          <option value="PENDING">{t("admin.common.pending")}</option>
          <option value="APPROVED">{t("admin.common.approved")}</option>
          <option value="REJECTED">{t("admin.common.rejected")}</option>
        </select>
      </div>

      {/* Deep-linked slip that is not on the current page — show it standalone. */}
      {detailId && !items.some((s) => s.id === detailId) ? (
        <div className="mq-card p-4">
          <SlipDetailBody
            slip={detailQuery.data}
            loading={detailQuery.isLoading}
            error={
              detailQuery.isError
                ? getErrorMessage(detailQuery.error, t("admin.common.failed"))
                : null
            }
          />
        </div>
      ) : null}

      {isError && (
        <div className="mq-alert mq-alert-error">
          {getErrorMessage(error, t("admin.common.failed"))}
        </div>
      )}
      {isLoading ? (
        <AdminCardListSkeleton count={4} />
      ) : items.length === 0 ? (
        <p className="text-sm text-mq-text-muted">{t("admin.inventoryPage.emptySlips")}</p>
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
                  <span className={statusBadge(s.status)}>{translateStatus(t, "inventorySlip", s.status)}</span>
                  <span className="text-xs text-mq-text-muted">
                    {slipTypeLabel(s.type, t)}
                  </span>
                </div>
                <p className="text-mq-text-secondary">{slipItemsSummary(s, t)}</p>
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
                  <p className="text-xs text-mq-text-muted">{t("admin.inventoryPage.warehouse")} {s.warehouseCode}</p>
                ) : null}
                {s.locationNote ? (
                  <p className="text-xs text-mq-text-muted">{s.locationNote}</p>
                ) : null}
                <p className="text-xs text-mq-text-muted font-mono">
                  {t("admin.common.shop")} {s.shopId.slice(0, 8)}… · {t("admin.inventoryPage.slip")} {s.id.slice(0, 8)}…
                </p>
                <p className="text-xs text-mq-text-muted">
                  {t("admin.inventoryPage.created")} {formatWhen(s.createdAt)}
                  {s.processedAt ? ` · ${t("admin.inventoryPage.processed")} ${formatWhen(s.processedAt)}` : ""}
                </p>
              </div>
              {s.status === "PENDING" ? (
                <AdminActions>
                  <AdminIconButton
                    label={t("admin.common.approve")}
                    icon={Check}
                    tone="approve"
                    disabled={busy}
                    onClick={() => void approveSlip.mutateAsync(s.id)}
                  />
                  <AdminIconButton
                    label={t("admin.common.reject")}
                    icon={X}
                    tone="reject"
                    disabled={busy}
                    onClick={() => setRejectSlipId(s.id)}
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
                    ? getErrorMessage(detailQuery.error, t("admin.common.failed"))
                    : null
                }
              />
            ) : null}
          </div>
        ))
      )}
      <PaginationBar page={page} meta={meta} onPageChange={setPage} />
      <ConfirmDialog
        open={Boolean(rejectSlipId)}
        title={t("confirm.rejectSlipTitle")}
        description={t("confirm.rejectSlipDesc")}
        confirmLabel={t("confirm.rejectSlipBtn")}
        tone="danger"
        busy={rejectSlip.isPending}
        onClose={() => setRejectSlipId(null)}
        onConfirm={async () => {
          if (!rejectSlipId) return;
          await rejectSlip.mutateAsync(rejectSlipId);
          setRejectSlipId(null);
        }}
      />
    </div>
  );
}

function LedgerTab() {
  const { t } = useLanguage();
  const [shopId, setShopId] = useState("");
  const [sku, setSku] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const { data: shopsPage } = useAdminShops("APPROVED", 1, 100);
  const shops = shopsPage?.items ?? [];

  // Resolve ledger `warehouseId` → warehouse code for the selected shop.
  const { data: warehouses = [] } = useWarehouses({
    shopId: shopId || undefined,
    enabled: Boolean(shopId),
  });
  const warehouseCodeById = useMemo(() => {
    const map = new Map<string, string>();
    for (const w of warehouses) map.set(w.id, w.code);
    return map;
  }, [warehouses]);

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
        {t("admin.inventoryPage.ledgerDesc")}
      </p>

      <div className="flex flex-wrap gap-3">
        <select
          className="mq-input max-w-[16rem]"
          value={shopId}
          aria-label={t("admin.common.shop")}
          onChange={(e) => {
            setShopId(e.target.value);
            setPage(1);
          }}
        >
          <option value="">{t("admin.common.selectShop")}</option>
          {shops.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <input
          className="mq-input max-w-[10rem]"
          placeholder={t("admin.inventoryPage.skuFilter")}
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
        <p className="text-sm text-mq-text-muted">{t("admin.inventoryPage.selectShopLoad")}</p>
      ) : isError ? (
        <div className="mq-alert mq-alert-error">
          {getErrorMessage(error, t("admin.common.failed"))}
        </div>
      ) : isLoading || (isFetching && !data) ? (
        <TableSkeleton rows={5} cols={7} />
      ) : items.length === 0 ? (
        <p className="text-sm text-mq-text-muted">{t("admin.inventoryPage.emptyLedger")}</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-mq-text-muted border-b border-mq-border">
                  <th className="py-2 pr-3 font-medium">{t("admin.common.when")}</th>
                  <th className="py-2 pr-3 font-medium">{t("admin.inventoryPage.warehouse")}</th>
                  <th className="py-2 pr-3 font-medium">SKU</th>
                  <th className="py-2 pr-3 font-medium">{t("admin.inventoryPage.type")}</th>
                  <th className="py-2 pr-3 font-medium">{t("admin.inventoryPage.qty")}</th>
                  <th className="py-2 pr-3 font-medium">{t("admin.inventoryPage.beforeAfter")}</th>
                  <th className="py-2 font-medium">{t("admin.inventoryPage.slip")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row: StockLedgerEntry) => (
                  <tr key={row.id} className="border-b border-mq-border/60">
                    <td className="py-2.5 pr-3 text-xs text-mq-text-muted">
                      {formatWhen(row.recordedAt)}
                    </td>
                    <td className="py-2.5 pr-3 text-xs font-medium">
                      {warehouseCodeById.get(row.warehouseId) ||
                        row.warehouseId?.slice(0, 8) ||
                        "—"}
                    </td>
                    <td className="py-2.5 pr-3 font-medium">{row.sku}</td>
                    <td className="py-2.5 pr-3 text-xs">{slipTypeLabel(row.type, t)}</td>
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
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const slipId = searchParams.get("slipId");
  const tabParam = searchParams.get("tab");
  const [tab, setTab] = useState<TabId>(() =>
    tabParam === "ledger" ? "ledger" : "slips",
  );

  const tabLabel = (id: TabId) =>
    id === "slips" ? t("admin.inventoryPage.slips") : t("admin.inventoryPage.ledger");

  return (
    <>
      <AdminPageHeader
        title={t("admin.inventory.title")}
        description={t("admin.inventory.description")}
      />

      <div className="space-y-5">
        <div
          className="flex flex-wrap gap-1 border-b border-mq-border pb-px"
          role="tablist"
          aria-label="Inventory sections"
        >
          {TAB_IDS.map((id) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`px-3.5 py-2 text-sm font-medium rounded-t-md transition-colors ${
                  active
                    ? "bg-mq-surface text-mq-text border border-mq-border border-b-mq-surface -mb-px"
                    : "text-mq-text-muted hover:text-mq-text"
                }`}
                onClick={() => setTab(id)}
              >
                {tabLabel(id)}
              </button>
            );
          })}
        </div>

        <div role="tabpanel">
          <div hidden={tab !== "slips"}>
            <SlipsTab initialSlipId={slipId} />
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
      roles={["ADMIN", "SUPER_ADMIN", "WAREHOUSE"]}
      permissions={["VIEW_INVENTORY", "EDIT_INVENTORY"]}
    >
      {/* useSearchParams (slip deep-link) needs a Suspense boundary. */}
      <Suspense fallback={<AdminCardListSkeleton count={4} />}>
        <InventoryInner />
      </Suspense>
    </AuthGuard>
  );
}
